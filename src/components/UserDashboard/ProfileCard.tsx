import React from 'react';
import { User, Shield } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  username: string;
  nickname?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface ProfileCardProps {
  user: SupabaseUser;
  profile: UserProfile | null;
  onEditProfile: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ user, profile, onEditProfile }) => {
  return (
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
    </div>
  );
};

export default ProfileCard;