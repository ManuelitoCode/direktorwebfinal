import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Director {
  id: string;
  username: string;
  avatar_url: string | null;
  tournament_count: number;
}

const TopDirectorsSpotlight: React.FC = () => {
  const navigate = useNavigate();
  const [directors, setDirectors] = useState<Director[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopDirectors();
  }, []);

  const fetchTopDirectors = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First, get all tournaments with their director_ids
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('director_id')
        .not('director_id', 'is', null);

      if (tournamentsError) throw tournamentsError;

      if (!tournamentsData || tournamentsData.length === 0) {
        setDirectors([]);
        return;
      }

      // Count tournaments per director
      const directorCounts = tournamentsData.reduce((acc, tournament) => {
        const directorId = tournament.director_id;
        acc[directorId] = (acc[directorId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Sort directors by tournament count and take top 5
      const topDirectorIds = Object.entries(directorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([directorId, count]) => ({ directorId, count }));

      if (topDirectorIds.length === 0) {
        setDirectors([]);
        return;
      }

      // Get user profiles for these directors
      const directorIds = topDirectorIds.map(item => item.directorId);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', directorIds);

      if (profilesError) throw profilesError;

      // Combine data
      const directorsWithProfiles = topDirectorIds.map(item => {
        const profile = profilesData?.find(p => p.id === item.directorId);
        return {
          id: item.directorId,
          username: profile?.username || 'Tournament Director',
          avatar_url: profile?.avatar_url,
          tournament_count: item.count
        };
      });

      setDirectors(directorsWithProfiles);
    } catch (err) {
      console.error('Error fetching top directors:', err);
      setError('Failed to load top directors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectorClick = (directorId: string) => {
    navigate(`/profile/${directorId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 font-jetbrains">{error}</p>
      </div>
    );
  }

  if (directors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 font-jetbrains">No tournament directors found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-6">
      {directors.map((director, index) => (
        <button
          key={director.id}
          onClick={() => handleDirectorClick(director.id)}
          className="group flex flex-col items-center p-6 bg-gray-900/50 backdrop-blur-sm border border-blue-500/30 rounded-xl hover:bg-gray-800/50 hover:border-blue-400/50 transition-all duration-300 hover:scale-105 neon-glow w-64"
          aria-label={`Director ${director.username}, hosted ${director.tournament_count} tournaments`}
        >
          <div className="relative mb-4">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
              {director.avatar_url ? (
                <img 
                  src={director.avatar_url} 
                  alt={director.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-white" />
              )}
            </div>
            
            {/* Rank Badge */}
            <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold font-orbitron text-sm ${
              index === 0 ? 'bg-yellow-500' : 
              index === 1 ? 'bg-gray-400' : 
              index === 2 ? 'bg-amber-600' : 'bg-blue-500'
            }`}>
              #{index + 1}
            </div>
          </div>
          
          <h3 className="text-lg font-bold text-white font-orbitron mb-2 group-hover:text-blue-300 transition-colors duration-200">
            {director.username}
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-200">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="font-jetbrains">{director.tournament_count} tournaments</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default TopDirectorsSpotlight;