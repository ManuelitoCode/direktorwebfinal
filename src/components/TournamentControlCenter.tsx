import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Trophy, Calendar, MapPin, Play, Edit3, BarChart3, Brain, Eye, Download, Share2, QrCode, Settings, History } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import PlayerRegistration from './PlayerRegistration';
import RoundManager from './RoundManager';
import ScoreEntry from './ScoreEntry';
import Standings from './Standings';
import AdminPanel from './AdminPanel';
import AIInsightsPanel from './AIInsightsPanel';
import QRCodeModal from './QRCodeModal';
import { supabase } from '../lib/supabase';
import { useAuditLog } from '../hooks/useAuditLog';
import { useOfflineMode } from '../hooks/useOfflineMode';
import { useTournamentProgress } from '../hooks/useTournamentProgress';
import { Tournament, Player, Division } from '../types/database';

const TournamentControlCenter: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentScreen, setCurrentScreen] = useState<'overview' | 'player-registration' | 'round-manager' | 'score-entry' | 'standings' | 'admin-panel'>('overview');
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  const { setTournamentStatus, setTournamentRound } = useTournamentProgress();
  const { logAction } = useAuditLog();
  const { 
    isOnline, 
    isOfflineMode,
    cacheTournamentData,
    getCachedTournamentData
  } = useOfflineMode();

  useEffect(() => {
    if (tournamentId) {
      loadTournamentData();
    }
  }, [tournamentId]);
  
  useEffect(() => {
    // Cache tournament data for offline use when online
    if (isOnline && tournamentId && tournament) {
      cacheTournamentData(tournamentId);
    }
  }, [isOnline, tournamentId, tournament]);

  const loadTournamentData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let tournamentData;
      let playersData;
      let divisionsData;
      
      if (isOnline) {
        // Online mode - fetch from Supabase
        const { data: tData, error: tournamentError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', tournamentId)
          .single();

        if (tournamentError) throw tournamentError;
        tournamentData = tData;
        
        // Load players
        const { data: pData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('rating', { ascending: false });

        if (playersError) throw playersError;
        playersData = pData;
        
        // Load divisions
        const { data: dData, error: divisionsError } = await supabase
          .from('divisions')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('division_number');

        if (divisionsError && divisionsError.code !== 'PGRST116') {
          throw divisionsError;
        }
        divisionsData = dData;
      } else {
        // Offline mode - get from cache
        const cachedData = await getCachedTournamentData(tournamentId!);
        if (!cachedData) {
          throw new Error('No cached data available for offline use');
        }
        
        tournamentData = cachedData.tournaments[0];
        playersData = cachedData.players;
        divisionsData = []; // Divisions not cached yet
      }

      setTournament(tournamentData);
      setCurrentRound(tournamentData.current_round || 1);
      setMaxRounds(tournamentData.rounds || 7);
      setPlayers(playersData || []);
      
      // Set divisions or create default
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
      
      // Determine current screen based on tournament status
      switch (tournamentData.status) {
        case 'registration':
          setCurrentScreen('player-registration');
          break;
        case 'active':
          setCurrentScreen('round-manager');
          break;
        case 'completed':
          setCurrentScreen('standings');
          break;
        default:
          setCurrentScreen('overview');
      }
      
      // Log access
      logAction({
        action: 'tournament_control_center_accessed',
        details: {
          tournament_id: tournamentId,
          tournament_name: tournamentData.name,
          status: tournamentData.status,
          current_round: tournamentData.current_round || 1
        }
      });

    } catch (err) {
      console.error('Error loading tournament data:', err);
      setError('Failed to load tournament data');
      
      // Log error
      logAction({
        action: 'tournament_load_error',
        details: {
          tournament_id: tournamentId,
          error: String(err)
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToOverview = () => {
    setCurrentScreen('overview');
  };

  const handleNavigateToPlayerRegistration = () => {
    setCurrentScreen('player-registration');
    
    // Log navigation
    logAction({
      action: 'navigate_to_player_registration',
      details: {
        tournament_id: tournamentId
      }
    });
  };

  const handleNavigateToRoundManager = async () => {
    setCurrentScreen('round-manager');
    
    if (tournamentId) {
      await setTournamentStatus(tournamentId, 'active');
    }
    
    // Log navigation
    logAction({
      action: 'navigate_to_round_manager',
      details: {
        tournament_id: tournamentId,
        current_round: currentRound
      }
    });
  };

  const handleNavigateToScoreEntry = async () => {
    setCurrentScreen('score-entry');
    
    if (tournamentId) {
      await setTournamentRound(tournamentId, currentRound);
    }
    
    // Log navigation
    logAction({
      action: 'navigate_to_score_entry',
      details: {
        tournament_id: tournamentId,
        current_round: currentRound
      }
    });
  };

  const handleNavigateToStandings = () => {
    setCurrentScreen('standings');
    
    // Log navigation
    logAction({
      action: 'navigate_to_standings',
      details: {
        tournament_id: tournamentId,
        current_round: currentRound
      }
    });
  };

  const handleNavigateToAdminPanel = () => {
    setCurrentScreen('admin-panel');
    
    // Log navigation
    logAction({
      action: 'navigate_to_admin_panel',
      details: {
        tournament_id: tournamentId
      }
    });
  };

  const handleNextRound = async () => {
    if (currentRound < maxRounds) {
      const newRound = currentRound + 1;
      setCurrentRound(newRound);
      setCurrentScreen('round-manager');
      
      if (tournamentId) {
        await setTournamentRound(tournamentId, newRound);
      }
      
      // Log next round
      logAction({
        action: 'next_round_started',
        details: {
          tournament_id: tournamentId,
          new_round: newRound
        }
      });
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };
  
  const handleShowQRCode = () => {
    setShowQRModal(true);
    
    // Log QR code view
    logAction({
      action: 'qr_code_generated',
      details: {
        tournament_id: tournamentId
      }
    });
  };
  
  const handleShowAIInsights = () => {
    setShowAIInsights(true);
    
    // Log AI insights view
    logAction({
      action: 'ai_insights_accessed',
      details: {
        tournament_id: tournamentId,
        current_round: currentRound
      }
    });
  };
  
  const handleViewPublic = () => {
    window.open(`/t/${tournamentId}`, '_blank');
    
    // Log public view
    logAction({
      action: 'public_view_opened',
      details: {
        tournament_id: tournamentId
      }
    });
  };
  
  const handleCopyLink = async () => {
    try {
      const link = `${window.location.origin}/t/${tournamentId}`;
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      
      // Log link copy
      logAction({
        action: 'tournament_link_copied',
        details: {
          tournament_id: tournamentId
        }
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert(`Tournament link: ${window.location.origin}/t/${tournamentId}`);
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
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains transition-all duration-200 mx-auto"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return null;
  }

  // Render overview screen
  if (currentScreen === 'overview') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
        <ParticleBackground />
        
        <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
              >
                <ArrowLeft size={20} />
                <span className="font-jetbrains">Back to Dashboard</span>
              </button>
              
              {isOfflineMode && (
                <div className="px-4 py-2 bg-yellow-600/80 text-yellow-200 rounded-lg font-jetbrains text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  Offline Mode
                </div>
              )}
            </div>

            <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
                data-text="TOURNAMENT CONTROL">
              TOURNAMENT CONTROL
            </h1>
            
            <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-blue-400 mb-4 font-medium">
              {tournament.name}
            </p>
            
            <div className="fade-up fade-up-delay-2 flex flex-wrap items-center justify-center gap-6 text-lg text-gray-300 mb-6 font-light tracking-wide">
              {tournament.date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span>{new Date(tournament.date).toLocaleDateString()}</span>
                </div>
              )}
              
              {tournament.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-400" />
                  <span>{tournament.venue}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span>Round {currentRound} of {maxRounds}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span>{players.length} Players</span>
              </div>
            </div>
            
            <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto rounded-full"></div>
          </div>

          {/* Tournament Status */}
          <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white font-orbitron mb-6 flex items-center gap-2">
                <BarChart3 size={24} />
                Tournament Status
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white font-orbitron mb-2">
                    {tournament.status?.toUpperCase() || 'SETUP'}
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">Current Status</div>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white font-orbitron mb-2">
                    {currentRound}
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">Current Round</div>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white font-orbitron mb-2">
                    {players.length}
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">Players</div>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white font-orbitron mb-2">
                    {Math.round((currentRound / maxRounds) * 100)}%
                  </div>
                  <div className="text-sm text-gray-400 font-jetbrains">Progress</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-6">
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(currentRound / maxRounds) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tournament Controls */}
          <div className="fade-up fade-up-delay-5 max-w-6xl mx-auto w-full mb-8">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white font-orbitron mb-6 flex items-center gap-2">
                <Settings size={24} />
                Tournament Controls
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Button
                  icon={Users}
                  label="Player Registration"
                  onClick={handleNavigateToPlayerRegistration}
                  variant="blue"
                />
                
                <Button
                  icon={Play}
                  label="Round Manager"
                  onClick={handleNavigateToRoundManager}
                  variant="green"
                />
                
                <Button
                  icon={Trophy}
                  label="Score Entry"
                  onClick={handleNavigateToScoreEntry}
                  variant="blue"
                />
                
                <Button
                  icon={BarChart3}
                  label="Standings"
                  onClick={handleNavigateToStandings}
                  variant="green"
                />
                
                <Button
                  icon={Brain}
                  label="AI Insights"
                  onClick={handleShowAIInsights}
                  variant="blue"
                />
                
                <Button
                  icon={Settings}
                  label="Admin Panel"
                  onClick={handleNavigateToAdminPanel}
                  variant="green"
                />
              </div>
            </div>
          </div>

          {/* Sharing Options */}
          <div className="fade-up fade-up-delay-6 max-w-6xl mx-auto w-full mb-8">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white font-orbitron mb-6 flex items-center gap-2">
                <Share2 size={24} />
                Sharing Options
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={handleViewPublic}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30 hover:text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  <Eye size={20} />
                  View Public Page
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                    linkCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-green-600/20 border border-green-500/50 text-green-400 hover:bg-green-600/30 hover:text-white'
                  }`}
                >
                  {linkCopied ? <Check size={20} /> : <Share2 size={20} />}
                  {linkCopied ? 'Link Copied!' : 'Copy Public Link'}
                </button>
                
                <button
                  onClick={handleShowQRCode}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/30 hover:text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  <QrCode size={20} />
                  Generate QR Code
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="fade-up text-center mt-auto">
            <p className="text-gray-500 text-sm font-light tracking-wider">
              Tournament Control Center • Manage all aspects of your tournament
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>
          </footer>
        </div>
        
        {/* QR Code Modal */}
        {showQRModal && (
          <QRCodeModal
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            tournamentId={tournamentId!}
            tournamentName={tournament.name}
          />
        )}
        
        {/* AI Insights Panel */}
        <AIInsightsPanel
          isOpen={showAIInsights}
          onClose={() => setShowAIInsights(false)}
          tournamentId={tournamentId!}
          currentRound={currentRound}
        />

        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-green-500/20 to-transparent rounded-tl-full blur-xl"></div>
      </div>
    );
  }

  // Render specific screens
  if (currentScreen === 'player-registration' && tournamentId) {
    return (
      <PlayerRegistration
        onBack={handleBackToOverview}
        onNext={handleNavigateToRoundManager}
        tournamentId={tournamentId}
      />
    );
  }

  if (currentScreen === 'round-manager' && tournamentId) {
    return (
      <RoundManager
        onBack={handleBackToOverview}
        onNext={handleNavigateToScoreEntry}
        tournamentId={tournamentId}
      />
    );
  }

  if (currentScreen === 'score-entry' && tournamentId) {
    return (
      <ScoreEntry
        onBack={handleBackToOverview}
        onNext={handleNavigateToStandings}
        tournamentId={tournamentId}
        currentRound={currentRound}
      />
    );
  }

  if (currentScreen === 'standings' && tournamentId) {
    return (
      <Standings
        onBack={handleBackToOverview}
        onNextRound={handleNextRound}
        tournamentId={tournamentId}
        currentRound={currentRound}
        maxRounds={maxRounds}
      />
    );
  }

  if (currentScreen === 'admin-panel' && tournamentId) {
    return (
      <AdminPanel
        onBack={handleBackToOverview}
        tournamentId={tournamentId}
      />
    );
  }

  return null;
};

export default TournamentControlCenter;