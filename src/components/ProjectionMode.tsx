import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Users, Clock, Zap } from 'lucide-react';
import TournamentHeader from './TournamentHeader';
import { supabase } from '../lib/supabase';
import { Tournament, Division, Player, PairingWithPlayers, Result } from '../types/database';

interface PlayerStanding {
  id: string;
  name: string;
  rank: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  spread: number;
  gamesPlayed: number;
}

interface RoundPairing extends PairingWithPlayers {
  result?: Result;
}

const ProjectionMode: React.FC = () => {
  const { tournamentId, divisionId } = useParams<{ tournamentId: string; divisionId: string }>();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [division, setDivision] = useState<Division | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRoundPairings, setCurrentRoundPairings] = useState<RoundPairing[]>([]);
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTournamentData();
    }, 15000);

    return () => clearInterval(interval);
  }, [tournamentId, divisionId]);

  // Update seconds counter every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
      setSecondsSinceUpdate(diffSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Initial load
  useEffect(() => {
    if (tournamentId) {
      loadTournamentData();
    }
  }, [tournamentId, divisionId]);

  const loadTournamentData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) {
        if (tournamentError.code === 'PGRST116') {
          setError('Tournament not found');
        } else {
          throw tournamentError;
        }
        return;
      }

      setTournament(tournamentData);
      setCurrentRound(tournamentData.current_round || 1);

      // Load division if specified
      if (divisionId && divisionId !== 'main') {
        const { data: divisionData, error: divisionError } = await supabase
          .from('divisions')
          .select('*')
          .eq('id', divisionId)
          .single();

        if (divisionError && divisionError.code !== 'PGRST116') {
          throw divisionError;
        }

        setDivision(divisionData);
      } else {
        setDivision(null);
      }

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      // Load current round pairings
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select(`
          *,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        `)
        .eq('tournament_id', tournamentId)
        .eq('round_number', tournamentData.current_round || 1)
        .order('table_number');

      if (pairingsError && pairingsError.code !== 'PGRST116') {
        throw pairingsError;
      }

      // Load results for current round
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('round_number', tournamentData.current_round || 1)
        .in('pairing_id', (pairingsData || []).map(p => p.id));

      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }

      // Combine pairings with results
      const pairingsWithResults: RoundPairing[] = (pairingsData || []).map(pairing => {
        const result = resultsData?.find(r => r.pairing_id === pairing.id);
        return { ...pairing, result } as RoundPairing;
      });

      setCurrentRoundPairings(pairingsWithResults);

      // Calculate standings
      await calculateStandings(playersData || [], tournamentId!);

      setLastUpdated(new Date());
      setSecondsSinceUpdate(0);

    } catch (err) {
      console.error('Error loading tournament data:', err);
      setError('Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStandings = async (players: Player[], tournamentId: string) => {
    try {
      // Load all results for this tournament
      const { data: allResults, error: resultsError } = await supabase
        .from('results')
        .select(`
          *,
          pairing:pairings!results_pairing_id_fkey(
            player1_id,
            player2_id,
            player1_rank,
            player2_rank,
            round_number
          )
        `)
        .eq('pairing.tournament_id', tournamentId);

      if (resultsError) throw resultsError;

      const standings: PlayerStanding[] = [];

      for (const player of players) {
        let wins = 0;
        let losses = 0;
        let draws = 0;
        let pointsFor = 0;
        let pointsAgainst = 0;
        let gamesPlayed = 0;

        // Process each result
        for (const result of allResults || []) {
          const pairing = result.pairing;
          if (!pairing) continue;

          const isPlayer1 = pairing.player1_id === player.id;
          const isPlayer2 = pairing.player2_id === player.id;

          if (!isPlayer1 && !isPlayer2) continue;

          const playerScore = isPlayer1 ? result.player1_score : result.player2_score;
          const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;

          pointsFor += playerScore;
          pointsAgainst += opponentScore;
          gamesPlayed++;

          // Determine result
          if (playerScore > opponentScore) {
            wins++;
          } else if (playerScore < opponentScore) {
            losses++;
          } else {
            draws++;
          }
        }

        const points = wins + (draws * 0.5);
        const spread = pointsFor - pointsAgainst;

        standings.push({
          id: player.id!,
          name: player.name,
          rank: 0, // Will be calculated after sorting
          rating: player.rating,
          wins,
          losses,
          draws,
          points,
          spread,
          gamesPlayed
        });
      }

      // Sort by points (desc), then spread (desc), then rating (desc)
      standings.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.spread !== b.spread) return b.spread - a.spread;
        return b.rating - a.rating;
      });

      // Assign ranks
      standings.forEach((standing, index) => {
        standing.rank = index + 1;
      });

      setStandings(standings);
    } catch (err) {
      console.error('Error calculating standings:', err);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-8" />
          <div className="text-6xl font-bold text-white font-orbitron">
            LOADING TOURNAMENT DATA
          </div>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl font-bold text-red-400 font-orbitron mb-8">
            ERROR
          </div>
          <div className="text-4xl text-white font-jetbrains">
            {error || 'Tournament not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Tournament Header */}
      <TournamentHeader
        tournament={tournament}
        division={division}
        showDivision={!!division}
        variant="projector"
      />

      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 h-full">
          {/* Left Column: Standings */}
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-2 border-yellow-500/50 rounded-2xl p-8">
              <h2 className="text-5xl font-bold text-yellow-400 font-orbitron mb-8 text-center">
                🏆 LEADERBOARD
              </h2>
              
              <div className="space-y-4">
                {standings.slice(0, 10).map((standing) => (
                  <div
                    key={standing.id}
                    className={`flex items-center justify-between p-6 rounded-xl border-2 transition-all duration-300 ${
                      standing.rank === 1
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500 shadow-lg shadow-yellow-500/20'
                        : standing.rank === 2
                        ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400 shadow-lg shadow-gray-400/20'
                        : standing.rank === 3
                        ? 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600 shadow-lg shadow-amber-600/20'
                        : 'bg-gray-800/50 border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-6">
                      <div className="text-4xl font-bold font-orbitron min-w-[80px]">
                        {getRankIcon(standing.rank)}
                      </div>
                      
                      <div>
                        <div className="text-3xl font-bold text-white font-jetbrains">
                          {standing.name}
                        </div>
                        <div className="text-xl text-gray-400 font-jetbrains">
                          Rating: {standing.rating}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-4xl font-bold text-white font-orbitron">
                        {standing.points}
                      </div>
                      <div className="text-xl text-gray-400 font-jetbrains">
                        {standing.wins}-{standing.losses}-{standing.draws}
                      </div>
                      <div className={`text-lg font-jetbrains ${
                        standing.spread > 0 ? 'text-green-400' : 
                        standing.spread < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {standing.spread > 0 ? '+' : ''}{standing.spread}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Current Round Pairings */}
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-2 border-blue-500/50 rounded-2xl p-8">
              <h2 className="text-5xl font-bold text-blue-400 font-orbitron mb-8 text-center">
                ⚔️ ROUND {currentRound}
              </h2>
              
              <div className="space-y-6">
                {currentRoundPairings.length > 0 ? (
                  currentRoundPairings.map((pairing) => (
                    <div
                      key={pairing.id}
                      className="bg-gray-800/50 border-2 border-gray-600 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        {/* Table Number */}
                        <div className="text-3xl font-bold text-blue-400 font-orbitron min-w-[100px]">
                          T{pairing.table_number}
                        </div>
                        
                        {/* Players */}
                        <div className="flex-1 flex items-center justify-center gap-8">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-white font-jetbrains">
                              {pairing.player1.name}
                            </div>
                            <div className="text-lg text-gray-400 font-jetbrains">
                              #{pairing.player1_rank} • {pairing.player1.rating}
                            </div>
                          </div>
                          
                          <div className="text-4xl font-bold text-gray-500">VS</div>
                          
                          <div className="text-left">
                            <div className="text-2xl font-bold text-white font-jetbrains">
                              {pairing.player2.name}
                            </div>
                            <div className="text-lg text-gray-400 font-jetbrains">
                              #{pairing.player2_rank} • {pairing.player2.rating}
                            </div>
                          </div>
                        </div>
                        
                        {/* Result */}
                        <div className="text-right min-w-[150px]">
                          {pairing.result ? (
                            <div>
                              <div className="text-3xl font-bold text-white font-orbitron">
                                {pairing.result.player1_score} - {pairing.result.player2_score}
                              </div>
                              <div className="text-lg text-green-400 font-jetbrains">
                                {pairing.result.winner_id === pairing.player1_id ? 'P1 WINS' :
                                 pairing.result.winner_id === pairing.player2_id ? 'P2 WINS' : 'TIE'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-2xl text-yellow-400 font-jetbrains animate-pulse">
                              IN PROGRESS
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* First Move Indicator */}
                      {pairing.first_move_player_id && (
                        <div className="mt-4 text-center">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-lg text-green-400 font-jetbrains">
                              First Move: {pairing.first_move_player_id === pairing.player1_id ? pairing.player1.name : pairing.player2.name}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl text-gray-400 font-jetbrains">
                      No pairings for this round yet
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-900 to-black border-t-2 border-blue-500/50 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8 text-2xl text-blue-300">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6" />
              <span className="font-jetbrains">{players.length} Players</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6" />
              <span className="font-jetbrains">Round {currentRound}</span>
            </div>
          </div>
          
          <div className="text-2xl text-green-400 font-jetbrains">
            🔄 Auto-refresh: 15s • Last updated: {formatTime(secondsSinceUpdate)} ago
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectionMode;