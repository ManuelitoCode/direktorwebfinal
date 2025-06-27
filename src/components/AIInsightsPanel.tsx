import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, Target, Trophy, AlertTriangle, User, BarChart3, ArrowUp, ArrowDown, Zap, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLogicBlock } from '../hooks/useLogicBlocks';
import { useAuditLog } from '../hooks/useAuditLog';
import { Player, Tournament, Result, Pairing } from '../types/database';

interface AIInsightsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  currentRound: number;
}

interface PlayerInsight {
  playerId: string;
  playerName: string;
  rating: number;
  currentRank: number;
  winProbability: number;
  potentialRankChange: number;
  averageOpponentRating: number;
  spreadTrend: 'up' | 'down' | 'stable';
  performanceRating: number;
  keyInsight: string;
  recommendedStrategy?: string;
}

interface TournamentInsight {
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  isOpen,
  onClose,
  tournamentId,
  currentRound
}) => {
  const [playerInsights, setPlayerInsights] = useState<PlayerInsight[]>([]);
  const [tournamentInsights, setTournamentInsights] = useState<TournamentInsight[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { logicCode, isLoading: isLogicLoading } = useLogicBlock('tournament_insights');
  const { logAction } = useAuditLog();
  
  useEffect(() => {
    if (isOpen && tournamentId) {
      loadInsights();
    }
  }, [isOpen, tournamentId, currentRound]);
  
  const loadInsights = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Log insights access
      logAction({
        action: 'ai_insights_accessed',
        details: {
          tournament_id: tournamentId,
          current_round: currentRound
        }
      });
      
      // Load tournament data
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
        
      if (tournamentError) throw tournamentError;
      
      // Load players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId);
        
      if (playersError) throw playersError;
      
      // Load results
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select(`
          *,
          pairing:pairings!results_pairing_id_fkey(
            player1_id,
            player2_id,
            round_number
          )
        `)
        .eq('tournament_id', tournamentId);
        
      if (resultsError) throw resultsError;
      
      // Load pairings for current round
      const { data: currentPairings, error: pairingsError } = await supabase
        .from('pairings')
        .select(`
          *,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        `)
        .eq('tournament_id', tournamentId)
        .eq('round_number', currentRound);
        
      if (pairingsError) throw pairingsError;
      
      // Generate insights
      if (logicCode && !isLogicLoading) {
        try {
          // Create a safe function from the logic code
          const generateInsightsFunction = new Function(
            'tournament',
            'players',
            'results',
            'currentPairings',
            'currentRound',
            logicCode
          );
          
          // Execute the function with our parameters
          const { playerInsights, tournamentInsights } = generateInsightsFunction(
            tournament,
            players,
            results,
            currentPairings,
            currentRound
          );
          
          setPlayerInsights(playerInsights || []);
          setTournamentInsights(tournamentInsights || []);
        } catch (err) {
          console.error('Error executing insights logic:', err);
          // Fall back to static insights
          generateStaticInsights(tournament, players, results, currentPairings);
        }
      } else {
        // Fall back to static insights
        generateStaticInsights(tournament, players, results, currentPairings);
      }
    } catch (err) {
      console.error('Error loading insights:', err);
      setError('Failed to load tournament insights');
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateStaticInsights = (
    tournament: Tournament,
    players: Player[],
    results: any[],
    currentPairings: any[]
  ) => {
    // Calculate player standings
    const standings = calculateStandings(players, results);
    
    // Generate player insights
    const insights: PlayerInsight[] = standings.slice(0, 10).map(player => {
      // Find current pairing
      const currentPairing = currentPairings?.find(p => 
        p.player1_id === player.id || p.player2_id === player.id
      );
      
      // Calculate opponent rating average
      const opponentRatings = results
        .filter(r => {
          const pairing = r.pairing;
          if (!pairing) return false;
          return pairing.player1_id === player.id || pairing.player2_id === player.id;
        })
        .map(r => {
          const pairing = r.pairing;
          const opponentId = pairing.player1_id === player.id ? pairing.player2_id : pairing.player1_id;
          const opponent = players.find(p => p.id === opponentId);
          return opponent?.rating || 0;
        })
        .filter(r => r > 0);
      
      const averageOpponentRating = opponentRatings.length > 0
        ? Math.round(opponentRatings.reduce((sum, r) => sum + r, 0) / opponentRatings.length)
        : 0;
      
      // Calculate win probability for current match
      let winProbability = 0.5;
      if (currentPairing) {
        const opponent = currentPairing.player1_id === player.id 
          ? currentPairing.player2 
          : currentPairing.player1;
        
        if (opponent) {
          // Simple Elo-based probability
          const ratingDiff = player.rating - opponent.rating;
          winProbability = 1 / (1 + Math.pow(10, -ratingDiff / 400));
        }
      }
      
      // Generate key insight
      let keyInsight = '';
      if (player.rank === 1) {
        keyInsight = 'Currently leading the tournament. Strong performance across all games.';
      } else if (player.rank <= 3) {
        keyInsight = 'In contention for the top spot. Consistent performance so far.';
      } else if (player.spread > 100) {
        keyInsight = 'Impressive point spread indicates dominant gameplay.';
      } else if (player.spread < -100) {
        keyInsight = 'Struggling with point differential despite current ranking.';
      } else if (player.wins > player.losses + 1) {
        keyInsight = 'Winning record shows strong tournament performance.';
      } else {
        keyInsight = 'Middle-of-pack performance with room for improvement.';
      }
      
      return {
        playerId: player.id,
        playerName: player.name,
        rating: player.rating,
        currentRank: player.rank,
        winProbability: Math.round(winProbability * 100) / 100,
        potentialRankChange: player.rank <= 3 ? 0 : -Math.min(2, player.rank - 1),
        averageOpponentRating,
        spreadTrend: player.spread > 0 ? 'up' : player.spread < 0 ? 'down' : 'stable',
        performanceRating: player.rating + Math.round(player.spread / 10),
        keyInsight
      };
    });
    
    setPlayerInsights(insights);
    
    // Generate tournament insights
    const tournamentInsights: TournamentInsight[] = [
      {
        title: 'Competitive Balance',
        description: `This tournament has a ${getCompetitiveBalance(standings)} level of competitive balance.`,
        type: 'neutral'
      },
      {
        title: 'Round Impact',
        description: `Round ${currentRound} is a ${getCurrentRoundImpact(currentRound, tournament.rounds || 7)} round for determining final standings.`,
        type: 'positive'
      },
      {
        title: 'Score Distribution',
        description: getScoreDistributionInsight(results),
        type: 'neutral'
      }
    ];
    
    setTournamentInsights(tournamentInsights);
  };
  
  const calculateStandings = (players: Player[], results: any[]) => {
    const standings = players.map(player => {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let spread = 0;
      
      // Process each result
      results.forEach(result => {
        const pairing = result.pairing;
        if (!pairing) return;
        
        const isPlayer1 = pairing.player1_id === player.id;
        const isPlayer2 = pairing.player2_id === player.id;
        
        if (!isPlayer1 && !isPlayer2) return;
        
        const playerScore = isPlayer1 ? result.player1_score : result.player2_score;
        const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;
        
        spread += playerScore - opponentScore;
        
        if (playerScore > opponentScore) {
          wins++;
        } else if (playerScore < opponentScore) {
          losses++;
        } else {
          draws++;
        }
      });
      
      return {
        id: player.id,
        name: player.name,
        rating: player.rating,
        wins,
        losses,
        draws,
        points: wins + (draws * 0.5),
        spread,
        rank: 0 // Will be assigned after sorting
      };
    });
    
    // Sort by points, then spread, then rating
    standings.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });
    
    // Assign ranks
    standings.forEach((player, index) => {
      player.rank = index + 1;
    });
    
    return standings;
  };
  
  const getCompetitiveBalance = (standings: any[]) => {
    if (standings.length < 2) return 'unknown';
    
    const topScore = standings[0].points;
    const medianScore = standings[Math.floor(standings.length / 2)].points;
    const scoreDiff = topScore - medianScore;
    
    if (scoreDiff <= 1) return 'high';
    if (scoreDiff <= 2) return 'moderate';
    return 'low';
  };
  
  const getCurrentRoundImpact = (currentRound: number, totalRounds: number) => {
    const roundPercentage = (currentRound / totalRounds) * 100;
    
    if (roundPercentage < 30) return 'early but important';
    if (roundPercentage < 60) return 'pivotal';
    if (roundPercentage < 90) return 'critical';
    return 'decisive';
  };
  
  const getScoreDistributionInsight = (results: any[]) => {
    if (results.length === 0) return 'No games completed yet.';
    
    const scores = results.flatMap(r => [r.player1_score, r.player2_score]);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    
    return `Average game score is ${avg} points with ${results.length} games completed.`;
  };
  
  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'positive': return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'negative': return 'bg-red-500/20 border-red-500/50 text-red-400';
      case 'warning': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      default: return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
    }
  };
  
  const getSpreadTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUp className="w-4 h-4 text-green-400" />;
      case 'down': return <ArrowDown className="w-4 h-4 text-red-400" />;
      default: return <TrendingUp className="w-4 h-4 text-gray-400" />;
    }
  };
  
  const filteredPlayers = searchQuery
    ? playerInsights.filter(p => 
        p.playerName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : playerInsights;
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-7xl max-h-[90vh] bg-gray-900/95 backdrop-blur-lg border-2 border-purple-500/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-purple-500/30 bg-gradient-to-r from-purple-900/30 to-blue-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white font-orbitron">
                AI Tournament Insights
              </h2>
              <p className="text-purple-300 font-jetbrains">
                Advanced analytics and performance projections
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
          ) : (
            <div className="space-y-8">
              {/* Tournament Insights */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white font-orbitron mb-6 flex items-center gap-2">
                  <Zap size={24} className="text-yellow-400" />
                  Tournament Analysis
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {tournamentInsights.map((insight, index) => (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border ${getInsightTypeColor(insight.type)}`}
                    >
                      <h4 className="font-bold font-jetbrains mb-2">{insight.title}</h4>
                      <p className="text-sm text-gray-300">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Player Search */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                    <User size={24} className="text-blue-400" />
                    Player Insights
                  </h3>
                  
                  <div className="relative max-w-xs w-full">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search players..."
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-jetbrains text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  {filteredPlayers.length > 0 ? (
                    filteredPlayers.map((player) => (
                      <div
                        key={player.playerId}
                        className={`p-4 bg-gray-800/70 border border-gray-600 rounded-lg hover:bg-gray-700/70 transition-all duration-200 ${
                          selectedPlayerId === player.playerId ? 'border-purple-500 bg-purple-900/20' : ''
                        }`}
                        onClick={() => setSelectedPlayerId(
                          selectedPlayerId === player.playerId ? null : player.playerId
                        )}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg font-bold text-white font-orbitron">
                                #{player.currentRank}
                              </span>
                              <h4 className="text-lg font-bold text-white">{player.playerName}</h4>
                              <span className="text-sm text-gray-400 font-jetbrains">
                                ({player.rating})
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-300 mb-3">{player.keyInsight}</p>
                            
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Trophy size={14} className="text-yellow-400" />
                                <span className="text-gray-300">
                                  Win Probability: <span className="text-yellow-400 font-bold">{(player.winProbability * 100).toFixed(0)}%</span>
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {getSpreadTrendIcon(player.spreadTrend)}
                                <span className="text-gray-300">
                                  Spread Trend: <span className={`font-bold ${
                                    player.spreadTrend === 'up' ? 'text-green-400' : 
                                    player.spreadTrend === 'down' ? 'text-red-400' : 'text-gray-400'
                                  }`}>
                                    {player.spreadTrend.toUpperCase()}
                                  </span>
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Target size={14} className="text-blue-400" />
                                <span className="text-gray-300">
                                  Performance Rating: <span className="text-blue-400 font-bold">{player.performanceRating}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {player.potentialRankChange !== 0 && (
                              <div className={`px-3 py-1 rounded-lg text-xs font-jetbrains ${
                                player.potentialRankChange > 0 
                                  ? 'bg-green-500/20 border border-green-500/50 text-green-400' 
                                  : 'bg-red-500/20 border border-red-500/50 text-red-400'
                              }`}>
                                {player.potentialRankChange > 0 
                                  ? `Could rise ${player.potentialRankChange} ranks` 
                                  : `Could fall ${Math.abs(player.potentialRankChange)} ranks`}
                              </div>
                            )}
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlayerId(
                                  selectedPlayerId === player.playerId ? null : player.playerId
                                );
                              }}
                              className="px-3 py-1 bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/30 hover:text-white rounded-lg text-xs font-jetbrains transition-all duration-200"
                            >
                              {selectedPlayerId === player.playerId ? 'Hide Details' : 'Show Details'}
                            </button>
                          </div>
                        </div>
                        
                        {/* Expanded Details */}
                        {selectedPlayerId === player.playerId && (
                          <div className="mt-4 pt-4 border-t border-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                                <h5 className="text-sm font-bold text-white mb-3 font-jetbrains">Performance Metrics</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Avg. Opponent Rating:</span>
                                    <span className="text-white font-mono">{player.averageOpponentRating}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Performance Rating:</span>
                                    <span className="text-white font-mono">{player.performanceRating}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Rating Difference:</span>
                                    <span className={`font-mono ${
                                      player.performanceRating > player.rating ? 'text-green-400' : 
                                      player.performanceRating < player.rating ? 'text-red-400' : 'text-white'
                                    }`}>
                                      {player.performanceRating - player.rating > 0 ? '+' : ''}
                                      {player.performanceRating - player.rating}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                                <h5 className="text-sm font-bold text-white mb-3 font-jetbrains">Projections</h5>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Win Probability:</span>
                                    <span className="text-yellow-400 font-mono">{(player.winProbability * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Potential Rank Change:</span>
                                    <span className={`font-mono ${
                                      player.potentialRankChange > 0 ? 'text-green-400' : 
                                      player.potentialRankChange < 0 ? 'text-red-400' : 'text-white'
                                    }`}>
                                      {player.potentialRankChange > 0 ? '+' : ''}
                                      {player.potentialRankChange}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Projected Final Rank:</span>
                                    <span className="text-white font-mono">
                                      {Math.max(1, player.currentRank + player.potentialRankChange)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {player.recommendedStrategy && (
                              <div className="mt-4 bg-purple-900/20 border border-purple-500/50 rounded-lg p-4">
                                <h5 className="text-sm font-bold text-purple-300 mb-2 font-jetbrains flex items-center gap-2">
                                  <Brain size={14} />
                                  AI Strategy Recommendation
                                </h5>
                                <p className="text-sm text-gray-300">{player.recommendedStrategy}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400 font-jetbrains">
                      {searchQuery ? 'No players match your search' : 'No player insights available'}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Disclaimer */}
              <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 font-jetbrains text-sm flex items-center gap-2">
                <AlertTriangle size={20} />
                <span>
                  <strong>Note:</strong> These insights are AI-generated projections based on current tournament data. 
                  Actual results may vary based on gameplay and other factors.
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400 font-jetbrains">
              <Brain className="w-4 h-4 inline mr-2" />
              AI-powered tournament analysis
            </div>
            
            <div className="text-sm text-purple-400 font-jetbrains">
              Round {currentRound} Insights
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsightsPanel;