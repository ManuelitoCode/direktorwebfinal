import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Lock, Users, Settings, Crown, Zap, Info, Target, Brain, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import StandingsImpactVisualizer from './StandingsImpactVisualizer';
import { supabase } from '../lib/supabase';
import { Tournament, Player, PlayerWithRank, PairingDisplay, PairingFormat, Pairing } from '../types/database';
import { generatePairings } from '../utils/pairingAlgorithms';
import { 
  analyzePairingSystem, 
  recommendPairingSystem, 
  getQuickRecommendations,
  formatGoalScore,
  PAIRING_GOALS 
} from '../utils/pairingStrategyIntelligence';

interface RoundManagerProps {
  onBack: () => void;
  onNext: () => void;
  tournamentId: string;
}

const RoundManager: React.FC<RoundManagerProps> = ({ onBack, onNext, tournamentId }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<PlayerWithRank[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds] = useState(7); // Default to 7 rounds
  const [pairingFormat, setPairingFormat] = useState<PairingFormat>('swiss');
  const [avoidRematches, setAvoidRematches] = useState(true);
  const [enableGibsonization, setEnableGibsonization] = useState(true);
  const [pairings, setPairings] = useState<PairingDisplay[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStrategyAnalysis, setShowStrategyAnalysis] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showImpactVisualizer, setShowImpactVisualizer] = useState(false);

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId]);

  const loadTournamentData = async () => {
    try {
      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);
      setCurrentRound(tournamentData.current_round || 1);

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;

      // Calculate player statistics and previous starts
      const playersWithStats = await Promise.all(
        playersData.map(async (player) => {
          // Get previous starts for each player
          const { data: startsData } = await supabase
            .from('pairings')
            .select('first_move_player_id')
            .eq('tournament_id', tournamentId)
            .eq('first_move_player_id', player.id);

          // Get all results for this player to calculate wins/losses/draws
          const { data: resultsData } = await supabase
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

          let wins = 0;
          let losses = 0;
          let draws = 0;
          let pointsFor = 0;
          let pointsAgainst = 0;

          // Process each result
          for (const result of resultsData || []) {
            const pairing = result.pairing;
            if (!pairing) continue;

            const isPlayer1 = pairing.player1_id === player.id;
            const isPlayer2 = pairing.player2_id === player.id;

            if (!isPlayer1 && !isPlayer2) continue;

            const playerScore = isPlayer1 ? result.player1_score : result.player2_score;
            const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;

            pointsFor += playerScore;
            pointsAgainst += opponentScore;

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

          return {
            ...player,
            rank: 0, // Will be set in pairing generation
            previous_starts: startsData?.length || 0,
            wins,
            losses,
            draws,
            points,
            spread,
            is_gibsonized: false // Will be calculated in pairing generation
          } as PlayerWithRank;
        })
      );

      setPlayers(playersWithStats);
    } catch (err) {
      console.error('Error loading tournament data:', err);
      setError('Failed to load tournament data');
    }
  };

  const handleGeneratePairings = async () => {
    if (players.length < 2) {
      setError('Need at least 2 players to generate pairings');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Get previous pairings for rematch avoidance
      const { data: previousPairings } = await supabase
        .from('pairings')
        .select('player1_id, player2_id')
        .eq('tournament_id', tournamentId);

      const newPairings = generatePairings(
        players,
        pairingFormat,
        avoidRematches,
        previousPairings || [],
        currentRound,
        maxRounds
      );

      setPairings(newPairings);
    } catch (err) {
      console.error('Error generating pairings:', err);
      setError('Failed to generate pairings');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLockPairings = async () => {
    if (pairings.length === 0) {
      setError('No pairings to save');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Delete existing pairings for this round
      await supabase
        .from('pairings')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('round_number', currentRound);

      // Insert new pairings
      const pairingsToInsert: Omit<Pairing, 'id' | 'created_at'>[] = pairings
        .filter(p => p.player2.id !== 'bye') // Exclude bye pairings
        .map(pairing => ({
          round_number: currentRound,
          tournament_id: tournamentId,
          table_number: pairing.table_number,
          player1_id: pairing.player1.id!,
          player2_id: pairing.player2.id!,
          player1_rank: pairing.player1.rank,
          player2_rank: pairing.player2.rank,
          first_move_player_id: pairing.first_move_player_id,
          player1_gibsonized: pairing.player1_gibsonized || false,
          player2_gibsonized: pairing.player2_gibsonized || false
        }));

      const { error: insertError } = await supabase
        .from('pairings')
        .insert(pairingsToInsert);

      if (insertError) throw insertError;

      // Navigate to Score Entry screen
      onNext();
    } catch (err) {
      console.error('Error saving pairings:', err);
      setError('Failed to save pairings');
    } finally {
      setIsSaving(false);
    }
  };

  const getPairingFormatDescription = (format: PairingFormat): string => {
    switch (format) {
      case 'swiss':
        return 'Standard Swiss system - pair players with similar records';
      case 'fonte-swiss':
        return 'Group by wins, pair top half vs bottom half within each group';
      case 'king-of-hill':
        return 'Pair highest ranked vs lowest ranked players';
      case 'round-robin':
        return 'Each player plays every other player once';
      case 'quartile':
        return 'Split into quartiles, pair 1st vs 2nd, 3rd vs 4th';
      case 'manual':
        return 'Manual pairing - set up matches yourself';
      default:
        return 'Select a pairing format';
    }
  };

  const getGibsonizedTooltip = () => {
    return "Gibsonized players are mathematically guaranteed a prize position. They are paired together or with non-contenders to maintain competitive balance.";
  };

  const getGibsonizationBanner = () => {
    const gibsonizedCount = pairings.filter(p => p.player1_gibsonized || p.player2_gibsonized).length;
    if (gibsonizedCount === 0) return null;

    const gibsonizedPlayers = pairings
      .flatMap(p => [
        p.player1_gibsonized ? p.player1.name : null,
        p.player2_gibsonized ? p.player2.name : null
      ])
      .filter(Boolean);

    return (
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Crown size={20} className="text-yellow-400" />
          <span className="text-yellow-400 font-orbitron font-bold">Gibsonization Active</span>
        </div>
        <p className="text-yellow-300 font-jetbrains text-sm mb-2">
          This pairing uses Gibsonization to maintain tournament fairness. 
          {gibsonizedPlayers.length === 1 
            ? `Player ${gibsonizedPlayers[0]} has secured a prize position mathematically.`
            : `Players ${gibsonizedPlayers.slice(0, -1).join(', ')} and ${gibsonizedPlayers[gibsonizedPlayers.length - 1]} have secured prize positions mathematically.`
          }
        </p>
        <p className="text-yellow-200 font-jetbrains text-xs">
          Gibsonized players are paired to prevent impact on remaining prize contention while maintaining competitive integrity.
        </p>
      </div>
    );
  };

  // Get strategy analysis for current format
  const currentAnalysis = analyzePairingSystem(pairingFormat, players.length, maxRounds);
  
  // Get quick recommendations
  const quickRecs = getQuickRecommendations();

  // Get intelligent recommendations based on current context
  const intelligentRec = recommendPairingSystem({
    primary: 'balanced',
    playerCount: players.length,
    rounds: maxRounds,
    competitiveLevel: tournament?.status === 'active' ? 'competitive' : 'casual',
    priorityGoals: ['fairness', 'suspense', 'implementability']
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft size={20} />
              <span className="font-jetbrains">Back</span>
            </button>
            <div className="flex items-center gap-2 text-green-400">
              <Play size={24} />
              <span className="font-jetbrains text-sm">Round Manager</span>
            </div>
          </div>

          <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
              data-text="ROUND MANAGER">
            ROUND MANAGER
          </h1>
          
          {tournament && (
            <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-blue-400 mb-4 font-medium">
              {tournament.name}
            </p>
          )}
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Generate pairings with Gibsonization and advanced algorithms
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto rounded-full"></div>
        </div>

        {/* Round Controls */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                <Settings size={24} />
                Round Controls
              </h2>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowImpactVisualizer(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600/20 border border-orange-500/50 text-orange-400 hover:bg-orange-600/30 hover:text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  <BarChart3 size={16} />
                  Impact Simulator
                </button>

                <button
                  onClick={() => setShowRecommendations(!showRecommendations)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                    showRecommendations
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/30'
                  }`}
                >
                  <Brain size={16} />
                  AI Recommendations
                </button>
                
                <button
                  onClick={() => setShowStrategyAnalysis(!showStrategyAnalysis)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                    showStrategyAnalysis
                      ? 'bg-cyan-600 text-white'
                      : 'bg-cyan-600/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-600/30'
                  }`}
                >
                  <TrendingUp size={16} />
                  Strategy Analysis
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Round Selection */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Select Round
                </label>
                <select
                  value={currentRound}
                  onChange={(e) => setCurrentRound(parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
                >
                  {Array.from({ length: maxRounds }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Round {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pairing Format */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Pairing Format
                </label>
                <select
                  value={pairingFormat}
                  onChange={(e) => setPairingFormat(e.target.value as PairingFormat)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
                >
                  <option value="swiss">Swiss</option>
                  <option value="fonte-swiss">Fonte-Swiss</option>
                  <option value="king-of-hill">King of the Hill</option>
                  <option value="round-robin">Round Robin</option>
                  <option value="quartile">Quartile</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              {/* Avoid Rematches Toggle */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Avoid Rematches
                </label>
                <button
                  onClick={() => setAvoidRematches(!avoidRematches)}
                  className={`w-full px-4 py-3 rounded-lg font-jetbrains font-medium transition-all duration-300 ${
                    avoidRematches
                      ? 'bg-green-600 text-white border border-green-500'
                      : 'bg-gray-800 text-gray-400 border border-gray-600'
                  }`}
                >
                  {avoidRematches ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Gibsonization Toggle */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Enable Gibsonization
                </label>
                <button
                  onClick={() => setEnableGibsonization(!enableGibsonization)}
                  className={`w-full px-4 py-3 rounded-lg font-jetbrains font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                    enableGibsonization
                      ? 'bg-yellow-600 text-white border border-yellow-500'
                      : 'bg-gray-800 text-gray-400 border border-gray-600'
                  }`}
                >
                  <Crown size={16} />
                  {enableGibsonization ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Generate Button */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Generate
                </label>
                <button
                  onClick={handleGeneratePairings}
                  disabled={isGenerating || players.length < 2}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-jetbrains font-medium transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>

            {/* Format Description */}
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 font-jetbrains text-sm">
                <strong>{pairingFormat.charAt(0).toUpperCase() + pairingFormat.slice(1).replace('-', '-')}:</strong> {getPairingFormatDescription(pairingFormat)}
              </p>
            </div>

            {/* Current Round Display */}
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 bg-gray-800/50 border border-blue-500/30 rounded-lg px-6 py-3">
                <Users size={20} className="text-blue-400" />
                <span className="text-white font-orbitron font-medium">
                  Current Round: {currentRound}
                </span>
                <span className="text-gray-400 font-jetbrains">
                  ({players.length} players)
                </span>
                {enableGibsonization && (
                  <>
                    <span className="text-gray-500">•</span>
                    <Crown size={16} className="text-yellow-400" />
                    <span className="text-yellow-400 font-jetbrains text-sm">
                      Gibsonization Enabled
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendations Panel */}
        {showRecommendations && (
          <div className="fade-up max-w-6xl mx-auto w-full mb-8">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-6">
                <Brain size={24} className="text-purple-400" />
                <h3 className="text-xl font-bold text-white font-orbitron">AI Strategy Recommendations</h3>
              </div>

              {/* Quick Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {Object.entries(quickRecs).map(([key, rec]) => (
                  <button
                    key={key}
                    onClick={() => setPairingFormat(rec.format)}
                    className={`p-4 rounded-lg border transition-all duration-200 text-left ${
                      pairingFormat === rec.format
                        ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                        : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="font-jetbrains font-medium mb-2 text-sm">
                      {key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      → {rec.format.charAt(0).toUpperCase() + rec.format.slice(1).replace('-', '-')}
                    </div>
                    <div className="text-xs">
                      {rec.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Intelligent Recommendation */}
              <div className="bg-gray-800/50 border border-purple-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={16} className="text-purple-400" />
                  <span className="font-jetbrains font-medium text-purple-300">Recommended for Your Tournament</span>
                </div>
                <div className="text-white font-orbitron font-bold mb-2">
                  {intelligentRec.primary.charAt(0).toUpperCase() + intelligentRec.primary.slice(1).replace('-', '-')}
                </div>
                <div className="text-gray-300 font-jetbrains text-sm mb-3">
                  {intelligentRec.reasoning}
                </div>
                {intelligentRec.warnings.length > 0 && (
                  <div className="flex items-start gap-2 text-yellow-400 text-xs">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                    <span>{intelligentRec.warnings[0]}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Strategy Analysis Panel */}
        {showStrategyAnalysis && (
          <div className="fade-up max-w-6xl mx-auto w-full mb-8">
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp size={24} className="text-cyan-400" />
                  <h3 className="text-xl font-bold text-white font-orbitron">
                    Strategy Analysis: {pairingFormat.charAt(0).toUpperCase() + pairingFormat.slice(1).replace('-', '-')}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-orbitron">
                    {currentAnalysis.overallScore}/10
                  </div>
                  <div className="text-xs text-gray-400 font-jetbrains">Overall Score</div>
                </div>
              </div>

              {/* Goals Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {Object.entries(currentAnalysis.goals).map(([goalId, analysis]) => {
                  const goal = PAIRING_GOALS[goalId];
                  const scoreFormat = formatGoalScore(analysis.score);
                  
                  return (
                    <div key={goalId} className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-jetbrains font-medium text-white">
                          {goal?.name}
                        </div>
                        <div className={`text-lg font-bold font-orbitron ${scoreFormat.color}`}>
                          {analysis.score}/10
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
                        {goal?.description}
                      </div>
                      <div className="text-xs text-gray-300">
                        {analysis.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Strengths and Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-jetbrains font-medium text-green-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    Strengths
                  </h4>
                  <ul className="space-y-2">
                    {currentAnalysis.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-gray-300 font-jetbrains">
                        • {strength}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-jetbrains font-medium text-red-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    Weaknesses
                  </h4>
                  <ul className="space-y-2">
                    {currentAnalysis.weaknesses.map((weakness, index) => (
                      <li key={index} className="text-sm text-gray-300 font-jetbrains">
                        • {weakness}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Best For / Avoid If */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="font-jetbrains font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    Best For
                  </h4>
                  <ul className="space-y-2">
                    {currentAnalysis.bestFor.map((scenario, index) => (
                      <li key={index} className="text-sm text-gray-300 font-jetbrains">
                        • {scenario}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-jetbrains font-medium text-yellow-400 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    Avoid If
                  </h4>
                  <ul className="space-y-2">
                    {currentAnalysis.avoidIf.map((scenario, index) => (
                      <li key={index} className="text-sm text-gray-300 font-jetbrains">
                        • {scenario}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Gibsonization Banner */}
        {pairings.length > 0 && getGibsonizationBanner()}

        {/* Pairings Table */}
        {pairings.length > 0 && (
          <div className="fade-up max-w-6xl mx-auto w-full mb-8">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                  <Users size={24} />
                  Round {currentRound} Pairings
                  {pairings.some(p => p.player1_gibsonized || p.player2_gibsonized) && (
                    <div className="relative group">
                      <Crown size={20} className="text-yellow-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 border border-gray-600">
                        {getGibsonizedTooltip()}
                      </div>
                    </div>
                  )}
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Table</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 1</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">VS</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 2</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">First Move</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {pairings.map((pairing) => (
                      <tr key={pairing.table_number} className="bg-gray-900/30 hover:bg-gray-800/30 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono font-bold">
                          {pairing.table_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {pairing.first_move_player_id === pairing.player1.id && (
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            )}
                            {pairing.player1_gibsonized && (
                              <div className="relative group">
                                <Crown size={16} className="text-yellow-400" />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 border border-gray-600">
                                  Gibsonized
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-white">
                                {pairing.player1.name}
                                {pairing.player1_gibsonized && (
                                  <span className="ml-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-xs rounded font-jetbrains">
                                    Gibsonized
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 font-jetbrains">
                                #{pairing.player1.rank} • {pairing.player1.rating} • {pairing.player1.points}pts ({pairing.player1.wins}-{pairing.player1.losses}-{pairing.player1.draws})
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-gray-500 font-bold">VS</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {pairing.first_move_player_id === pairing.player2.id && (
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            )}
                            {pairing.player2_gibsonized && (
                              <div className="relative group">
                                <Crown size={16} className="text-yellow-400" />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 border border-gray-600">
                                  Gibsonized
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-white">
                                {pairing.player2.name}
                                {pairing.player2_gibsonized && (
                                  <span className="ml-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-xs rounded font-jetbrains">
                                    Gibsonized
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 font-jetbrains">
                                #{pairing.player2.rank} • {pairing.player2.rating} • {pairing.player2.points}pts ({pairing.player2.wins}-{pairing.player2.losses}-{pairing.player2.draws})
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-400 font-jetbrains">
                              {pairing.first_move_player_id === pairing.player1.id 
                                ? pairing.player1.name 
                                : pairing.player2.name}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Lock Pairings Button */}
        {pairings.length > 0 && (
          <div className="fade-up text-center mb-8">
            <Button
              icon={Lock}
              label={isSaving ? 'Saving Pairings...' : 'Lock Pairings & Proceed to Scoring'}
              onClick={handleLockPairings}
              variant="green"
              className="max-w-md mx-auto"
              disabled={isSaving}
            />
          </div>
        )}

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            {pairingFormat.charAt(0).toUpperCase() + pairingFormat.slice(1).replace('-', '-')} Pairing System with Gibsonization & AI Strategy Intelligence
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Standings Impact Visualizer Modal */}
      <StandingsImpactVisualizer
        isOpen={showImpactVisualizer}
        onClose={() => setShowImpactVisualizer(false)}
        tournamentId={tournamentId}
        currentRound={currentRound}
      />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-green-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default RoundManager;