import React, { useState, useEffect, Suspense } from 'react';
import { X, TrendingUp, TrendingDown, Target, AlertTriangle, RotateCcw, Save, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PairingWithPlayers, Result, Player } from '../types/database';
import { useLogicBlock } from '../hooks/useLogicBlocks';

interface StandingsImpactVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  currentRound: number;
}

interface MockResult {
  pairingId: string;
  player1Score: number;
  player2Score: number;
  winnerId?: string;
}

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
  rankChange?: number;
  impactTags?: string[];
}

interface SimulationScenario {
  name: string;
  description: string;
  mockResults: Record<string, MockResult>;
}

const StandingsImpactVisualizer: React.FC<StandingsImpactVisualizerProps> = ({
  isOpen,
  onClose,
  tournamentId,
  currentRound
}) => {
  const [pairings, setPairings] = useState<PairingWithPlayers[]>([]);
  const [currentStandings, setCurrentStandings] = useState<PlayerStanding[]>([]);
  const [simulatedStandings, setSimulatedStandings] = useState<PlayerStanding[]>([]);
  const [mockResults, setMockResults] = useState<Record<string, MockResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTopOnly, setShowTopOnly] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<SimulationScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  
  // Fetch the impact analysis logic from Supabase
  const { logicCode, isLoading: isLogicLoading, error: logicError } = useLogicBlock('standings_impact');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, tournamentId, currentRound]);

  useEffect(() => {
    if (pairings.length > 0 && currentStandings.length > 0) {
      simulateStandings();
    }
  }, [mockResults, pairings, currentStandings, logicCode]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load current round pairings
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select(`
          *,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        `)
        .eq('tournament_id', tournamentId)
        .eq('round_number', currentRound)
        .order('table_number');

      if (pairingsError) throw pairingsError;
      setPairings(pairingsData as PairingWithPlayers[]);

      // Initialize mock results
      const initialMockResults: Record<string, MockResult> = {};
      pairingsData.forEach(pairing => {
        initialMockResults[pairing.id] = {
          pairingId: pairing.id,
          player1Score: 400,
          player2Score: 350,
          winnerId: pairing.player1_id
        };
      });
      setMockResults(initialMockResults);

      // Calculate current standings
      await calculateCurrentStandings();

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCurrentStandings = async () => {
    try {
      // Load all players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;

      // Load all results up to current round - 1
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select(`
          *,
          pairing:pairings!results_pairing_id_fkey(
            player1_id,
            player2_id,
            round_number
          )
        `)
        .eq('pairing.tournament_id', tournamentId)
        .lt('round_number', currentRound);

      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }

      const standings = calculateStandingsFromData(playersData, resultsData || []);
      setCurrentStandings(standings);

    } catch (err) {
      console.error('Error calculating current standings:', err);
      setError('Failed to calculate current standings');
    }
  };

  const calculateStandingsFromData = (players: Player[], results: any[]): PlayerStanding[] => {
    const standings: PlayerStanding[] = [];

    for (const player of players) {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;
      let gamesPlayed = 0;

      // Process each result
      for (const result of results) {
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
        rank: 0,
        rating: player.rating,
        wins,
        losses,
        draws,
        points,
        spread,
        gamesPlayed
      });
    }

    // Sort and assign ranks
    standings.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });

    standings.forEach((standing, index) => {
      standing.rank = index + 1;
    });

    return standings;
  };

  const simulateStandings = () => {
    try {
      // If we have the dynamic logic code from Supabase, use it
      if (logicCode && !isLogicLoading && !logicError) {
        try {
          // Create a safe function from the logic code
          const simulateFunction = new Function(
            'currentStandings', 
            'mockResults', 
            'pairings',
            logicCode
          );
          
          // Execute the function with our parameters
          const result = simulateFunction(currentStandings, mockResults, pairings);
          setSimulatedStandings(result);
          return;
        } catch (err) {
          console.error('Error executing standings impact logic:', err);
          // Fall back to static implementation
        }
      }
      
      // Fallback to static implementation
      // Clone current standings
      const simulatedData = currentStandings.map(standing => ({ ...standing }));

      // Apply mock results
      Object.values(mockResults).forEach(mockResult => {
        const pairing = pairings.find(p => p.id === mockResult.pairingId);
        if (!pairing) return;

        // Update player1
        const player1Standing = simulatedData.find(s => s.id === pairing.player1_id);
        if (player1Standing) {
          player1Standing.pointsFor = (player1Standing.pointsFor || 0) + mockResult.player1Score;
          player1Standing.pointsAgainst = (player1Standing.pointsAgainst || 0) + mockResult.player2Score;
          player1Standing.gamesPlayed++;

          if (mockResult.player1Score > mockResult.player2Score) {
            player1Standing.wins++;
          } else if (mockResult.player1Score < mockResult.player2Score) {
            player1Standing.losses++;
          } else {
            player1Standing.draws++;
          }

          player1Standing.points = player1Standing.wins + (player1Standing.draws * 0.5);
          player1Standing.spread = (player1Standing.pointsFor || 0) - (player1Standing.pointsAgainst || 0);
        }

        // Update player2
        const player2Standing = simulatedData.find(s => s.id === pairing.player2_id);
        if (player2Standing) {
          player2Standing.pointsFor = (player2Standing.pointsFor || 0) + mockResult.player2Score;
          player2Standing.pointsAgainst = (player2Standing.pointsAgainst || 0) + mockResult.player1Score;
          player2Standing.gamesPlayed++;

          if (mockResult.player2Score > mockResult.player1Score) {
            player2Standing.wins++;
          } else if (mockResult.player2Score < mockResult.player1Score) {
            player2Standing.losses++;
          } else {
            player2Standing.draws++;
          }

          player2Standing.points = player2Standing.wins + (player2Standing.draws * 0.5);
          player2Standing.spread = (player2Standing.pointsFor || 0) - (player2Standing.pointsAgainst || 0);
        }
      });

      // Re-sort and assign new ranks
      simulatedData.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.spread !== b.spread) return b.spread - a.spread;
        return b.rating - a.rating;
      });

      simulatedData.forEach((standing, index) => {
        const oldRank = standing.rank;
        standing.rank = index + 1;
        standing.rankChange = oldRank - standing.rank; // Positive = moved up, negative = moved down

        // Generate impact tags
        standing.impactTags = [];
        
        if (standing.rankChange && Math.abs(standing.rankChange) >= 3) {
          standing.impactTags.push(standing.rankChange > 0 ? 'Big Jump' : 'Big Drop');
        }
        
        if (standing.rank <= 3 && oldRank > 3) {
          standing.impactTags.push('Moves to Podium');
        }
        
        if (standing.rank > 3 && oldRank <= 3) {
          standing.impactTags.push('Falls from Podium');
        }
        
        if (standing.rank === 1 && oldRank !== 1) {
          standing.impactTags.push('Takes Lead');
        }
        
        if (standing.rank !== 1 && oldRank === 1) {
          standing.impactTags.push('Loses Lead');
        }

        // Check for mathematical elimination or clinching
        const remainingRounds = 7 - currentRound; // Assuming 7 rounds max
        const maxPossiblePoints = standing.points + remainingRounds;
        const currentLeaderPoints = simulatedData[0].points;
        
        if (standing.rank > 10 && maxPossiblePoints < currentLeaderPoints) {
          standing.impactTags.push('Eliminated from Contention');
        }
        
        if (standing.rank === 1 && standing.points > simulatedData[1].points + remainingRounds) {
          standing.impactTags.push('Clinches Tournament');
        }
      });

      setSimulatedStandings(simulatedData);
    } catch (err) {
      console.error('Error simulating standings:', err);
      setError('Failed to simulate standings');
    }
  };

  const handleScoreChange = (pairingId: string, field: 'player1Score' | 'player2Score', value: number) => {
    setMockResults(prev => {
      const updated = {
        ...prev,
        [pairingId]: {
          ...prev[pairingId],
          [field]: value
        }
      };

      // Update winner
      const result = updated[pairingId];
      const pairing = pairings.find(p => p.id === pairingId);
      if (pairing) {
        if (result.player1Score > result.player2Score) {
          result.winnerId = pairing.player1_id;
        } else if (result.player2Score > result.player1Score) {
          result.winnerId = pairing.player2_id;
        } else {
          result.winnerId = undefined;
        }
      }

      return updated;
    });
  };

  const resetSimulation = () => {
    const resetResults: Record<string, MockResult> = {};
    pairings.forEach(pairing => {
      resetResults[pairing.id] = {
        pairingId: pairing.id,
        player1Score: 400,
        player2Score: 350,
        winnerId: pairing.player1_id
      };
    });
    setMockResults(resetResults);
  };

  const saveScenario = () => {
    if (!scenarioName.trim()) return;

    const scenario: SimulationScenario = {
      name: scenarioName.trim(),
      description: `Simulation for Round ${currentRound}`,
      mockResults: { ...mockResults }
    };

    setSavedScenarios(prev => [...prev, scenario]);
    setScenarioName('');
  };

  const loadScenario = (scenario: SimulationScenario) => {
    setMockResults(scenario.mockResults);
  };

  const getRankChangeIcon = (change?: number) => {
    if (!change || change === 0) return null;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  const getRankChangeColor = (change?: number) => {
    if (!change || change === 0) return 'text-gray-400';
    if (change > 0) return 'text-green-400';
    return 'text-red-400';
  };

  const displayedStandings = showTopOnly ? simulatedStandings.slice(0, 10) : simulatedStandings;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-7xl max-h-[95vh] bg-gray-900/95 backdrop-blur-lg border-2 border-cyan-500/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-cyan-500/30 bg-gradient-to-r from-cyan-900/30 to-blue-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white font-orbitron">
                Standings Impact Visualizer
              </h2>
              <p className="text-cyan-300 font-jetbrains">
                Simulate Round {currentRound} outcomes and see ranking changes
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
        <div className="flex h-[calc(95vh-120px)]">
          {/* Left Panel: Mock Results Input */}
          <div className="w-1/2 p-6 border-r border-gray-700 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-orbitron">
                Simulate Results
              </h3>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={resetSimulation}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              </div>
            </div>

            {/* Scenario Management */}
            <div className="mb-6 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-3 font-jetbrains">Save/Load Scenarios</h4>
              
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Scenario name"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-jetbrains focus:border-cyan-500 focus:outline-none"
                />
                <button
                  onClick={saveScenario}
                  disabled={!scenarioName.trim()}
                  className="flex items-center gap-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded text-sm font-jetbrains transition-all duration-200"
                >
                  <Save size={14} />
                  Save
                </button>
              </div>

              {savedScenarios.length > 0 && (
                <div className="space-y-1">
                  {savedScenarios.map((scenario, index) => (
                    <button
                      key={index}
                      onClick={() => loadScenario(scenario)}
                      className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded text-sm font-jetbrains transition-all duration-200"
                    >
                      {scenario.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mock Results Table */}
            {isLoading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-400 font-jetbrains">
                {error}
              </div>
            ) : (
              <div className="space-y-4">
                {pairings.map((pairing) => {
                  const mockResult = mockResults[pairing.id];
                  if (!mockResult) return null;

                  return (
                    <div key={pairing.id} className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-mono font-bold">
                          Table {pairing.table_number}
                        </span>
                        <span className="text-xs text-gray-400 font-jetbrains">
                          {mockResult.winnerId === pairing.player1_id ? 'P1 Wins' :
                           mockResult.winnerId === pairing.player2_id ? 'P2 Wins' : 'Tie'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-white font-medium mb-1">
                            {pairing.player1.name}
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={mockResult.player1Score}
                            onChange={(e) => handleScoreChange(pairing.id, 'player1Score', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center font-mono focus:border-cyan-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <div className="text-sm text-white font-medium mb-1">
                            {pairing.player2.name}
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={mockResult.player2Score}
                            onChange={(e) => handleScoreChange(pairing.id, 'player2Score', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center font-mono focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Simulated Standings */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-orbitron">
                Projected Standings
              </h3>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTopOnly(!showTopOnly)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-jetbrains text-sm transition-all duration-200 ${
                    showTopOnly
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Eye size={14} />
                  {showTopOnly ? 'Show All' : 'Top 10 Only'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {displayedStandings.map((standing) => (
                <div
                  key={standing.id}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    standing.rankChange && standing.rankChange !== 0
                      ? 'bg-cyan-900/20 border-cyan-500/30'
                      : 'bg-gray-800/50 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white font-orbitron min-w-[40px]">
                          #{standing.rank}
                        </span>
                        {getRankChangeIcon(standing.rankChange)}
                        {standing.rankChange && standing.rankChange !== 0 && (
                          <span className={`text-sm font-jetbrains ${getRankChangeColor(standing.rankChange)}`}>
                            ({standing.rankChange > 0 ? '+' : ''}{standing.rankChange})
                          </span>
                        )}
                      </div>
                      
                      <div>
                        <div className="text-white font-medium">
                          {standing.name}
                        </div>
                        <div className="text-xs text-gray-400 font-jetbrains">
                          {standing.wins}-{standing.losses}-{standing.draws} • {standing.points} pts • {standing.spread > 0 ? '+' : ''}{standing.spread}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {standing.impactTags && standing.impactTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end mb-1">
                          {standing.impactTags.map((tag, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 rounded text-xs font-jetbrains ${
                                tag.includes('Clinches') || tag.includes('Takes Lead') || tag.includes('Podium') && tag.includes('Moves')
                                  ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                                  : tag.includes('Eliminated') || tag.includes('Falls') || tag.includes('Loses')
                                  ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                                  : tag.includes('Big')
                                  ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                                  : 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {simulatedStandings.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-400 font-jetbrains">
                Adjust the scores above to see projected standings changes
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400 font-jetbrains">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              These are simulations. Final standings depend on actual results.
            </div>
            
            <div className="text-sm text-cyan-400 font-jetbrains">
              Round {currentRound} Impact Analysis
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandingsImpactVisualizer;