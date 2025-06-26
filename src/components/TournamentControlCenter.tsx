import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  Trophy, 
  BarChart3, 
  Settings, 
  Share2, 
  Play, 
  Edit, 
  Plus, 
  Trash2, 
  Save,
  Copy,
  Check,
  Eye,
  EyeOff,
  Calendar,
  MapPin,
  Target,
  Zap
} from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import TournamentHeader from './TournamentHeader';
import PlayerDetailsModal from './PlayerDetailsModal';
import { supabase } from '../lib/supabase';
import { Tournament, Player, PairingWithPlayers, Result, Division } from '../types/database';

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

const TournamentControlCenter: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pairings, setPairings] = useState<Record<number, RoundPairing[]>>({});
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [activeTab, setActiveTab] = useState<'pairings' | 'results' | 'standings' | 'players' | 'public' | 'settings'>('pairings');
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Player management state
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRating, setNewPlayerRating] = useState(1500);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerRating, setEditPlayerRating] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  
  // Public link state
  const [publicUrl, setPublicUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  
  // Settings state
  const [editingTournament, setEditingTournament] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    date: '',
    venue: '',
    rounds: 7,
    pairing_system: 'swiss'
  });

  useEffect(() => {
    if (tournamentId) {
      loadTournamentData();
    }
  }, [tournamentId]);

  useEffect(() => {
    if (tournament) {
      setPublicUrl(`${window.location.origin}/t/${tournament.id}`);
      setCurrentRound(tournament.current_round || 1);
      setMaxRounds(tournament.rounds || 7);
      setTournamentForm({
        name: tournament.name,
        date: tournament.date || '',
        venue: tournament.venue || '',
        rounds: tournament.rounds || 7,
        pairing_system: tournament.pairing_system || 'swiss'
      });
    }
  }, [tournament]);

  const loadTournamentData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user has access to this tournament
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to access this tournament');
        return;
      }

      // Load tournament with director check
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .eq('director_id', user.id)
        .single();

      if (tournamentError) {
        if (tournamentError.code === 'PGRST116') {
          setError('Tournament not found or you do not have permission to access it');
        } else {
          throw tournamentError;
        }
        return;
      }

      setTournament(tournamentData);

      // Load divisions
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('division_number');

      if (divisionsError && divisionsError.code !== 'PGRST116') {
        throw divisionsError;
      }
      setDivisions(divisionsData || []);

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      // Load all pairings
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select(`
          *,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        `)
        .eq('tournament_id', tournamentId)
        .order('round_number')
        .order('table_number');

      if (pairingsError && pairingsError.code !== 'PGRST116') {
        throw pairingsError;
      }

      // Load all results
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }

      // Group pairings by round and attach results
      const pairingsByRound: Record<number, RoundPairing[]> = {};
      (pairingsData || []).forEach(pairing => {
        if (!pairingsByRound[pairing.round_number]) {
          pairingsByRound[pairing.round_number] = [];
        }
        
        const result = resultsData?.find(r => r.pairing_id === pairing.id);
        pairingsByRound[pairing.round_number].push({
          ...pairing,
          result
        } as RoundPairing);
      });

      setPairings(pairingsByRound);

      // Calculate standings
      const calculatedStandings = calculateStandings(playersData || [], resultsData || []);
      setStandings(calculatedStandings);

    } catch (err) {
      console.error('Error loading tournament data:', err);
      setError('Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStandings = (players: Player[], results: Result[]): PlayerStanding[] => {
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
        // Find the pairing for this result
        const allPairings = Object.values(pairings).flat();
        const pairing = allPairings.find(p => p.id === result.pairing_id);
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

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      setError('Player name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('players')
        .insert([{
          name: newPlayerName.trim(),
          rating: newPlayerRating,
          tournament_id: tournamentId
        }]);

      if (insertError) throw insertError;

      setNewPlayerName('');
      setNewPlayerRating(1500);
      setShowAddPlayer(false);
      setSuccessMessage('Player added successfully');
      
      // Reload data
      await loadTournamentData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error adding player:', err);
      setError('Failed to add player');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPlayer = async (playerId: string) => {
    if (!editPlayerName.trim()) {
      setError('Player name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('players')
        .update({
          name: editPlayerName.trim(),
          rating: editPlayerRating
        })
        .eq('id', playerId);

      if (updateError) throw updateError;

      setEditingPlayer(null);
      setSuccessMessage('Player updated successfully');
      
      // Reload data
      await loadTournamentData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating player:', err);
      setError('Failed to update player');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this player? This will also remove all their pairings and results.')) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (deleteError) throw deleteError;

      setSuccessMessage('Player deleted successfully');
      
      // Reload data
      await loadTournamentData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting player:', err);
      setError('Failed to delete player');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert(`Tournament link: ${publicUrl}`);
    }
  };

  const handleUpdateTournament = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          name: tournamentForm.name.trim(),
          date: tournamentForm.date || null,
          venue: tournamentForm.venue.trim() || null,
          rounds: tournamentForm.rounds,
          pairing_system: tournamentForm.pairing_system
        })
        .eq('id', tournamentId);

      if (updateError) throw updateError;

      setEditingTournament(false);
      setSuccessMessage('Tournament updated successfully');
      
      // Reload data
      await loadTournamentData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating tournament:', err);
      setError('Failed to update tournament');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setShowPlayerModal(true);
  };

  const navigateToRoundManager = () => {
    navigate(`/tournament/${tournamentId}/round-manager`);
  };

  const navigateToScoreEntry = () => {
    navigate(`/tournament/${tournamentId}/score-entry`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4 font-orbitron">Access Denied</h1>
          <p className="text-gray-300 mb-8">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains transition-all duration-200 mx-auto"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      <ParticleBackground />
      
      {/* Tournament Header */}
      {tournament && (
        <TournamentHeader
          tournament={tournament}
          division={divisions[0]}
          showDivision={divisions.length > 1}
          variant="default"
        />
      )}
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Navigation */}
        <div className="max-w-7xl mx-auto w-full mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft size={20} />
              <span className="font-jetbrains">Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-2 text-blue-400">
              <Target size={24} />
              <span className="font-jetbrains text-sm">Tournament Control Center</span>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="text-center mb-12 max-w-7xl mx-auto">
          <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
              data-text="CONTROL CENTER">
            🎯 CONTROL CENTER
          </h1>
          
          {tournament && (
            <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-blue-400 mb-4 font-medium">
              {tournament.name}
            </p>
          )}
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Complete tournament management dashboard
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 mx-auto rounded-full"></div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="max-w-7xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="max-w-7xl mx-auto w-full mb-8">
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 text-green-300 font-jetbrains text-sm">
              {successMessage}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="fade-up fade-up-delay-4 max-w-7xl mx-auto w-full mb-8">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-2 backdrop-blur-sm">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'pairings', label: 'Generate Pairings', icon: Play },
                { key: 'results', label: 'Enter Results', icon: Trophy },
                { key: 'standings', label: 'View Standings', icon: BarChart3 },
                { key: 'players', label: 'Manage Players', icon: Users },
                { key: 'public', label: 'Public Link', icon: Share2 },
                { key: 'settings', label: 'Settings', icon: Settings }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-jetbrains font-medium transition-all duration-300 ${
                    activeTab === key
                      ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="fade-up fade-up-delay-5 max-w-7xl mx-auto w-full mb-8">
          {/* Generate Pairings Tab */}
          {activeTab === 'pairings' && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white font-orbitron mb-6 flex items-center gap-2">
                <Play size={24} />
                Generate Pairings
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Current Round: {currentRound}</h3>
                  <p className="text-gray-400 font-jetbrains mb-6">
                    Generate pairings for Round {currentRound} using your tournament's pairing system.
                  </p>
                  
                  <button
                    onClick={navigateToRoundManager}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                  >
                    <Zap size={16} />
                    Open Round Manager
                  </button>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Tournament Progress</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Current Round:</span>
                      <span className="text-white">{currentRound} of {maxRounds}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Players:</span>
                      <span className="text-white">{players.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Pairing System:</span>
                      <span className="text-white capitalize">{tournament?.pairing_system || 'Swiss'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enter Results Tab */}
          {activeTab === 'results' && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white font-orbitron mb-6 flex items-center gap-2">
                <Trophy size={24} />
                Enter Results
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Score Entry</h3>
                  <p className="text-gray-400 font-jetbrains mb-6">
                    Enter scores for Round {currentRound} pairings and update standings.
                  </p>
                  
                  <button
                    onClick={navigateToScoreEntry}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                  >
                    <Edit size={16} />
                    Open Score Entry
                  </button>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Round {currentRound} Status</h4>
                  <div className="space-y-2">
                    {pairings[currentRound] ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Total Pairings:</span>
                          <span className="text-white">{pairings[currentRound].length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Results Entered:</span>
                          <span className="text-white">
                            {pairings[currentRound].filter(p => p.result).length}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Pending:</span>
                          <span className="text-yellow-400">
                            {pairings[currentRound].filter(p => !p.result).length}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm">No pairings generated for this round yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View Standings Tab */}
          {activeTab === 'standings' && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                  <BarChart3 size={24} />
                  Current Standings
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">W-L-D</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Points</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Spread</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Games</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {standings.map((standing) => (
                      <tr 
                        key={standing.id} 
                        className="hover:bg-gray-800/30 transition-colors duration-200"
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-lg font-bold text-white font-orbitron">
                            #{standing.rank}
                          </span>
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handlePlayerClick(standing.id)}
                            className="text-left hover:text-blue-300 transition-colors duration-200"
                          >
                            <div className="text-sm font-medium text-white">
                              {standing.name}
                            </div>
                            <div className="text-xs text-gray-400 font-jetbrains">
                              Rating: {standing.rating}
                            </div>
                          </button>
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <div className="font-mono text-sm text-white">
                            <span className="text-green-400">{standing.wins}</span>–
                            <span className="text-red-400">{standing.losses}</span>–
                            <span className="text-yellow-400">{standing.draws}</span>
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <span className="text-lg font-bold text-white font-orbitron">
                            {standing.points}
                          </span>
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <span className={`font-mono text-sm ${
                            standing.spread > 0 ? 'text-green-400' : 
                            standing.spread < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {standing.spread > 0 ? '+' : ''}{standing.spread}
                          </span>
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-300 font-mono">
                            {standing.gamesPlayed}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {standings.length === 0 && (
                <div className="text-center py-12 text-gray-400 font-jetbrains">
                  No standings available yet. Enter some results to see standings.
                </div>
              )}
            </div>
          )}

          {/* Manage Players Tab */}
          {activeTab === 'players' && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                  <Users size={24} />
                  Manage Players ({players.length})
                </h2>
                
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  <Plus size={16} />
                  Add Player
                </button>
              </div>
              
              {/* Add Player Form */}
              {showAddPlayer && (
                <div className="p-6 border-b border-gray-700 bg-gray-800/30">
                  <h3 className="text-lg font-medium text-white mb-4">Add New Player</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player name"
                      className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={newPlayerRating}
                      onChange={(e) => setNewPlayerRating(parseInt(e.target.value) || 1500)}
                      placeholder="Rating"
                      className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddPlayer}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                      >
                        <Save size={16} />
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddPlayer(false)}
                        className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Name</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rating</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Games</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {players.map((player) => {
                      const playerStanding = standings.find(s => s.id === player.id);
                      
                      return (
                        <tr key={player.id} className="hover:bg-gray-800/30 transition-colors duration-200">
                          <td className="px-4 py-4 whitespace-nowrap">
                            {editingPlayer === player.id ? (
                              <input
                                type="text"
                                value={editPlayerName}
                                onChange={(e) => setEditPlayerName(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                              />
                            ) : (
                              <button
                                onClick={() => handlePlayerClick(player.id!)}
                                className="text-left hover:text-blue-300 transition-colors duration-200"
                              >
                                <div className="text-sm font-medium text-white">
                                  {player.name}
                                </div>
                              </button>
                            )}
                          </td>
                          
                          <td className="px-4 py-4 text-center">
                            {editingPlayer === player.id ? (
                              <input
                                type="number"
                                value={editPlayerRating}
                                onChange={(e) => setEditPlayerRating(parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-center font-mono focus:border-blue-500 focus:outline-none"
                              />
                            ) : (
                              <span className="text-sm text-gray-300 font-mono">
                                {player.rating}
                              </span>
                            )}
                          </td>
                          
                          <td className="px-4 py-4 text-center">
                            <span className="text-sm text-gray-300 font-mono">
                              {playerStanding?.gamesPlayed || 0}
                            </span>
                          </td>
                          
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {editingPlayer === player.id ? (
                                <>
                                  <button
                                    onClick={() => handleEditPlayer(player.id!)}
                                    disabled={isSaving}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-jetbrains transition-all duration-200"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingPlayer(null)}
                                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-jetbrains transition-all duration-200"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingPlayer(player.id!);
                                      setEditPlayerName(player.name);
                                      setEditPlayerRating(player.rating);
                                    }}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-jetbrains transition-all duration-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeletePlayer(player.id!)}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-jetbrains transition-all duration-200"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {players.length === 0 && (
                <div className="text-center py-12 text-gray-400 font-jetbrains">
                  No players registered yet. Add some players to get started.
                </div>
              )}
            </div>
          )}

          {/* Public Link Tab */}
          {activeTab === 'public' && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white font-orbitron mb-6 flex items-center gap-2">
                <Share2 size={24} />
                Public Tournament Link
              </h2>
              
              <div className="space-y-6">
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Tournament URL</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Published:</span>
                      <button
                        onClick={() => setIsPublished(!isPublished)}
                        className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                          isPublished ? 'bg-green-600' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                          isPublished ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      value={publicUrl}
                      readOnly
                      className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:outline-none"
                    />
                    <button
                      onClick={handleCopyPublicLink}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                        linkCopied
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {linkCopied ? (
                        <>
                          <Check size={16} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-blue-300 font-medium mb-2 flex items-center gap-2">
                      <Eye size={16} />
                      Public Features
                    </h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Live tournament standings</li>
                      <li>• Round pairings and results</li>
                      <li>• Player statistics</li>
                      <li>• Tournament information</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <h4 className="text-green-300 font-medium mb-2 flex items-center gap-2">
                      <Users size={16} />
                      Share With
                    </h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Tournament participants</li>
                      <li>• Spectators and supporters</li>
                      <li>• Tournament organizers</li>
                      <li>• Social media followers</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                  <Settings size={24} />
                  Tournament Settings
                </h2>
                
                {!editingTournament && (
                  <button
                    onClick={() => setEditingTournament(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                  >
                    <Edit size={16} />
                    Edit Tournament
                  </button>
                )}
              </div>
              
              {editingTournament ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                        Tournament Name
                      </label>
                      <input
                        type="text"
                        value={tournamentForm.name}
                        onChange={(e) => setTournamentForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Date
                      </label>
                      <input
                        type="date"
                        value={tournamentForm.date}
                        onChange={(e) => setTournamentForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                        <MapPin className="w-4 h-4 inline mr-2" />
                        Venue
                      </label>
                      <input
                        type="text"
                        value={tournamentForm.venue}
                        onChange={(e) => setTournamentForm(prev => ({ ...prev, venue: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                        placeholder="Tournament venue"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                        Number of Rounds
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={tournamentForm.rounds}
                        onChange={(e) => setTournamentForm(prev => ({ ...prev, rounds: parseInt(e.target.value) || 7 }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                        Pairing System
                      </label>
                      <select
                        value={tournamentForm.pairing_system}
                        onChange={(e) => setTournamentForm(prev => ({ ...prev, pairing_system: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                      >
                        <option value="swiss">Swiss</option>
                        <option value="fonte-swiss">Fonte-Swiss</option>
                        <option value="king-of-hill">King of the Hill</option>
                        <option value="round-robin">Round Robin</option>
                        <option value="quartile">Quartile</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-4">
                    <button
                      onClick={() => setEditingTournament(false)}
                      className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateTournament}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-gray-400 text-sm">Tournament Name:</span>
                      <div className="text-white font-medium">{tournament?.name}</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Date:</span>
                      <div className="text-white font-medium">
                        {tournament?.date ? new Date(tournament.date).toLocaleDateString() : 'Not set'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Venue:</span>
                      <div className="text-white font-medium">{tournament?.venue || 'Not set'}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <span className="text-gray-400 text-sm">Rounds:</span>
                      <div className="text-white font-medium">{tournament?.rounds || 7}</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Pairing System:</span>
                      <div className="text-white font-medium capitalize">
                        {tournament?.pairing_system?.replace('-', '-') || 'Swiss'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Status:</span>
                      <div className="text-white font-medium capitalize">{tournament?.status}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Tournament Control Center • Complete management dashboard
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Player Details Modal */}
      {selectedPlayerId && (
        <PlayerDetailsModal
          isOpen={showPlayerModal}
          onClose={() => {
            setShowPlayerModal(false);
            setSelectedPlayerId(null);
          }}
          playerId={selectedPlayerId}
          tournamentId={tournamentId!}
        />
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-cyan-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default TournamentControlCenter;