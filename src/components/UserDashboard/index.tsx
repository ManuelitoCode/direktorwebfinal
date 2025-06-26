import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import LayoutWrapper from './LayoutWrapper';
import TournamentManagerCard from './TournamentManagerCard';
import ProfileCard from './ProfileCard';
import SettingsButton from './SettingsButton';
import TournamentSetupModal from '../TournamentSetupModal';
import { supabase } from '../../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Lazy-loaded components
const TournamentResume = React.lazy(() => import('../TournamentResume'));

interface UserProfile {
  id: string;
  username: string;
  nickname?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface UserDashboardProps {
  user: SupabaseUser;
  onNavigateToTournaments: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, onNavigateToTournaments }) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'dashboard' | 'profile' | 'tournaments' | 'history' | 'new-tournament' | 'resume-tournament'>('dashboard');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [hasExistingTournaments, setHasExistingTournaments] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Profile form state
  const [formData, setFormData] = useState({
    username: '',
    nickname: ''
  });

  useEffect(() => {
    loadUserProfile();
    checkExistingTournaments();
  }, [user.id]);

  const checkExistingTournaments = async () => {
    try {
      setConnectionError(null);
      
      // Test Supabase connection first
      const { data: testData, error: testError } = await supabase
        .from('tournaments')
        .select('id')
        .limit(1);

      if (testError) {
        console.error('Supabase connection test failed:', testError);
        setConnectionError(`Database connection failed: ${testError.message}`);
        return;
      }

      const { data, error } = await supabase
        .from('tournaments')
        .select('id')
        .eq('director_id', user.id)
        .limit(1);

      if (error) {
        console.error('Error checking existing tournaments:', error);
        setConnectionError(`Failed to check tournaments: ${error.message}`);
        return;
      }
      
      setHasExistingTournaments((data || []).length > 0);
    } catch (err: any) {
      console.error('Error checking existing tournaments:', err);
      
      // Provide more specific error messages
      if (err.message?.includes('Failed to fetch')) {
        setConnectionError('Unable to connect to the database. Please check your internet connection and try again.');
      } else if (err.message?.includes('CORS')) {
        setConnectionError('Database configuration error. Please contact support.');
      } else {
        setConnectionError(`Connection error: ${err.message || 'Unknown error occurred'}`);
      }
    }
  };

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setConnectionError(null);

      // First, try to get existing profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle no results gracefully

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      if (profileData) {
        // Profile exists, use it
        setProfile(profileData);
        setFormData({
          username: profileData.username || user.email || '',
          nickname: profileData.nickname || ''
        });
      } else {
        // Profile doesn't exist, create it using upsert to handle race conditions
        const newProfile = {
          id: user.id,
          username: user.email || '',
          nickname: '',
          avatar_url: null
        };

        const { data: createdProfile, error: createError } = await supabase
          .from('user_profiles')
          .upsert([newProfile], { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (createError) {
          console.error('Profile creation error:', createError);
          throw createError;
        }

        setProfile(createdProfile);
        setFormData({
          username: createdProfile.username || '',
          nickname: createdProfile.nickname || ''
        });
      }
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      
      // Provide more specific error messages
      if (err.message?.includes('Failed to fetch')) {
        setError('Unable to connect to the database. Please check your internet connection and try again.');
      } else if (err.message?.includes('CORS')) {
        setError('Database configuration error. Please contact support.');
      } else {
        setError(`Failed to load user profile: ${err.message || 'Unknown error occurred'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file) return;

    setIsUploadingAvatar(true);
    setError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      setSuccessMessage('Avatar updated successfully!');
      
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      
      if (err.message?.includes('Failed to fetch')) {
        setError('Unable to upload avatar. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Failed to upload avatar');
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const triggerAvatarUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleAvatarUpload(file);
      }
    };
    input.click();
  };

  const handleSaveProfile = async () => {
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          username: formData.username.trim(),
          nickname: formData.nickname.trim() || null
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Reload profile
      await loadUserProfile();
      setSuccessMessage('Profile updated successfully!');
      setShowProfileModal(false);
      
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err: any) {
      console.error('Error updating profile:', err);
      
      if (err.message?.includes('Failed to fetch')) {
        setError('Unable to save profile. Please check your internet connection and try again.');
      } else {
        setError(`Failed to update profile: ${err.message || 'Unknown error occurred'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      
      // Show success toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-green-500/50';
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          You've been signed out. See you next time!
        </div>
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
      
      // Redirect to landing page
      navigate('/');
    } catch (err) {
      console.error('Error signing out:', err);
      // Still redirect even if there's an error
      navigate('/');
    }
  };

  // Tournament navigation handlers
  const handleNewTournament = () => {
    setShowTournamentModal(true);
  };

  const handleViewTournaments = () => {
    if (hasExistingTournaments) {
      setActiveSection('resume-tournament');
    } else {
      setActiveSection('tournaments');
    }
  };

  const handleTournamentHistory = () => {
    setActiveSection('history');
  };

  const handleTournamentCreated = async (tournamentId: string) => {
    setShowTournamentModal(false);
    // Navigate to the tournament management flow
    onNavigateToTournaments();
  };

  const handleResumeTournament = (tournamentId: string, currentRound: number) => {
    // This will be handled by the parent component
    onNavigateToTournaments();
  };

  const openProfileModal = () => {
    setShowProfileModal(true);
    setError(null);
    setFormData({
      username: profile?.username || user.email || '',
      nickname: profile?.nickname || ''
    });
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Header actions for sign out button
  const headerActions = (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 backdrop-blur-lg text-gray-300 hover:text-white rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200"
    >
      <LogOut size={16} />
      Sign Out
    </button>
  );

  // Render dashboard content
  if (activeSection === 'dashboard') {
    return (
      <LayoutWrapper 
        title="WELCOME" 
        subtitle={profile?.username || user.email}
        headerActions={headerActions}
      >
        {/* Connection Error Message */}
        {connectionError && (
          <div className="max-w-4xl mx-auto w-full mb-8">
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 font-jetbrains text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">Connection Issue</span>
              </div>
              <p>{connectionError}</p>
              <button
                onClick={() => {
                  setConnectionError(null);
                  checkExistingTournaments();
                }}
                className="mt-2 px-3 py-1 bg-yellow-600/20 border border-yellow-500/50 rounded text-yellow-200 hover:bg-yellow-600/30 transition-colors duration-200"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="max-w-4xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="max-w-4xl mx-auto w-full mb-8">
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 text-green-300 font-jetbrains text-sm">
              {successMessage}
            </div>
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="fade-up fade-up-delay-4 max-w-4xl mx-auto w-full mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tournament Management Card */}
            <TournamentManagerCard
              onNewTournament={handleNewTournament}
              onViewTournaments={handleViewTournaments}
              onTournamentHistory={handleTournamentHistory}
            />

            {/* Profile Card */}
            <div className="relative">
              <ProfileCard
                user={user}
                profile={profile}
                onEditProfile={openProfileModal}
              />
              <SettingsButton onClick={openProfileModal} />
            </div>
          </div>
        </div>

        {/* Tournament Setup Modal */}
        <TournamentSetupModal
          isOpen={showTournamentModal}
          onClose={() => setShowTournamentModal(false)}
          onSuccess={handleTournamentCreated}
        />
      </LayoutWrapper>
    );
  }

  // Resume Tournament View
  if (activeSection === 'resume-tournament') {
    return (
      <LayoutWrapper 
        title="YOUR TOURNAMENTS" 
        subtitle="Resume or manage your tournaments"
        showBackButton={true}
        onBack={() => setActiveSection('dashboard')}
        headerActions={headerActions}
      >
        <React.Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        }>
          <TournamentResume
            onNewTournament={handleNewTournament}
            onResumeTournament={handleResumeTournament}
          />
        </React.Suspense>
      </LayoutWrapper>
    );
  }

  // Fallback for other sections
  return (
    <LayoutWrapper 
      title="DASHBOARD" 
      subtitle="Your tournament management hub"
      showBackButton={true}
      onBack={() => setActiveSection('dashboard')}
      headerActions={headerActions}
    >
      <div className="text-center py-12">
        <p className="text-gray-400 font-jetbrains">
          This section is under development
        </p>
      </div>
    </LayoutWrapper>
  );
};

export default UserDashboard;