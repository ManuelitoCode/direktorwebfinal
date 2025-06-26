import React, { useState, useEffect } from 'react';
import { X, Download, Trophy, Target, TrendingUp, Calendar, Users, Medal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Result, Pairing } from '../types/database';

interface PlayerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  tournamentId: string;
}

interface PlayerGame {
  round: number;
  tableNumber: number;
  opponentId: string;
  opponentName: string;
  opponentRank: number;
  opponentRating: number;
  playerScore: number;
  opponentScore: number;
  result: 'won' | 'lost' | 'drew';
  spread: number;
  wasFirstMove: boolean;
}

interface PlayerStats {
  player: Player;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  totalSpread: number;
  averageScore: number;
  averageOpponentScore: number;
  firstMoveGames: number;
  winPercentage: number;
  currentRank: number;
  games: PlayerGame[];
}

const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({
  isOpen,
  onClose,
  playerId,
  tournamentId
}) => {
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && playerId && tournamentId) {
      loadPlayerStats();
    }
  }, [isOpen, playerId, tournamentId]);

  const loadPlayerStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load player info
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;

      // Load all results for this player
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select(`
          *,
          pairing:pairings!results_pairing_id_fkey(
            id,
            round_number,
            table_number,
            player1_id,
            player2_id,
            player1_rank,
            player2_rank,
            first_move_player_id,
            player1:players!pairings_player1_id_fkey(id, name, rating),
            player2:players!pairings_player2_id_fkey(id, name, rating)
          )
        `)
        .eq('pairing.tournament_id', tournamentId);

      if (resultsError) throw resultsError;

      // Filter results for this player and process games
      const playerResults = (resultsData || []).filter(result => {
        const pairing = result.pairing;
        return pairing && (pairing.player1_id === playerId || pairing.player2_id === playerId);
      });

      const games: PlayerGame[] = [];
      let totalPlayerScore = 0;
      let totalOpponentScore = 0;
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let firstMoveGames = 0;

      for (const result of playerResults) {
        const pairing = result.pairing;
        if (!pairing) continue;

        const isPlayer1 = pairing.player1_id === playerId;
        const playerScore = isPlayer1 ? result.player1_score : result.player2_score;
        const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;
        const opponent = isPlayer1 ? pairing.player2 : pairing.player1;
        const opponentRank = isPlayer1 ? pairing.player2_rank : pairing.player1_rank;
        const wasFirstMove = pairing.first_move_player_id === playerId;

        totalPlayerScore += playerScore;
        totalOpponentScore += opponentScore;

        let gameResult: 'won' | 'lost' | 'drew';
        if (playerScore > opponentScore) {
          wins++;
          gameResult = 'won';
        } else if (playerScore < opponentScore) {
          losses++;
          gameResult = 'lost';
        } else {
          draws++;
          gameResult = 'drew';
        }

        if (wasFirstMove) {
          firstMoveGames++;
        }

        games.push({
          round: pairing.round_number,
          tableNumber: pairing.table_number,
          opponentId: opponent.id,
          opponentName: opponent.name,
          opponentRank,
          opponentRating: opponent.rating,
          playerScore,
          opponentScore,
          result: gameResult,
          spread: playerScore - opponentScore,
          wasFirstMove
        });
      }

      // Sort games by round
      games.sort((a, b) => a.round - b.round);

      // Calculate current rank by getting all players and their standings
      const { data: allPlayersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;

      // Calculate standings for ranking
      const standings = await calculatePlayerStandings(allPlayersData || [], tournamentId);
      const currentRank = standings.findIndex(s => s.id === playerId) + 1;

      const totalGames = games.length;
      const points = wins + (draws * 0.5);
      const totalSpread = totalPlayerScore - totalOpponentScore;
      const averageScore = totalGames > 0 ? totalPlayerScore / totalGames : 0;
      const averageOpponentScore = totalGames > 0 ? totalOpponentScore / totalGames : 0;
      const winPercentage = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      setPlayerStats({
        player: playerData,
        totalGames,
        wins,
        losses,
        draws,
        points,
        totalSpread,
        averageScore,
        averageOpponentScore,
        firstMoveGames,
        winPercentage,
        currentRank,
        games
      });

    } catch (err) {
      console.error('Error loading player stats:', err);
      setError('Failed to load player statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePlayerStandings = async (players: Player[], tournamentId: string) => {
    // Load all results for ranking calculation
    const { data: allResults } = await supabase
      .from('results')
      .select(`
        *,
        pairing:pairings!results_pairing_id_fkey(
          player1_id,
          player2_id,
          round_number
        )
      `)
      .eq('pairing.tournament_id', tournamentId);

    const standings = players.map(player => {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

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

      return {
        id: player.id!,
        points,
        spread,
        rating: player.rating
      };
    });

    // Sort by points, then spread, then rating
    standings.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });

    return standings;
  };

  const exportPlayerSummary = (format: 'csv' | 'pdf') => {
    if (!playerStats) return;

    if (format === 'csv') {
      const headers = ['Round', 'Table', 'Opponent', 'Opp Rating', 'Player Score', 'Opp Score', 'Result', 'Spread', 'First Move'];
      const rows = playerStats.games.map(game => [
        game.round,
        game.tableNumber,
        game.opponentName,
        game.opponentRating,
        game.playerScore,
        game.opponentScore,
        game.result.toUpperCase(),
        game.spread,
        game.wasFirstMove ? 'Yes' : 'No'
      ]);

      const csvContent = [
        [`Player Summary: ${playerStats.player.name}`],
        [`Rating: ${playerStats.player.rating}`],
        [`Record: ${playerStats.wins}-${playerStats.losses}-${playerStats.draws}`],
        [`Total Spread: ${playerStats.totalSpread}`],
        [`Win Percentage: ${playerStats.winPercentage.toFixed(1)}%`],
        [],
        headers,
        ...rows
      ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${playerStats.player.name}_Summary.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // For PDF, we'll create a simple text-based summary
      alert('PDF export coming soon! Use CSV export for now.');
    }
  };

  const getResultIcon = (result: 'won' | 'lost' | 'drew') => {
    switch (result) {
      case 'won':
        return '✅';
      case 'lost':
        return '❌';
      case 'drew':
        return '⚖️';
    }
  };

  const getResultColor = (result: 'won' | 'lost' | 'drew') => {
    switch (result) {
      case 'won':
        return 'text-green-400';
      case 'lost':
        return 'text-red-400';
      case 'drew':
        return 'text-yellow-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gray-900/95 backdrop-blur-lg border-2 border-blue-500/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-blue-500/30 bg-gradient-to-r from-blue-900/30 to-purple-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white font-orbitron">
                Player Statistics
              </h2>
              <p className="text-blue-300 font-jetbrains">
                Detailed performance analysis
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 font-jetbrains">{error}</div>
            </div>
          ) : playerStats ? (
            <div className="space-y-8">
              {/* Player Header */}
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/50 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-4xl font-bold text-white font-orbitron mb-2">
                      {playerStats.player.name}
                    </h3>
                    <div className="flex items-center gap-6 text-lg text-blue-300">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        <span className="font-jetbrains">Rating: {playerStats.player.rating}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Medal className="w-5 h-5" />
                        <span className="font-jetbrains">Current Rank: #{playerStats.currentRank}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white font-orbitron">
                      {playerStats.points} pts
                    </div>
                    <div className="text-lg text-gray-300 font-jetbrains">
                      {playerStats.wins}-{playerStats.losses}-{playerStats.draws}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 font-orbitron">
                    {playerStats.winPercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">Win Rate</div>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold font-orbitron ${
                    playerStats.totalSpread > 0 ? 'text-green-400' : 
                    playerStats.totalSpread < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {playerStats.totalSpread > 0 ? '+' : ''}{playerStats.totalSpread}
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">Total Spread</div>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400 font-orbitron">
                    {playerStats.averageScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">Avg Score</div>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400 font-orbitron">
                    {playerStats.firstMoveGames}
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">First Moves</div>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => exportPlayerSummary('csv')}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  <Download size={16} />
                  Export CSV
                </button>
                
                <button
                  onClick={() => exportPlayerSummary('pdf')}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  <Download size={16} />
                  Export PDF
                </button>
              </div>

              {/* Games History */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                  <h4 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                    <Trophy size={24} />
                    Game History ({playerStats.totalGames} games)
                  </h4>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Round</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Table</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Opponent</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Result</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Spread</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">First</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {playerStats.games.map((game, index) => (
                        <tr key={index} className="hover:bg-gray-800/30 transition-colors duration-200">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono font-bold">
                            {game.round}
                          </td>
                          
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                            {game.tableNumber}
                          </td>
                          
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-white">
                                {game.opponentName}
                              </div>
                              <div className="text-xs text-gray-400 font-jetbrains">
                                #{game.opponentRank} • {game.opponentRating}
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-4 py-4 text-center">
                            <div className="font-mono text-sm text-white">
                              {game.playerScore} - {game.opponentScore}
                            </div>
                          </td>
                          
                          <td className="px-4 py-4 text-center">
                            <div className={`flex items-center justify-center gap-1 ${getResultColor(game.result)}`}>
                              <span className="text-lg">{getResultIcon(game.result)}</span>
                              <span className="font-jetbrains text-sm font-medium">
                                {game.result.toUpperCase()}
                              </span>
                            </div>
                          </td>
                          
                          <td className="px-4 py-4 text-center">
                            <span className={`font-mono text-sm ${
                              game.spread > 0 ? 'text-green-400' : 
                              game.spread < 0 ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {game.spread > 0 ? '+' : ''}{game.spread}
                            </span>
                          </td>
                          
                          <td className="px-4 py-4 text-center">
                            {game.wasFirstMove && (
                              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto"></div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {playerStats.games.length === 0 && (
                  <div className="text-center py-12 text-gray-400 font-jetbrains">
                    No games played yet
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailsModal;