import React, { useState, useEffect } from 'react';
import { Upload, Flag, Users, Save, X, Edit, Trash2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Team } from '../types/database';

interface TeamManagerProps {
  tournamentId: string;
  onTeamsUpdated?: () => void;
}

interface TeamFormData {
  name: string;
  country: string;
  logoFile?: File;
}

const COUNTRY_FLAGS: Record<string, string> = {
  'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'AU': '🇦🇺', 'NZ': '🇳🇿',
  'NG': '🇳🇬', 'GH': '🇬🇭', 'KE': '🇰🇪', 'ZA': '🇿🇦', 'UG': '🇺🇬',
  'IN': '🇮🇳', 'PK': '🇵🇰', 'BD': '🇧🇩', 'LK': '🇱🇰', 'MY': '🇲🇾',
  'SG': '🇸🇬', 'TH': '🇹🇭', 'PH': '🇵🇭', 'ID': '🇮🇩', 'VN': '🇻🇳',
  'FR': '🇫🇷', 'DE': '🇩🇪', 'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱',
  'BE': '🇧🇪', 'CH': '🇨🇭', 'AT': '🇦🇹', 'SE': '🇸🇪', 'NO': '🇳🇴',
  'DK': '🇩🇰', 'FI': '🇫🇮', 'IE': '🇮🇪', 'PT': '🇵🇹', 'GR': '🇬🇷',
  'BR': '🇧🇷', 'AR': '🇦🇷', 'MX': '🇲🇽', 'CL': '🇨🇱', 'CO': '🇨🇴',
  'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'TW': '🇹🇼', 'HK': '🇭🇰',
  'IL': '🇮🇱', 'TR': '🇹🇷', 'EG': '🇪🇬', 'MA': '🇲🇦', 'TN': '🇹🇳'
};

const TeamManager: React.FC<TeamManagerProps> = ({ tournamentId, onTeamsUpdated }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    country: ''
  });

  useEffect(() => {
    loadTeams();
  }, [tournamentId]);

  const loadTeams = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);
    } catch (err: any) {
      console.error('Error loading teams:', err);
      setError('Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (file: File, teamName: string): Promise<string | null> => {
    try {
      setIsUploading(true);

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Generate filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${tournamentId}/${teamName.replace(/[^a-z0-9]/gi, '_')}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('team-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('team-logos')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setError(err.message || 'Failed to upload logo');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveTeam = async () => {
    if (!formData.name.trim()) {
      setError('Team name is required');
      return;
    }

    try {
      setError(null);
      let logoUrl = null;

      // Upload logo if provided
      if (formData.logoFile) {
        logoUrl = await handleLogoUpload(formData.logoFile, formData.name);
        if (!logoUrl) return; // Upload failed
      }

      const teamData = {
        tournament_id: tournamentId,
        name: formData.name.trim(),
        country: formData.country || null,
        logo_url: logoUrl
      };

      if (editingTeam) {
        // Update existing team
        const { error: updateError } = await supabase
          .from('teams')
          .update(teamData)
          .eq('id', editingTeam);

        if (updateError) throw updateError;
      } else {
        // Create new team
        const { error: insertError } = await supabase
          .from('teams')
          .insert([teamData]);

        if (insertError) throw insertError;
      }

      // Reset form and reload teams
      setFormData({ name: '', country: '' });
      setShowAddForm(false);
      setEditingTeam(null);
      await loadTeams();
      onTeamsUpdated?.();

    } catch (err: any) {
      console.error('Error saving team:', err);
      setError(err.message || 'Failed to save team');
    }
  };

  const handleEditTeam = (team: Team) => {
    setFormData({
      name: team.name,
      country: team.country || ''
    });
    setEditingTeam(team.id!);
    setShowAddForm(true);
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      await loadTeams();
      onTeamsUpdated?.();
    } catch (err: any) {
      console.error('Error deleting team:', err);
      setError('Failed to delete team');
    }
  };

  const getTeamInitials = (teamName: string): string => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3);
  };

  const renderTeamLogo = (team: Team, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-12 h-12 text-sm',
      lg: 'w-16 h-16 text-base'
    };

    if (team.logo_url) {
      return (
        <img
          src={team.logo_url}
          alt={`${team.name} logo`}
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-600`}
        />
      );
    }

    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold font-orbitron border-2 border-gray-600`}>
        {getTeamInitials(team.name)}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
          <Users size={24} />
          Team Manager
        </h3>
        
        <button
          onClick={() => {
            setFormData({ name: '', country: '' });
            setEditingTeam(null);
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
        >
          <Plus size={16} />
          Add Team
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
          {error}
        </div>
      )}

      {/* Add/Edit Team Form */}
      {showAddForm && (
        <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-white font-orbitron">
              {editingTeam ? 'Edit Team' : 'Add New Team'}
            </h4>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingTeam(null);
                setFormData({ name: '', country: '' });
              }}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Team Name */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                Team Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
                placeholder="Enter team name"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                Country (Optional)
              </label>
              <select
                value={formData.country}
                onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
              >
                <option value="">Select country</option>
                {Object.entries(COUNTRY_FLAGS).map(([code, flag]) => (
                  <option key={code} value={code}>
                    {flag} {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
              Team Logo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFormData(prev => ({ ...prev, logoFile: file }));
                }
              }}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
            />
            <p className="text-xs text-gray-400 mt-1 font-jetbrains">
              Supported formats: JPG, PNG, GIF • Max size: 5MB
            </p>
          </div>

          {/* Preview */}
          {formData.name && (
            <div className="mb-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold font-orbitron border-2 border-gray-600">
                  {getTeamInitials(formData.name)}
                </div>
                <div>
                  <div className="text-white font-medium font-jetbrains flex items-center gap-2">
                    {formData.name}
                    {formData.country && COUNTRY_FLAGS[formData.country] && (
                      <span className="text-lg">{COUNTRY_FLAGS[formData.country]}</span>
                    )}
                  </div>
                  <div className="text-gray-400 text-sm font-jetbrains">Preview</div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveTeam}
              disabled={isUploading || !formData.name.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {editingTeam ? 'Update Team' : 'Add Team'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Teams List */}
      {teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 hover:bg-gray-700/50 transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-4">
                {renderTeamLogo(team, 'lg')}
                <div className="flex-1">
                  <div className="text-white font-medium font-jetbrains flex items-center gap-2">
                    {team.name}
                    {team.country && COUNTRY_FLAGS[team.country] && (
                      <span className="text-lg">{COUNTRY_FLAGS[team.country]}</span>
                    )}
                  </div>
                  <div className="text-gray-400 text-sm font-jetbrains">
                    {team.country ? `${team.country}` : 'No country set'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleEditTeam(team)}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30 hover:text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id!)}
                  className="flex items-center gap-1 px-3 py-2 bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30 hover:text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 font-jetbrains">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No teams created yet</p>
          <p className="text-sm mt-2">Add your first team to get started</p>
        </div>
      )}
    </div>
  );
};

export default TeamManager;