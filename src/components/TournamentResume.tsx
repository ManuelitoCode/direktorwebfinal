import React, { useState, useEffect } from 'react';
import { Play, Eye, Trash2, Calendar, MapPin, Users, Trophy, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import { supabase } from '../lib/supabase';
import { Tournament } from '../types/database';

interface TournamentResumeProps {
  onNewTournament: () => void;
  onResumeTournament: (tournamentId: string, currentRound: number) => void;
}

interface TournamentWithStats extends Tournament {
  player_count: number;
  completed_rounds: number;
  total_pairings: number;
  completed_results: number;
}

const TournamentResume: React.FC<TournamentResumeProps> = ({ 
  onNewTournament, 
  onResumeTournament 
}) => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadDirectorTournaments();
  }, []);

  const loadDirectorTournaments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view your tournaments');
        return;
      }

      // Load tournaments with stats
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select(`
          *,
          players(count),
          pairings(count),
          results(count)
        `)
        .eq('director_id', user.id)
        .order('last_activity', { ascending: false });

      if (tournamentsError) throw tournamentsError;

      // Process tournaments with stats
      const tournamentsWithStats: TournamentWithStats[] = await Promise.all(
        (tournamentsData || []).map(async (tournament) => {
          // Get completed rounds count
          const { data: roundsData } = await supabase
            .from('pairings')
            .select('round_number')
            .eq('tournament_id', tournament.id);

          const completedRounds = roundsData 
            ? Math.max(0, ...roundsData.map(r => r.round_number), 0)
            : 0;

          return {
            ...tournament,
            player_count: tournament.players?.[0]?.count || 0,
            completed_rounds: completedRounds,
            total_pairings: tournament.pairings?.[0]?.count || 0,
            completed_results: tournament.results?.[0]?.count || 0
          };
        })
      );

      setTournaments(tournamentsWithStats);
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError('Failed to load your tournaments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeTournament = (tournament: TournamentWithStats) => {
    onResumeTournament(tournament.id, tournament.current_round || 1);
  };

  const handleViewTournament = (tournamentId: string) => {
    navigate(`/t/${tournamentId}`);
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    if (deleteConfirm !== tournamentId) {
      setDeleteConfirm(tournamentId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;

      // Reload tournaments
      await loadDirectorTournaments();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting tournament:', err);
      setError('Failed to delete tournament');
    }
  };

  const getStatusBadge = (tournament: TournamentWithStats) => {
    const { status, player_count, completed_rounds, total_pairings, completed_results } = tournament;
    
    if (status === 'completed') {
      return { text: 'Completed', color: 'bg-green-500/20 border-green-500/50 text-green-400' };
    }
    
    if (player_count === 0) {
      return { text: 'Setup', color: 'bg-blue-500/20 border-blue-500/50 text-blue-400' };
    }
    
    if (completed_rounds === 0) {
      return { text: 'Registration', color: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' };
    }
    
    if (total_pairings > completed_results) {
      return { text: 'In Progress', color: 'bg-orange-500/20 border-orange-500/50 text-orange-400' };
    }
    
    return { text: 'Active', color: 'bg-purple-500/20 border-purple-500/50 text-purple-400' };
  };

  const getProgressPercentage = (tournament: TournamentWithStats) => {
    const maxRounds = tournament.rounds || 7;
    return Math.min(100, (tournament.completed_rounds / maxRounds) * 100);
  };

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 max-w-6xl mx-auto">
          <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
              data-text="YOUR TOURNAMENTS">
            📋 YOUR TOURNAMENTS
          </h1>
          
          <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-blue-400 mb-4 font-medium">
            Resume or manage your tournaments
          </p>
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Continue where you left off or start a new tournament
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 mx-auto rounded-full"></div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {/* New Tournament Button */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8">
          <Button
            icon={Trophy}
            label="🆕 Start New Tournament"
            onClick={onNewTournament}
            variant="blue"
            className="max-w-md mx-auto"
          />
        </div>

        {/* Tournaments List */}
        {tournaments.length > 0 ? (
          <div className="fade-up fade-up-delay-5 max-w-6xl mx-auto w-full mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tournaments.map((tournament) => {
                const statusBadge = getStatusBadge(tournament);
                const progressPercentage = getProgressPercentage(tournament);
                
                return (
                  <div
                    key={tournament.id}
                    className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm hover:bg-gray-800/50 transition-all duration-300"
                  >
                    {/* Tournament Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white font-orbitron mb-2">
                          {tournament.name}
                        </h3>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                          {tournament.date && (
                            <div className="flex items-center gap-1">
                              <Calendar size={14} />
                              <span className="font-jetbrains">
                                {new Date(tournament.date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          
                          {tournament.venue && (
                            <div className="flex items-center gap-1">
                              <MapPin size={14} />
                              <span className="font-jetbrains">{tournament.venue}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-lg border text-xs font-jetbrains ${statusBadge.color}`}>
                        {statusBadge.text}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span className="font-jetbrains">
                          Round {tournament.completed_rounds} of {tournament.rounds || 7}
                        </span>
                        <span className="font-jetbrains">{Math.round(progressPercentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Tournament Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                          <Users size={16} />
                        </div>
                        <div className="text-lg font-bold text-white font-orbitron">
                          {tournament.player_count}
                        </div>
                        <div className="text-xs text-gray-400 font-jetbrains">Players</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                          <Trophy size={16} />
                        </div>
                        <div className="text-lg font-bold text-white font-orbitron">
                          {tournament.completed_results}
                        </div>
                        <div className="text-xs text-gray-400 font-jetbrains">Games</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
                          <Clock size={16} />
                        </div>
                        <div className="text-lg font-bold text-white font-orbitron">
                          {formatLastActivity(tournament.last_activity || tournament.created_at)}
                        </div>
                        <div className="text-xs text-gray-400 font-jetbrains">Last Active</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleResumeTournament(tournament)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                      >
                        <Play size={16} />
                        Resume
                      </button>
                      
                      <button
                        onClick={() => handleViewTournament(tournament.id)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                      >
                        <Eye size={16} />
                        View
                      </button>
                      
                      <button
                        onClick={() => handleDeleteTournament(tournament.id)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                          deleteConfirm === tournament.id
                            ? 'bg-red-700 text-white animate-pulse'
                            : 'bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white'
                        }`}
                      >
                        <Trash2 size={16} />
                        {deleteConfirm === tournament.id ? 'Confirm' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="fade-up fade-up-delay-5 max-w-6xl mx-auto w-full mb-8">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-12 text-center backdrop-blur-sm">
              <Trophy className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white font-orbitron mb-2">
                No Tournaments Yet
              </h3>
              <p className="text-gray-400 font-jetbrains mb-6">
                Create your first tournament to get started
              </p>
              <Button
                icon={ArrowRight}
                label="Create First Tournament"
                onClick={onNewTournament}
                variant="green"
                className="max-w-sm mx-auto"
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Your tournaments are automatically saved and synced
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-cyan-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default TournamentResume;