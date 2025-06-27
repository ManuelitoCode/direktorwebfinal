import React, { useState, useEffect, Suspense } from 'react';
import { Plus, FolderOpen, LogOut, Settings, Share2, QrCode } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import ParticleBackground from './components/ParticleBackground';
import Button from './components/Button';
import PlayerRegistration from './components/PlayerRegistration';
import RoundManager from './components/RoundManager';
import ScoreEntry from './components/ScoreEntry';
import Standings from './components/Standings';
import AdminPanel from './components/AdminPanel';
import AuthForm from './components/AuthForm';
import UserDashboard from './components/UserDashboard';
import TournamentSetupModal from './components/TournamentSetupModal';
import TournamentResume from './components/TournamentResume';
import PublicTournamentView from './components/PublicTournamentView';
import LandingPage from './components/LandingPage';
import TournamentControlCenter from './components/TournamentControlCenter';
import DirectorsLeaderboard from './components/DirectorsLeaderboard';
import { supabase } from './lib/supabase';
import { useTournamentProgress } from './hooks/useTournamentProgress';
import { useAuditLog } from './hooks/useAuditLog';
import type { User } from '@supabase/supabase-js';

// Lazy-loaded components
const ProjectionMode = React.lazy(() => import('./components/ProjectionMode'));
const QRCodeModal = React.lazy(() => import('./components/QRCodeModal'));
const Statistics = React.lazy(() => import('./components/Statistics/Statistics'));

type Screen = 'home' | 'dashboard' | 'resume' | 'player-registration' | 'round-manager' | 'score-entry' | 'standings' | 'admin-panel';

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  user: User | null;
  loading: boolean;
}

function ProtectedRoute({ children, user, loading }: ProtectedRouteProps) {
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/signin" replace />;
  }

  return <>{children}</>;
}

