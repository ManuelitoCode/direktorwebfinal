import React, { useState, useEffect } from 'react';
import { Settings, Trophy, User, Camera, Save, ArrowLeft, Shield, Users, Target, Plus, Eye, History, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import TournamentSetupModal from './TournamentSetupModal';
import TournamentResume from './TournamentResume';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

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
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Handle keyboard navigation for cards and links
  const handleCardKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
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

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            {(activeSection === 'profile' || activeSection === 'tournaments' || activeSection === 'history') && (
              <button
                onClick={() => setActiveSection('dashboard')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
              >
                <ArrowLeft size={20} />
                <span className="font-jetbrains">Back to Dashboard</span>
              </button>
            )}
            
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 backdrop-blur-lg text-gray-300 hover:text-white rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 ml-auto"
            >
              <ArrowLeft size={16} />
              Sign Out
            </button>
          </div>

          {activeSection === 'dashboard' ? (
            <>
              <h1 
                className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
                data-text="WELCOME"
                style={{
                  textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
                }}
              >
                WELCOME
              </h1>
              
              <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-cyan-400 mb-4 font-medium font-jetbrains">
                {profile?.username || user.email}
              </p>
              
              <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
                Your tournament management dashboard
              </p>
              
              <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"></div>
            </>
          ) : activeSection === 'profile' ? (
            <>
              <h1 
                className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
                data-text="PROFILE"
                style={{
                  textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
                }}
              >
                PROFILE
              </h1>
              
              <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-cyan-400 mb-4 font-medium font-jetbrains">
                Manage your account settings
              </p>
              
              <div className="fade-up fade-up-delay-2 w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"></div>
            </>
          ) : activeSection === 'tournaments' ? (
            <>
              <h1 
                className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
                data-text="ALL TOURNAMENTS"
                style={{
                  textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
                }}
              >
                📋 ALL TOURNAMENTS
              </h1>
              
              <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-cyan-400 mb-4 font-medium font-jetbrains">
                View and manage your tournaments
              </p>
              
              <div className="fade-up fade-up-delay-2 w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"></div>
            </>
          ) : activeSection === 'resume-tournament' ? (
            <>
              <h1 
                className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
                data-text="YOUR TOURNAMENTS"
                style={{
                  textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
                }}
              >
                📋 YOUR TOURNAMENTS
              </h1>
              
              <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-cyan-400 mb-4 font-medium font-jetbrains">
                Resume or manage your tournaments
              </p>
              
              <div className="fade-up fade-up-delay-2 w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"></div>
            </>
          ) : (
            <>
              <h1 
                className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
                data-text="TOURNAMENT HISTORY"
                style={{
                  textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
                }}
              >
                📜 TOURNAMENT HISTORY
              </h1>
              
              <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-cyan-400 mb-4 font-medium font-jetbrains">
                View completed tournaments and archives
              </p>
              
              <div className="fade-up fade-up-delay-2 w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"></div>
            </>
          )}
        </div>

        {/* Connection Error Message */}
        {connectionError && (
          <div className="max-w-4xl mx-auto w-full mb-8">
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 font-jetbrains text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4" />
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

        {/* Dashboard Content */}
        {activeSection === 'dashboard' && (
          <div className="fade-up fade-up-delay-4 max-w-4xl mx-auto w-full mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Tournament Management Card */}
              <div 
                className="bg-gray-900/50 border border-cyan-500/30 rounded-2xl p-8 backdrop-blur-lg hover:bg-gray-800/50 hover:border-cyan-400/50 transition-all duration-300 group focus:outline-none focus:ring-4 focus:ring-cyan-500/50 focus:border-cyan-400"
                tabIndex={0}
                role="region"
                aria-label="Tournament Management - Access tournament creation, management, and history"
                style={{
                  boxShadow: '0 0 30px rgba(34, 211, 238, 0.2)'
                }}
              >
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white font-orbitron mb-2 group-hover:text-cyan-300 transition-colors duration-300">
                    Tournament Manager
                  </h3>
                  
                  <p className="text-gray-400 font-jetbrains mb-6 leading-relaxed">
                    Access and manage your tournaments
                  </p>
                </div>

                {/* Navigation Links */}
                <div className="space-y-3">
                  <button
                    onClick={handleNewTournament}
                    onKeyDown={(e) => handleCardKeyDown(e, handleNewTournament)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-cyan-600/20 border border-cyan-500/50 rounded-lg text-cyan-300 hover:bg-cyan-600/30 hover:text-white hover:border-cyan-400 transition-all duration-200 font-jetbrains font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    aria-label="Create a new tournament"
                  >
                    <Plus className="w-5 h-5" />
                    <span>New Tournament</span>
                  </button>

                  <button
                    onClick={handleViewTournaments}
                    onKeyDown={(e) => handleCardKeyDown(e, handleViewTournaments)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-300 hover:bg-blue-600/30 hover:text-white hover:border-blue-400 transition-all duration-200 font-jetbrains font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="View and manage active tournaments"
                  >
                    <Eye className="w-5 h-5" />
                    <span>View Tournaments</span>
                  </button>

                  <button
                    onClick={handleTournamentHistory}
                    onKeyDown={(e) => handleCardKeyDown(e, handleTournamentHistory)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600/20 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-600/30 hover:text-white hover:border-purple-400 transition-all duration-200 font-jetbrains font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label="View completed tournament history and archives"
                  >
                    <History className="w-5 h-5" />
                    <span>Tournament History</span>
                  </button>
                </div>
              </div>

              {/* Profile Card */}
              <div 
                className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-8 backdrop-blur-lg hover:bg-gray-800/50 hover:border-purple-400/50 transition-all duration-300 group relative"
                style={{
                  boxShadow: '0 0 30px rgba(147, 51, 234, 0.2)'
                }}
              >
                <div className="text-center">
                  {/* Profile Avatar */}
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-white" />
                    )}
                  </div>
                  
                  {/* Profile Info */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                      {profile?.username || user.email}
                    </h3>
                    
                    <p className="text-gray-400 font-jetbrains text-sm mb-2">
                      {user.email}
                    </p>
                    
                    {profile?.nickname && (
                      <p className="text-purple-300 font-jetbrains text-sm">
                        "{profile.nickname}"
                      </p>
                    )}
                  </div>
                  
                  {/* Profile Stats */}
                  <div className="flex items-center justify-center gap-4 text-sm text-purple-400 mb-6">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-4 h-4" />
                      <span>Verified</span>
                    </div>
                  </div>
                </div>

                {/* Settings Gear Icon */}
                <button
                  onClick={openProfileModal}
                  className="absolute bottom-4 right-4 w-10 h-10 bg-purple-600/20 border border-purple-500/50 rounded-lg flex items-center justify-center text-purple-400 hover:bg-purple-600/30 hover:text-white hover:border-purple-400 transition-all duration-200 group/gear"
                  title="Edit Profile"
                  aria-label="Edit Profile Settings"
                >
                  <Settings className="w-5 h-5 group-hover/gear:rotate-90 transition-transform duration-300" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* All Tournaments Content */}
        {activeSection === 'tournaments' && (
          <AllTournamentsView user={user} />
        )}

        {/* Resume Tournament Content */}
        {activeSection === 'resume-tournament' && (
          <div className="fade-up max-w-6xl mx-auto w-full mb-8">
            <TournamentResume
              onNewTournament={handleNewTournament}
              onResumeTournament={handleResumeTournament}
            />
          </div>
        )}

        {/* Tournament History Content */}
        {activeSection === 'history' && (
          <TournamentHistoryView user={user} />
        )}

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            {activeSection === 'dashboard' 
              ? 'Your personal tournament management hub'
              : activeSection === 'profile'
              ? 'Manage your profile and account settings'
              : activeSection === 'tournaments'
              ? 'View and manage all your tournaments'
              : activeSection === 'resume-tournament'
              ? 'Resume or manage your tournaments'
              : 'Browse your completed tournament archives'
            }
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeProfileModal}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-2xl bg-gray-900/95 backdrop-blur-lg border-2 border-purple-500/50 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-2 border-purple-500/30 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white font-orbitron">
                    Edit Profile Settings
                  </h2>
                  <p className="text-purple-300 font-jetbrains">
                    Update your profile information
                  </p>
                </div>
              </div>
              
              <button
                onClick={closeProfileModal}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
              >
                <ArrowLeft size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Avatar Section */}
              <div className="text-center mb-8">
                <div className="relative inline-block">
                  <div className="w-32 h-32 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-16 h-16 text-white" />
                    )}
                  </div>
                  
                  <button
                    onClick={triggerAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="absolute bottom-0 right-0 w-10 h-10 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded-full flex items-center justify-center transition-all duration-200 border-2 border-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    aria-label="Upload new avatar image"
                  >
                    {isUploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                  </button>
                </div>
                
                <p className="text-gray-400 font-jetbrains text-sm">
                  Click the camera icon to upload a new avatar
                </p>
              </div>

              {/* Profile Form */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                    placeholder="Enter your display name"
                    aria-describedby="username-help"
                  />
                  <p id="username-help" className="text-xs text-gray-500 mt-1 font-jetbrains">
                    This name will be displayed in tournaments and on your profile
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Nickname (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => handleInputChange('nickname', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                    placeholder="Enter a nickname"
                    aria-describedby="nickname-help"
                  />
                  <p id="nickname-help" className="text-xs text-gray-500 mt-1 font-jetbrains">
                    An optional shorter name or alias
                  </p>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
                    {error}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 pt-4">
                  <button
                    onClick={closeProfileModal}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Profile
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tournament Setup Modal */}
      <TournamentSetupModal
        isOpen={showTournamentModal}
        onClose={() => setShowTournamentModal(false)}
        onSuccess={handleTournamentCreated}
      />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

// All Tournaments View Component
interface AllTournamentsViewProps {
  user: SupabaseUser;
}

const AllTournamentsView: React.FC<AllTournamentsViewProps> = ({ user }) => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadTournaments();
  }, [user.id]);

  const loadTournaments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select(`
          *,
          players(count)
        `)
        .eq('director_id', user.id)
        .order('last_activity', { ascending: false });

      if (tournamentsError) throw tournamentsError;

      // Process tournaments with player counts
      const processedTournaments = (tournamentsData || []).map(tournament => ({
        ...tournament,
        player_count: tournament.players?.[0]?.count || 0
      }));

      setTournaments(processedTournaments);
    } catch (err: any) {
      console.error('Error loading tournaments:', err);
      
      if (err.message?.includes('Failed to fetch')) {
        setError('Unable to connect to the database. Please check your internet connection and try again.');
      } else {
        setError(`Failed to load tournaments: ${err.message || 'Unknown error occurred'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTournament = (tournamentId: string) => {
    navigate(`/t/${tournamentId}`);
  };

  if (isLoading) {
    return (
      <div className="fade-up max-w-6xl mx-auto w-full mb-8 text-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-up max-w-6xl mx-auto w-full mb-8">
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
          {error}
          <button
            onClick={loadTournaments}
            className="mt-2 block px-3 py-1 bg-red-600/20 border border-red-500/50 rounded text-red-200 hover:bg-red-600/30 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up max-w-6xl mx-auto w-full mb-8">
      {tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-gray-900/50 border border-cyan-500/30 rounded-xl p-6 backdrop-blur-lg hover:bg-gray-800/50 hover:border-cyan-400/50 transition-all duration-300 cursor-pointer"
              onClick={() => handleViewTournament(tournament.id)}
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white font-orbitron mb-2">
                  {tournament.name}
                </h3>
                
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                  {tournament.date && (
                    <span className="font-jetbrains">
                      {new Date(tournament.date).toLocaleDateString()}
                    </span>
                  )}
                  
                  {tournament.venue && (
                    <span className="font-jetbrains">{tournament.venue}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-cyan-400 font-orbitron">
                    {tournament.player_count}
                  </div>
                  <div className="text-xs text-gray-400 font-jetbrains">Players</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400 font-orbitron">
                    {tournament.current_round || 1}
                  </div>
                  <div className="text-xs text-gray-400 font-jetbrains">Round</div>
                </div>
              </div>

              <div className={`px-3 py-1 rounded-lg text-xs font-jetbrains text-center ${
                tournament.status === 'completed' ? 'bg-green-500/20 border border-green-500/50 text-green-400' :
                tournament.status === 'active' ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400' :
                tournament.status === 'registration' ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400' :
                'bg-gray-500/20 border border-gray-500/50 text-gray-400'
              }`}>
                {tournament.status?.toUpperCase() || 'SETUP'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-12 text-center backdrop-blur-sm">
          <Trophy className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white font-orbitron mb-2">
            No Tournaments Yet
          </h3>
          <p className="text-gray-400 font-jetbrains">
            Create your first tournament to get started
          </p>
        </div>
      )}
    </div>
  );
};

// Tournament History View Component
interface TournamentHistoryViewProps {
  user: SupabaseUser;
}

const TournamentHistoryView: React.FC<TournamentHistoryViewProps> = ({ user }) => {
  const [completedTournaments, setCompletedTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCompletedTournaments();
  }, [user.id]);

  const loadCompletedTournaments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select(`
          *,
          players(count)
        `)
        .eq('director_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (tournamentsError) throw tournamentsError;

      // Process tournaments with player counts
      const processedTournaments = (tournamentsData || []).map(tournament => ({
        ...tournament,
        player_count: tournament.players?.[0]?.count || 0
      }));

      setCompletedTournaments(processedTournaments);
    } catch (err: any) {
      console.error('Error loading completed tournaments:', err);
      
      if (err.message?.includes('Failed to fetch')) {
        setError('Unable to connect to the database. Please check your internet connection and try again.');
      } else {
        setError(`Failed to load tournament history: ${err.message || 'Unknown error occurred'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTournament = (tournamentId: string) => {
    navigate(`/t/${tournamentId}`);
  };

  if (isLoading) {
    return (
      <div className="fade-up max-w-6xl mx-auto w-full mb-8 text-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-up max-w-6xl mx-auto w-full mb-8">
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
          {error}
          <button
            onClick={loadCompletedTournaments}
            className="mt-2 block px-3 py-1 bg-red-600/20 border border-red-500/50 rounded text-red-200 hover:bg-red-600/30 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up max-w-6xl mx-auto w-full mb-8">
      {completedTournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {completedTournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-gray-900/50 border border-green-500/30 rounded-xl p-6 backdrop-blur-lg hover:bg-gray-800/50 hover:border-green-400/50 transition-all duration-300"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white font-orbitron mb-2">
                  {tournament.name}
                </h3>
                
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                  {tournament.date && (
                    <span className="font-jetbrains">
                      {new Date(tournament.date).toLocaleDateString()}
                    </span>
                  )}
                  
                  {tournament.venue && (
                    <span className="font-jetbrains">{tournament.venue}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400 font-orbitron">
                    {tournament.player_count}
                  </div>
                  <div className="text-xs text-gray-400 font-jetbrains">Players</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400 font-orbitron">
                    {tournament.rounds || 7}
                  </div>
                  <div className="text-xs text-gray-400 font-jetbrains">Rounds</div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleViewTournament(tournament.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600/20 border border-green-500/50 rounded-lg text-green-300 hover:bg-green-600/30 hover:text-white hover:border-green-400 transition-all duration-200 font-jetbrains font-medium"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Results</span>
                </button>
                
                <button
                  onClick={() => handleViewTournament(tournament.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-300 hover:bg-blue-600/30 hover:text-white hover:border-blue-400 transition-all duration-200 font-jetbrains font-medium"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Final Standings</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-12 text-center backdrop-blur-sm">
          <History className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white font-orbitron mb-2">
            No Completed Tournaments
          </h3>
          <p className="text-gray-400 font-jetbrains">
            Complete your first tournament to see it in your history
          </p>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;