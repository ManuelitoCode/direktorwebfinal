import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, User, Search, Medal, Star, Crown, Users } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import { supabase } from '../lib/supabase';

interface Director {
  id: string;
  username: string;
  avatar_url: string | null;
  tournament_count: number;
  rank: number;
}

const DirectorsLeaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [directors, setDirectors] = useState<Director[]>([]);
  const [filteredDirectors, setFilteredDirectors] = useState<Director[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAllDirectors();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDirectors(directors);
    } else {
      const filtered = directors.filter(director => 
        director.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDirectors(filtered);
    }
  }, [searchQuery, directors]);

  const fetchAllDirectors = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First, fetch all tournaments with director_id
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('director_id')
        .not('director_id', 'is', null);

      if (tournamentsError) throw tournamentsError;

      if (!tournamentsData || tournamentsData.length === 0) {
        setDirectors([]);
        setFilteredDirectors([]);
        return;
      }

      // Count tournaments per director using JavaScript
      const directorCounts = tournamentsData.reduce((acc, tournament) => {
        const directorId = tournament.director_id;
        acc[directorId] = (acc[directorId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get unique director IDs and sort by tournament count
      const sortedDirectorEntries = Object.entries(directorCounts)
        .sort(([, countA], [, countB]) => countB - countA);

      if (sortedDirectorEntries.length === 0) {
        setDirectors([]);
        setFilteredDirectors([]);
        return;
      }

      // Get user profiles for these directors
      const directorIds = sortedDirectorEntries.map(([directorId]) => directorId);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', directorIds);

      if (profilesError) throw profilesError;

      // Combine data and assign ranks
      const directorsWithProfiles = sortedDirectorEntries.map(([directorId, count], index) => {
        const profile = profilesData?.find(p => p.id === directorId);
        return {
          id: directorId,
          username: profile?.username || 'Tournament Director',
          avatar_url: profile?.avatar_url,
          tournament_count: count,
          rank: index + 1
        };
      });

      setDirectors(directorsWithProfiles);
      setFilteredDirectors(directorsWithProfiles);
    } catch (err) {
      console.error('Error fetching directors:', err);
      setError('Failed to load directors leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleDirectorClick = (directorId: string) => {
    navigate(`/profile/${directorId}`);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <Star className="w-5 h-5 text-blue-400" />;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/50 shadow-lg shadow-yellow-500/20';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50 shadow-lg shadow-gray-400/20';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/50 shadow-lg shadow-amber-600/20';
      default:
        return 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft size={20} />
              <span className="font-jetbrains">← Back to Home</span>
            </button>
          </div>

          <h1 
            className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
            data-text="TOURNAMENT DIRECTORS LEADERBOARD"
            style={{
              textShadow: '0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(59, 130, 246, 0.4), 0 0 90px rgba(59, 130, 246, 0.3)'
            }}
          >
            TOURNAMENT DIRECTORS LEADERBOARD
          </h1>
          
          <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-blue-400 mb-4 font-medium">
            Ranked by Number of Tournaments Hosted
          </p>
          
          <div className="fade-up fade-up-delay-2 w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto rounded-full"></div>
        </div>

        {/* Search Bar */}
        <div className="fade-up fade-up-delay-3 max-w-6xl mx-auto w-full mb-8">
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search directors by name..."
              className="block w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Directors Leaderboard */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredDirectors.length > 0 ? (
            <div className="space-y-4">
              {filteredDirectors.map((director) => (
                <button
                  key={director.id}
                  onClick={() => handleDirectorClick(director.id)}
                  className={`w-full flex items-center justify-between p-6 rounded-xl border-2 transition-all duration-300 ${getRankStyle(director.rank)}`}
                >
                  <div className="flex items-center gap-6">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-800 text-2xl font-bold font-orbitron text-white">
                      {getRankIcon(director.rank)}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
                        {director.avatar_url ? (
                          <img 
                            src={director.avatar_url} 
                            alt={director.username} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-8 h-8 text-white" />
                        )}
                      </div>
                      
                      <div className="text-left">
                        <h3 className="text-xl font-bold text-white font-orbitron">
                          {director.username}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Users className="w-4 h-4" />
                          <span className="font-jetbrains">Director</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white font-orbitron">
                        {director.tournament_count}
                      </div>
                      <div className="text-sm text-gray-400 font-jetbrains">
                        Tournaments
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/50">
                      <Trophy className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-900/50 border border-gray-700 rounded-xl">
              <Trophy className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white font-orbitron mb-2">
                No Directors Found
              </h3>
              <p className="text-gray-400 font-jetbrains">
                {searchQuery ? 'No directors match your search criteria' : 'No tournament directors available yet'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Celebrating the best tournament directors in the Scrabble community
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-green-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default DirectorsLeaderboard;