function HomePage() {
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [currentTournamentId, setCurrentTournamentId] = useState<string | null>(null);
  const [currentTournamentName, setCurrentTournamentName] = useState<string>('');
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds] = useState(7); // Default to 7 rounds
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasExistingTournaments, setHasExistingTournaments] = useState(false);

  const { setTournamentStatus, setTournamentRound } = useTournamentProgress();
  const { logAction } = useAuditLog();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkExistingTournaments(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkExistingTournaments(session.user.id);
      } else {
        setHasExistingTournaments(false);
        setCurrentScreen('home');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkExistingTournaments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id')
        .eq('director_id', userId)
        .limit(1);

      if (error) throw error;
      
      setHasExistingTournaments((data || []).length > 0);
    } catch (err) {
      console.error('Error checking existing tournaments:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      
      // Log signout action
      logAction({
        action: 'user_logout',
        details: {
          user_id: user?.id
        }
      });
      
      // Show success toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-green-500/50';
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          You've been signed out. See you next time!
        </div>
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
      
      // Redirect to landing page
      navigate('/');
    } catch (err) {
      console.error('Error signing out:', err);
      // Still redirect even if there's an error
      navigate('/');
    }
  };

  const handleNewTournament = () => {
    setShowTournamentModal(true);
  };

  const handleViewTournaments = () => {
    setCurrentScreen('resume');
  };

  const handleNavigateToTournaments = () => {
    if (hasExistingTournaments) {
      setCurrentScreen('resume');
    } else {
      setShowTournamentModal(true);
    }
  };

  const handleTournamentCreated = async (tournamentId: string) => {
    try {
      // Load tournament name for QR code
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('name, slug')
        .eq('id', tournamentId)
        .single();

      setCurrentTournamentId(tournamentId);
      setCurrentTournamentName(tournamentData?.name || 'Tournament');
      setShowTournamentModal(false);
      
      // Navigate directly to player registration
      setCurrentScreen('player-registration');
      
      // Update tournament status to registration
      await setTournamentStatus(tournamentId, 'registration');
      
      // Log tournament creation
      logAction({
        action: 'tournament_flow_started',
        details: {
          tournament_id: tournamentId,
          tournament_name: tournamentData?.name,
          tournament_slug: tournamentData?.slug
        }
      });
    } catch (err) {
      console.error('Error loading tournament after creation:', err);
      // Show error toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg font-jetbrains text-sm';
      toast.textContent = 'Tournament created but failed to load details. Please try refreshing.';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 5000);
    }
  };

  const handleResumeTournament = async (tournamentId: string, round: number) => {
    try {
      // Load tournament name for QR code
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('name, status, slug')
        .eq('id', tournamentId)
        .single();

      setCurrentTournamentId(tournamentId);
      setCurrentTournamentName(tournamentData?.name || 'Tournament');
      setCurrentRound(round);
      
      // Log tournament resume
      logAction({
        action: 'tournament_resumed',
        details: {
          tournament_id: tournamentId,
          tournament_name: tournamentData?.name,
          current_round: round,
          status: tournamentData?.status,
          tournament_slug: tournamentData?.slug
        }
      });
      
      // Determine which screen to show based on tournament status
      const status = tournamentData?.status;
      if (status === 'registration') {
        setCurrentScreen('player-registration');
      } else if (status === 'active') {
        setCurrentScreen('round-manager');
      } else {
        // Default to round manager for other statuses
        setCurrentScreen('round-manager');
      }
    } catch (err) {
      console.error('Error resuming tournament:', err);
      // Show error toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg font-jetbrains text-sm';
      toast.textContent = 'Failed to load tournament details. Please try again.';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 5000);
    }
  };

  const handleAdminPanel = () => {
    if (currentTournamentId) {
      setCurrentScreen('admin-panel');
      
      // Log admin panel access
      logAction({
        action: 'admin_panel_accessed',
        details: {
          tournament_id: currentTournamentId
        }
      });
    } else {
      alert('Please create or select a tournament first');
    }
  };

  const handleBackToHome = () => {
    setCurrentScreen('dashboard');
    setCurrentTournamentId(null);
    setCurrentTournamentName('');
    setCurrentRound(1);
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
  };

  const handleNextToRoundManager = async () => {
    console.log('Navigate to Round Manager');
    setCurrentScreen('round-manager');
    
    if (currentTournamentId) {
      await setTournamentStatus(currentTournamentId, 'active');
      
      // Log round manager navigation
      logAction({
        action: 'round_manager_accessed',
        details: {
          tournament_id: currentTournamentId,
          tournament_name: currentTournamentName
        }
      });
    }
  };

  const handleNextToScoreEntry = async () => {
    console.log('Navigate to Score Entry');
    setCurrentScreen('score-entry');
    
    if (currentTournamentId) {
      await setTournamentRound(currentTournamentId, currentRound);
      
      // Log score entry navigation
      logAction({
        action: 'score_entry_accessed',
        details: {
          tournament_id: currentTournamentId,
          tournament_name: currentTournamentName,
          round: currentRound
        }
      });
    }
  };

  const handleNextToStandings = () => {
    console.log('Navigate to Standings');
    setCurrentScreen('standings');
    
    // Log standings navigation
    if (currentTournamentId) {
      logAction({
        action: 'standings_accessed',
        details: {
          tournament_id: currentTournamentId,
          tournament_name: currentTournamentName,
          round: currentRound
        }
      });
    }
  };

  const handleNextRound = async () => {
    if (currentRound < maxRounds) {
      const newRound = currentRound + 1;
      setCurrentRound(newRound);
      setCurrentScreen('round-manager');
      
      if (currentTournamentId) {
        await setTournamentRound(currentTournamentId, newRound);
        
        // Log next round navigation
        logAction({
          action: 'next_round_started',
          details: {
            tournament_id: currentTournamentId,
            tournament_name: currentTournamentName,
            new_round: newRound
          }
        });
      }
    }
  };

  const handleAuthSuccess = () => {
    // User is now authenticated, they will be redirected to dashboard automatically
    navigate('/dashboard');
  };

  const copyTournamentLink = async () => {
    if (!currentTournamentId) return;
    
    try {
      // Get tournament slug
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('slug')
        .eq('id', currentTournamentId)
        .single();
      
      // Use slug if available, otherwise use ID
      const slug = tournamentData?.slug || currentTournamentId;
      const link = `https://direktorweb.com/tournaments/${slug}`;
      
      await navigator.clipboard.writeText(link);
      // Show toast notification
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-green-500/50';
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          Tournament link copied to clipboard!
        </div>
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
      
      // Log link copy
      logAction({
        action: 'tournament_link_copied',
        details: {
          tournament_id: currentTournamentId,
          tournament_name: currentTournamentName,
          link_type: 'slug'
        }
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback to ID-based link
      const link = `https://direktorweb.com/tournaments/${currentTournamentId}`;
      alert(`Tournament link: ${link}`);
    }
  };

  const handleShowQRCode = () => {
    setShowQRModal(true);
    
    // Log QR code view
    if (currentTournamentId) {
      logAction({
        action: 'qr_code_generated',
        details: {
          tournament_id: currentTournamentId,
          tournament_name: currentTournamentName
        }
      });
    }
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Show auth form if user is not authenticated
  if (!user) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  // Show user dashboard
  if (currentScreen === 'dashboard') {
    return (
      <UserDashboard
        user={user}
        onNavigateToTournaments={handleNavigateToTournaments}
      />
    );
  }

  // Show tournament resume screen
  if (currentScreen === 'resume') {
    return (
      <TournamentResume
        onNewTournament={handleNewTournament}
        onResumeTournament={handleResumeTournament}
      />
    );
  }

  if (currentScreen === 'player-registration' && currentTournamentId) {
    return (
      <PlayerRegistration
        onBack={handleBackToDashboard}
        onNext={handleNextToRoundManager}
        tournamentId={currentTournamentId}
      />
    );
  }

  if (currentScreen === 'round-manager' && currentTournamentId) {
    return (
      <RoundManager
        onBack={handleBackToDashboard}
        onNext={handleNextToScoreEntry}
        tournamentId={currentTournamentId}
      />
    );
  }

  if (currentScreen === 'score-entry' && currentTournamentId) {
    return (
      <ScoreEntry
        onBack={handleBackToDashboard}
        onNext={handleNextToStandings}
        tournamentId={currentTournamentId}
        currentRound={currentRound}
      />
    );
  }

  if (currentScreen === 'standings' && currentTournamentId) {
    return (
      <Standings
        onBack={handleBackToDashboard}
        onNextRound={handleNextRound}
        tournamentId={currentTournamentId}
        currentRound={currentRound}
        maxRounds={maxRounds}
      />
    );
  }

  if (currentScreen === 'admin-panel' && currentTournamentId) {
    return (
      <AdminPanel
        onBack={handleBackToDashboard}
        tournamentId={currentTournamentId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      {/* Particle Background */}
      <ParticleBackground />
      
      {/* Top Navigation */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        {/* QR Code Button */}
        {currentTournamentId && (
          <button
            onClick={handleShowQRCode}
            className="flex items-center gap-2 px-4 py-2 bg-purple-800/80 backdrop-blur-lg text-purple-300 hover:text-white rounded-lg border border-purple-700/50 hover:border-purple-600/50 transition-all duration-200"
          >
            <QrCode className="w-4 h-4" />
            Generate QR Code
          </button>
        )}

        {/* Share Tournament Button */}
        {currentTournamentId && (
          <button
            onClick={copyTournamentLink}
            className="flex items-center gap-2 px-4 py-2 bg-green-800/80 backdrop-blur-lg text-green-300 hover:text-white rounded-lg border border-green-700/50 hover:border-green-600/50 transition-all duration-200"
          >
            <Share2 className="w-4 h-4" />
            Share Tournament
          </button>
        )}

        {/* Admin Panel Button */}
        {currentTournamentId && (
          <button
            onClick={handleAdminPanel}
            className="flex items-center gap-2 px-4 py-2 bg-red-800/80 backdrop-blur-lg text-red-300 hover:text-white rounded-lg border border-red-700/50 hover:border-red-600/50 transition-all duration-200"
          >
            <Settings className="w-4 h-4" />
            Admin Panel
          </button>
        )}
        
        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 backdrop-blur-lg text-gray-300 hover:text-white rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-16 max-w-4xl mx-auto">
          {/* Main Title */}
          <h1 
            className="glitch-text fade-up text-6xl md:text-8xl font-bold mb-6 text-white font-orbitron tracking-wider"
            data-text="DIREKTOR"
            style={{ fontFamily: 'Orbitron, monospace' }}
          >
            DIREKTOR
          </h1>
          
          {/* Subtitle */}
          <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-gray-300 mb-4 font-light tracking-wide">
            AI-Powered Scrabble Tournament Manager
          </p>
          
          {/* Welcome Message */}
          <p className="fade-up fade-up-delay-2 text-sm text-gray-400 mb-4">
            Welcome, {user.email}
          </p>
          
          {/* Decorative Line */}
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto rounded-full"></div>
        </div>

        {/* Action Buttons */}
        <div className="fade-up fade-up-delay-4 w-full max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <Button
            icon={Plus}
            label="New Tournament"
            onClick={handleNewTournament}
            variant="blue"
          />
          
          <Button
            icon={FolderOpen}
            label={hasExistingTournaments ? "My Tournaments" : "View Tournaments"}
            onClick={handleViewTournaments}
            variant="green"
          />
        </div>

        {/* Footer */}
        <footer className="fade-up fade-up-delay-5 text-center">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Built for Scrabble Tournament Directors
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Tournament Setup Modal */}
      <TournamentSetupModal
        isOpen={showTournamentModal}
        onClose={() => setShowTournamentModal(false)}
        onSuccess={handleTournamentCreated}
      />

      {/* QR Code Modal */}
      {currentTournamentId && showQRModal && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        }>
          <QRCodeModal
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            tournamentId={currentTournamentId}
            tournamentName={currentTournamentName}
          />
        </Suspense>
      )}

      {/* Additional Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      
      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-green-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
}

// Statistics Route Component
function StatisticsRoute() {
  const { tournamentId, slug } = useParams<{ tournamentId?: string; slug?: string }>();
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <Statistics tournamentId={tournamentId} isPublic={true} />
    </Suspense>
  );
}

// Public Tournament Route Component
function PublicTournamentRoute() {
  return <PublicTournamentView />;
}

// Projection Mode Route Component
function ProjectionModeRoute() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ProjectionMode />
    </Suspense>
  );
}

// Auth Route Component
function AuthRoute() {
  const navigate = useNavigate();
  const { mode } = useParams<{ mode?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        navigate('/dashboard');
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        navigate('/dashboard');
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return <AuthForm onAuthSuccess={() => navigate('/dashboard')} initialMode={mode === 'signup' ? 'signup' : 'signin'} />;
}

// Dashboard Route Component
function DashboardRoute() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate('/');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <ProtectedRoute user={user} loading={loading}>
      <HomePage />
    </ProtectedRoute>
  );
}

// Tournament Control Center Route Component
function TournamentControlCenterRoute() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate('/auth/signin');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate('/auth/signin');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <ProtectedRoute user={user} loading={loading}>
      <TournamentControlCenter />
    </ProtectedRoute>
  );
}

// Directors Leaderboard Route Component
function DirectorsLeaderboardRoute() {
  return <DirectorsLeaderboard />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Navigate to="/auth/signin" replace />} />
        <Route path="/auth/:mode" element={<AuthRoute />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/admin" element={<DashboardRoute />} />
        <Route path="/profile" element={<DashboardRoute />} />
        <Route path="/new-tournament" element={<DashboardRoute />} />
        <Route path="/tournaments" element={<DashboardRoute />} />
        <Route path="/history" element={<DashboardRoute />} />
        <Route path="/tournament/:tournamentId/dashboard" element={<TournamentControlCenterRoute />} />
        <Route path="/t/:tournamentId" element={<PublicTournamentRoute />} />
        <Route path="/tournaments/:slug" element={<PublicTournamentRoute />} />
        <Route path="/t/:tournamentId/statistics" element={<StatisticsRoute />} />
        <Route path="/tournaments/:slug/statistics" element={<StatisticsRoute />} />
        <Route path="/statistics" element={<StatisticsRoute />} />
        <Route path="/projector/:tournamentId/:divisionId" element={<ProjectionModeRoute />} />
        <Route path="/leaderboard/directors" element={<DirectorsLeaderboardRoute />} />
      </Routes>
    </Router>
  );
}

export default App;