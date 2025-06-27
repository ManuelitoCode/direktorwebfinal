import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Users, Trophy, Calendar, MapPin, Download, ChevronDown, Copy, Check, Share2, Lock, Facebook, Twitter, Mail } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import PlayerDetailsModal from './PlayerDetailsModal';
import TournamentHeader from './TournamentHeader';
import { supabase } from '../lib/supabase';
import { Tournament, Division, Player, PairingWithPlayers, Result } from '../types/database';
import { useAuditLog } from '../hooks/useAuditLog';

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

const PublicTournamentView: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<number>(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pairings, setPairings] = useState<Record<number, RoundPairing[]>>({});
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [maxRounds, setMaxRounds] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'pairings' | 'standings'>('players');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const publicUrlRef = useRef<string>('');
  
  const { logAction } = useAuditLog();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (tournamentId) {
      checkTournamentAccess();
    }
  }, [tournamentId]);

  useEffect(() => {
    if (divisions.length > 0 && isPasswordVerified) {
      loadDivisionData();
    }
  }, [selectedDivision, divisions, isPasswordVerified]);

  const checkTournamentAccess = async () => {
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
      setMaxRounds(tournamentData.rounds || 7);
      
      // Set public URL for sharing
      publicUrlRef.current = `${window.location.origin}/t/${tournamentId}`;

      // Check if password protected
      if (tournamentData.password) {
        setIsPasswordProtected(true);
        // If not password verified yet, stop loading other data
        if (!isPasswordVerified) {
          setIsLoading(false);
          return;
        }
      } else {
        // Not password protected, mark as verified
        setIsPasswordVerified(true);
      }

      // Log view action
      logAction({
        action: 'tournament_viewed',
        details: {
          tournament_id: tournamentId,
          tournament_name: tournamentData.name
        }
      });

      // Load divisions
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('division_number');

      if (divisionsError && divisionsError.code !== 'PGRST116') {
        throw divisionsError;
      }

      // If no divisions found, create a default one
      if (!divisionsData || divisionsData.length === 0) {
        setDivisions([{
          id: 'default',
          tournament_id: tournamentId!,
          name: 'Main Division',
          division_number: 1
        }]);
      } else {
        setDivisions(divisionsData);
      }

    } catch (err) {
      console.error('Error loading tournament data:', err);
      setError('Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPassword = () => {
    if (!tournament) return;
    
    setPasswordError(null);
    
    if (passwordInput === tournament.password) {
      setIsPasswordVerified(true);
      
      // Log successful password verification
      logAction({
        action: 'tournament_password_verified',
        details: {
          tournament_id: tournamentId
        }
      });
      
      // Load division data now that we're verified
      loadDivisionData();
    } else {
      setPasswordError('Incorrect password');
      
      // Log failed password attempt
      logAction({
        action: 'tournament_password_failed',
        details: {
          tournament_id: tournamentId
        }
      });
    }
  };

  const loadDivisionData = async () => {
    try {
      const currentDivision = divisions[selectedDivision];
      if (!currentDivision) return;

      // Load players for this division
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      // Load all pairings for this tournament
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
        .in('pairing_id', (pairingsData || []).map(p => p.id));

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
      const calculatedStandings = calculateStandings(playersData || [], resultsData || [], pairingsData || []);
      setStandings(calculatedStandings);

    } catch (err) {
      console.error('Error loading division data:', err);
      setError('Failed to load division data');
    }
  };

  const calculateStandings = (players: Player[], results: Result[], pairings: any[]): PlayerStanding[] => {
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
        const pairing = pairings.find(p => p.id === result.pairing_id);
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

    return standings;
  };

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setShowPlayerModal(true);
    
    // Log player details view
    logAction({
      action: 'player_details_viewed',
      details: {
        tournament_id: tournamentId,
        player_id: playerId
      }
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDivisionData();
    setIsRefreshing(false);
    
    // Log refresh action
    logAction({
      action: 'tournament_view_refreshed',
      details: {
        tournament_id: tournamentId
      }
    });
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrlRef.current);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      
      // Log link copy action
      logAction({
        action: 'tournament_link_copied',
        details: {
          tournament_id: tournamentId
        }
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: show alert with link
      alert(`Tournament link: ${publicUrlRef.current}`);
    }
  };

  const handleShareViaEmail = () => {
    if (!tournament) return;
    
    const subject = encodeURIComponent(`${tournament.name} - Scrabble Tournament`);
    const body = encodeURIComponent(`Check out the live standings and results for ${tournament.name}:\n\n${publicUrlRef.current}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    
    // Log email share action
    logAction({
      action: 'tournament_shared_email',
      details: {
        tournament_id: tournamentId
      }
    });
  };

  const handleShareViaFacebook = () => {
    if (!tournament) return;
    
    const url = encodeURIComponent(publicUrlRef.current);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
    
    // Log Facebook share action
    logAction({
      action: 'tournament_shared_facebook',
      details: {
        tournament_id: tournamentId
      }
    });
  };

  const handleShareViaTwitter = () => {
    if (!tournament) return;
    
    const text = encodeURIComponent(`Check out the live standings and results for ${tournament.name} Scrabble Tournament!`);
    const url = encodeURIComponent(publicUrlRef.current);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    
    // Log Twitter share action
    logAction({
      action: 'tournament_shared_twitter',
      details: {
        tournament_id: tournamentId
      }
    });
  };

  const handleShareViaWhatsApp = () => {
    if (!tournament) return;
    
    const text = encodeURIComponent(`Check out the live standings and results for ${tournament.name} Scrabble Tournament: ${publicUrlRef.current}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    
    // Log WhatsApp share action
    logAction({
      action: 'tournament_shared_whatsapp',
      details: {
        tournament_id: tournamentId
      }
    });
  };

  const exportStandings = () => {
    const headers = ['Rank', 'Name', 'Rating', 'W-L-D', 'Points', 'Spread', 'Games'];
    const rows = standings.map(s => [
      s.rank,
      s.name,
      s.rating,
      `${s.wins}-${s.losses}-${s.draws}`,
      s.points,
      s.spread,
      s.gamesPlayed
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament?.name || 'Tournament'}_Standings.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Log export action
    logAction({
      action: 'tournament_standings_exported',
      details: {
        tournament_id: tournamentId,
        format: 'csv'
      }
    });
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/50 text-yellow-400';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50 text-gray-300';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/50 text-amber-400';
      default:
        return '';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4 font-orbitron">Error</h1>
          <p className="text-gray-300 mb-8">{error}</p>
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains transition-all duration-200 mx-auto"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return null;
  }

  // Password protection screen
  if (isPasswordProtected && !isPasswordVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
        <ParticleBackground />
        
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-gray-900/80 backdrop-blur-lg border-2 border-blue-500/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <Lock className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white font-orbitron mb-2">
                Password Protected
              </h1>
              <p className="text-gray-300 font-jetbrains">
                This tournament requires a password to view
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Enter Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
                  placeholder="Tournament password"
                />
              </div>
              
              {passwordError && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 font-jetbrains text-sm">
                  {passwordError}
                </div>
              )}
              
              <button
                onClick={verifyPassword}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
              >
                Access Tournament
              </button>
              
              <div className="text-center">
                <button
                  onClick={handleBackToHome}
                  className="text-gray-400 hover:text-white text-sm font-jetbrains transition-colors duration-200"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentDivision = divisions[selectedDivision];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      <ParticleBackground />
      
      {/* Tournament Header */}
      <TournamentHeader
        tournament={tournament}
        division={currentDivision}
        showDivision={divisions.length > 1}
        variant="public"
      />
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Navigation */}
        <div className="max-w-6xl mx-auto w-full mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft size={20} />
              <span className="font-jetbrains">Home</span>
            </button>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-4 py-2 bg-blue-800/80 backdrop-blur-lg text-blue-300 hover:text-white rounded-lg border border-blue-700/50 hover:border-blue-600/50 transition-all duration-200 ${
                  isRefreshing ? 'animate-pulse' : ''
                }`}
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Sharing Section */}
        <div className="max-w-6xl mx-auto w-full mb-8">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white font-orbitron mb-4 flex items-center gap-2">
              <Share2 size={20} />
              Share Tournament
            </h2>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains text-sm break-all">
                  {publicUrlRef.current}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-jetbrains text-sm transition-all duration-200 ${
                    linkCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800/50 border border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </button>
                
                <button
                  onClick={handleShareViaFacebook}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30 hover:text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <Facebook size={14} />
                  Facebook
                </button>
                
                <button
                  onClick={handleShareViaTwitter}
                  className="flex items-center gap-2 px-3 py-2 bg-cyan-600/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-600/30 hover:text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <Twitter size={14} />
                  Twitter
                </button>
                
                <button
                  onClick={handleShareViaWhatsApp}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-500/50 text-green-400 hover:bg-green-600/30 hover:text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <span className="text-lg">🟢</span>
                  WhatsApp
                </button>
                
                <button
                  onClick={handleShareViaEmail}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/30 hover:text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <Mail size={14} />
                  Email
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Controls */}
        <div className="text-center mb-12 max-w-6xl mx-auto">
          {/* Division Tabs */}
          {divisions.length > 1 && (
            <div className="fade-up fade-up-delay-1 mb-8">
              {isMobile ? (
                <div className="relative">
                  <select
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(parseInt(e.target.value))}
                    className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none appearance-none"
                  >
                    {divisions.map((division, index) => (
                      <option key={division.id} value={index}>
                        {division.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {divisions.map((division, index) => (
                    <button
                      key={division.id}
                      onClick={() => setSelectedDivision(index)}
                      className={`px-6 py-3 rounded-lg font-jetbrains font-medium transition-all duration-300 ${
                        index === selectedDivision
                          ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                          : 'bg-gray-800/50 border border-gray-600/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
                      }`}
                    >
                      {division.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content Tabs */}
          <div className="fade-up fade-up-delay-2 mb-8">
            {isMobile ? (
              <div className="relative">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as any)}
                  className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none appearance-none"
                >
                  <option value="players">Registered Players</option>
                  <option value="pairings">Round Pairings</option>
                  <option value="standings">Live Standings</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                {[
                  { key: 'players', label: 'Registered Players', icon: Users },
                  { key: 'pairings', label: 'Round Pairings', icon: Trophy },
                  { key: 'standings', label: 'Live Standings', icon: Trophy }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-jetbrains font-medium transition-all duration-300 ${
                      activeTab === key
                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                        : 'bg-gray-800/50 border border-gray-600/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 max-w-6xl mx-auto w-full">
          {/* Players Tab */}
          {activeTab === 'players' && (
            <div className="fade-up">
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-gray-700">
                  <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                    <Users size={24} />
                    Registered Players ({players.length})
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {players.map((player, index) => (
                      <button
                        key={player.id}
                        onClick={() => handlePlayerClick(player.id!)}
                        className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-4 hover:bg-gray-700/50 hover:border-blue-500/50 transition-all duration-200 text-left group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium group-hover:text-blue-300 transition-colors duration-200">
                            {player.name}
                          </span>
                          <span className="text-xs text-gray-400 font-jetbrains">#{index + 1}</span>
                        </div>
                        <div className="text-sm text-gray-400 font-jetbrains">
                          Rating: {player.rating}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {players.length === 0 && (
                    <div className="text-center py-12 text-gray-400 font-jetbrains">
                      No players registered yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pairings Tab */}
          {activeTab === 'pairings' && (
            <div className="fade-up space-y-8">
              {Array.from({ length: maxRounds }, (_, roundIndex) => {
                const roundNumber = roundIndex + 1;
                const roundPairings = pairings[roundNumber] || [];
                
                if (roundPairings.length === 0) return null;

                return (
                  <div key={roundNumber} className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
                    <div className="p-6 border-b border-gray-700">
                      <h3 className="text-lg font-bold text-white font-orbitron">
                        Round {roundNumber}
                      </h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-800/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Table</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 1</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 2</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {roundPairings.map((pairing) => (
                            <tr key={pairing.id} className="hover:bg-gray-800/30 transition-colors duration-200">
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono font-bold">
                                {pairing.table_number}
                              </td>
                              
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {pairing.first_move_player_id === pairing.player1_id && (
                                    <div className="w-3 h-3 bg-green-500 rounded-full" title="First move"></div>
                                  )}
                                  <button
                                    onClick={() => handlePlayerClick(pairing.player1.id)}
                                    className="text-left hover:text-blue-300 transition-colors duration-200"
                                  >
                                    <div className="text-sm font-medium text-white">
                                      {pairing.player1.name}
                                    </div>
                                    <div className="text-xs text-gray-400 font-jetbrains">
                                      #{pairing.player1_rank} • {pairing.player1.rating}
                                    </div>
                                  </button>
                                </div>
                              </td>
                              
                              <td className="px-4 py-4 text-center">
                                <span className="text-lg font-bold text-white font-mono">
                                  {pairing.result?.player1_score ?? '—'}
                                </span>
                              </td>
                              
                              <td className="px-4 py-4 text-center">
                                <span className="text-lg font-bold text-white font-mono">
                                  {pairing.result?.player2_score ?? '—'}
                                </span>
                              </td>
                              
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {pairing.first_move_player_id === pairing.player2_id && (
                                    <div className="w-3 h-3 bg-green-500 rounded-full" title="First move"></div>
                                  )}
                                  <button
                                    onClick={() => handlePlayerClick(pairing.player2.id)}
                                    className="text-left hover:text-blue-300 transition-colors duration-200"
                                  >
                                    <div className="text-sm font-medium text-white">
                                      {pairing.player2.name}
                                    </div>
                                    <div className="text-xs text-gray-400 font-jetbrains">
                                      #{pairing.player2_rank} • {pairing.player2.rating}
                                    </div>
                                  </button>
                                </div>
                              </td>
                              
                              <td className="px-4 py-4 text-center">
                                {pairing.result ? (
                                  <div className="flex items-center justify-center">
                                    {pairing.result.winner_id === pairing.player1_id ? (
                                      <span className="text-green-400 font-jetbrains text-sm">P1 Wins</span>
                                    ) : pairing.result.winner_id === pairing.player2_id ? (
                                      <span className="text-green-400 font-jetbrains text-sm">P2 Wins</span>
                                    ) : (
                                      <span className="text-yellow-400 font-jetbrains text-sm">Tie</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-500 font-jetbrains text-sm">Pending</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              
              {Object.keys(pairings).length === 0 && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-12 text-center backdrop-blur-sm">
                  <p className="text-gray-400 font-jetbrains">No pairings available yet</p>
                </div>
              )}
            </div>
          )}

          {/* Standings Tab */}
          {activeTab === 'standings' && (
            <div className="fade-up">
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                    <Trophy size={24} />
                    Live Standings
                  </h2>
                  
                  <button
                    onClick={exportStandings}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 backdrop-blur-lg text-gray-300 hover:text-white rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
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
                          className={`transition-colors duration-200 hover:bg-gray-800/30 ${getRankStyle(standing.rank)}`}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold font-orbitron">
                                {getRankIcon(standing.rank)}
                              </span>
                            </div>
                          </td>
                          
                          <td className="px-4 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handlePlayerClick(standing.id)}
                              className="text-left hover:bg-blue-500/20 rounded-lg p-2 -m-2 transition-all duration-200 group"
                            >
                              <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors duration-200">
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
                    No standings available yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tournament Info */}
        <div className="max-w-6xl mx-auto w-full mt-8 mb-4">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white font-orbitron mb-4">Tournament Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tournament.date && (
                <div className="flex items-center gap-2 text-gray-300 font-jetbrains">
                  <Calendar size={16} className="text-blue-400" />
                  <span>{new Date(tournament.date).toLocaleDateString()}</span>
                </div>
              )}
              
              {tournament.venue && (
                <div className="flex items-center gap-2 text-gray-300 font-jetbrains">
                  <MapPin size={16} className="text-green-400" />
                  <span>{tournament.venue}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-gray-300 font-jetbrains">
                <Trophy size={16} className="text-yellow-400" />
                <span>{tournament.rounds || 7} Rounds</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-12">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Live Tournament View • Powered by Direktor • Click player names for detailed stats
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

export default PublicTournamentView;