import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Calendar, MapPin, Trophy, Users, Hash, Brain, Target, Star, Zap, Crown, Shield, TrendingUp, AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PairingFormat, WizardResponses, TournamentConfig } from '../types/database';
import { 
  analyzePairingSystem, 
  recommendPairingSystem, 
  formatGoalScore,
  PAIRING_GOALS 
} from '../utils/pairingStrategyIntelligence';

interface TournamentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tournamentId: string) => void;
}

interface TournamentData {
  name: string;
  date: string;
  venue: string;
  rounds: number;
  divisions: number;
  divisionNames: string[];
  pairingSystem: PairingFormat;
  wizardResponses?: WizardResponses;
  tournamentConfig?: TournamentConfig;
}

interface TournamentSuccessData {
  id: string;
  name: string;
  slug: string;
  publicUrl: string;
}

const TournamentSetupModal: React.FC<TournamentSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<TournamentSuccessData | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  const [tournamentData, setTournamentData] = useState<TournamentData>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    venue: '',
    rounds: 6,
    divisions: 1,
    divisionNames: [],
    pairingSystem: 'swiss'
  });

  const [wizardResponses, setWizardResponses] = useState<WizardResponses>({
    topPlayersMeeting: 'late',
    avoidRematches: true,
    avoidSameTeam: false,
    suspenseUntilEnd: true,
    manualPairing: false,
    competitiveLevel: 'competitive',
    primaryGoal: 'fairness'
  });

  const totalSteps = tournamentData.divisions > 1 ? 3 : 2; // Basic info, pairing setup, division names (if needed)

  // Generate tournament slug from name
  const generateTournamentSlug = (name: string): string => {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Add short random ID for uniqueness
    const shortId = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${shortId}`;
  };

  const handleInputChange = (field: keyof TournamentData, value: string | number) => {
    setTournamentData(prev => ({
      ...prev,
      [field]: value,
      // Reset division names if divisions count changes
      ...(field === 'divisions' && { divisionNames: [] })
    }));
  };

  const handleDivisionNameChange = (index: number, name: string) => {
    setTournamentData(prev => {
      const newNames = [...prev.divisionNames];
      newNames[index] = name;
      return { ...prev, divisionNames: newNames };
    });
  };

  const handleWizardResponse = (field: keyof WizardResponses, value: any) => {
    setWizardResponses(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    if (!tournamentData.name.trim()) {
      setError('Tournament name is required');
      return false;
    }
    if (!tournamentData.venue.trim()) {
      setError('Venue is required');
      return false;
    }
    if (tournamentData.rounds < 1 || tournamentData.rounds > 20) {
      setError('Number of rounds must be between 1 and 20');
      return false;
    }
    if (tournamentData.divisions < 1 || tournamentData.divisions > 10) {
      setError('Number of divisions must be between 1 and 10');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    // Pairing system step is always valid as we have a default
    return true;
  };

  const validateStep3 = () => {
    if (tournamentData.divisions > 1) {
      for (let i = 0; i < tournamentData.divisions; i++) {
        if (!tournamentData.divisionNames[i]?.trim()) {
          setError(`Division ${i + 1} name is required`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!validateStep2()) return;
      
      if (tournamentData.divisions > 1) {
        // Initialize division names array
        const names = Array(tournamentData.divisions).fill('').map((_, i) => 
          tournamentData.divisionNames[i] || `Division ${i + 1}`
        );
        setTournamentData(prev => ({ ...prev, divisionNames: names }));
        setCurrentStep(3);
      } else {
        handleSubmit();
      }
    } else if (currentStep === 3) {
      if (!validateStep3()) return;
      handleSubmit();
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(currentStep - 1);
  };

  const runWizard = () => {
    const recommendation = recommendPairingSystem({
      primary: wizardResponses.primaryGoal,
      playerCount: 32, // Estimate
      rounds: tournamentData.rounds,
      competitiveLevel: wizardResponses.competitiveLevel,
      priorityGoals: [
        wizardResponses.primaryGoal,
        wizardResponses.avoidRematches ? 'monagony' : '',
        wizardResponses.suspenseUntilEnd ? 'suspense' : '',
        wizardResponses.topPlayersMeeting === 'late' ? 'aristomachy' : ''
      ].filter(Boolean)
    });

    setTournamentData(prev => ({
      ...prev,
      pairingSystem: recommendation.primary,
      wizardResponses,
      tournamentConfig: {
        pairing_system: recommendation.primary,
        avoid_rematches: wizardResponses.avoidRematches,
        wizard_completed: true,
        recommended_system: recommendation.primary,
        recommendation_reasoning: recommendation.reasoning
      }
    }));

    setShowWizard(false);
    setShowScorecard(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be signed in to create a tournament');
      }

      // Generate tournament slug
      const slug = generateTournamentSlug(tournamentData.name);

      // Prepare tournament data with director_id and pairing configuration
      const tournamentInsertData: any = {
        name: tournamentData.name.trim(),
        director_id: user.id,
        status: 'setup',
        current_round: 1,
        last_activity: new Date().toISOString(),
        pairing_system: tournamentData.pairingSystem
      };

      // Add optional fields if they have values
      if (tournamentData.date) {
        tournamentInsertData.date = tournamentData.date;
      }
      if (tournamentData.venue.trim()) {
        tournamentInsertData.venue = tournamentData.venue.trim();
      }
      if (tournamentData.rounds) {
        tournamentInsertData.rounds = tournamentData.rounds;
      }
      if (tournamentData.divisions) {
        tournamentInsertData.divisions = tournamentData.divisions;
      }

      // Add wizard responses and config if completed
      if (tournamentData.wizardResponses) {
        tournamentInsertData.wizard_responses = tournamentData.wizardResponses;
      }
      if (tournamentData.tournamentConfig) {
        tournamentInsertData.tournament_config = tournamentData.tournamentConfig;
      }

      console.log('Creating tournament with data:', tournamentInsertData);

      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert([tournamentInsertData])
        .select()
        .single();

      if (tournamentError) {
        console.error('Tournament creation error:', tournamentError);
        throw tournamentError;
      }

      console.log('Tournament created successfully:', tournament);

      // Create divisions if more than 1
      if (tournamentData.divisions > 1 && tournamentData.divisionNames.length > 0) {
        const divisionsToInsert = tournamentData.divisionNames
          .filter(name => name.trim()) // Only insert non-empty names
          .map((name, index) => ({
            tournament_id: tournament.id,
            name: name.trim(),
            division_number: index + 1
          }));

        if (divisionsToInsert.length > 0) {
          console.log('Creating divisions:', divisionsToInsert);
          
          const { error: divisionsError } = await supabase
            .from('divisions')
            .insert(divisionsToInsert);

          if (divisionsError) {
            console.error('Divisions creation error:', divisionsError);
            // Don't throw here - tournament was created successfully
            console.warn('Failed to create divisions, but tournament was created');
          }
        }
      }

      // Generate public URL
      const publicUrl = `${window.location.origin}/t/${tournament.id}`;

      // Prepare success data
      const successInfo: TournamentSuccessData = {
        id: tournament.id,
        name: tournament.name,
        slug,
        publicUrl
      };

      setSuccessData(successInfo);
      setShowSuccessModal(true);
      
    } catch (err: any) {
      console.error('Error creating tournament:', err);
      
      // Provide more specific error messages
      if (err.code === '42703') {
        setError('Database schema error. Some tournament fields may not be available yet.');
      } else if (err.message) {
        setError(`Failed to create tournament: ${err.message}`);
      } else {
        setError('Failed to create tournament. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!successData) return;
    
    try {
      await navigator.clipboard.writeText(successData.publicUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: show alert with link
      alert(`Tournament link: ${successData.publicUrl}`);
    }
  };

  const handleContinueToRegistration = () => {
    if (!successData) return;
    
    // Reset form state
    setCurrentStep(1);
    setShowWizard(false);
    setShowScorecard(false);
    setShowSuccessModal(false);
    setTournamentData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      venue: '',
      rounds: 6,
      divisions: 1,
      divisionNames: [],
      pairingSystem: 'swiss'
    });
    setWizardResponses({
      topPlayersMeeting: 'late',
      avoidRematches: true,
      avoidSameTeam: false,
      suspenseUntilEnd: true,
      manualPairing: false,
      competitiveLevel: 'competitive',
      primaryGoal: 'fairness'
    });
    setSuccessData(null);
    setLinkCopied(false);

    // Close modal and trigger navigation to player registration
    onClose();
    onSuccess(successData.id);
  };

  const handleClose = () => {
    if (!isSubmitting && !showSuccessModal) {
      setCurrentStep(1);
      setError(null);
      setShowWizard(false);
      setShowScorecard(false);
      setShowSuccessModal(false);
      setTournamentData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        venue: '',
        rounds: 6,
        divisions: 1,
        divisionNames: [],
        pairingSystem: 'swiss'
      });
      setWizardResponses({
        topPlayersMeeting: 'late',
        avoidRematches: true,
        avoidSameTeam: false,
        suspenseUntilEnd: true,
        manualPairing: false,
        competitiveLevel: 'competitive',
        primaryGoal: 'fairness'
      });
      setSuccessData(null);
      setLinkCopied(false);
      onClose();
    }
  };

  // Get analysis for current pairing system
  const currentAnalysis = analyzePairingSystem(tournamentData.pairingSystem, 32, tournamentData.rounds);

  if (!isOpen) return null;

  // Success Modal
  if (showSuccessModal && successData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        
        {/* Success Modal */}
        <div className="relative w-full max-w-2xl bg-gray-900/95 backdrop-blur-lg border-2 border-green-500/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b-2 border-green-500/30 bg-gradient-to-r from-green-900/30 to-blue-900/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white font-orbitron">
                  🎉 Tournament Created Successfully!
                </h2>
                <p className="text-green-300 font-jetbrains">
                  Your tournament is ready for player registration
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Tournament Info */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                {successData.name}
              </h3>
              <p className="text-gray-400 font-jetbrains">
                You can now register players and begin pairing. Share this public link with your players to follow the tournament live.
              </p>
            </div>

            {/* Public Link */}
            <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-sm text-gray-400 font-jetbrains mb-1">Public Tournament Link:</p>
                  <p className="text-white font-jetbrains text-sm break-all">
                    {successData.publicUrl}
                  </p>
                </div>
                
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
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

            {/* Features Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-300 font-jetbrains font-medium">Player Registration</span>
                </div>
                <p className="text-gray-300 font-jetbrains text-sm">
                  Add players and organize divisions
                </p>
              </div>

              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ExternalLink className="w-5 h-5 text-green-400" />
                  <span className="text-green-300 font-jetbrains font-medium">Live Updates</span>
                </div>
                <p className="text-gray-300 font-jetbrains text-sm">
                  Players can follow results in real-time
                </p>
              </div>
            </div>

            {/* Continue Button */}
            <div className="text-center">
              <button
                onClick={handleContinueToRegistration}
                className="w-full px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 font-orbitron text-lg tracking-wide"
                style={{
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)'
                }}
              >
                Continue to Player Registration
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-6 bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4">
              <h4 className="text-lg font-bold text-cyan-300 font-orbitron mb-2">
                🚀 What's Next?
              </h4>
              <ul className="text-sm text-gray-300 font-jetbrains space-y-1">
                <li>• Register players for {tournamentData.divisions > 1 ? `${tournamentData.divisions} divisions` : 'your tournament'}</li>
                <li>• Generate pairings using the {tournamentData.pairingSystem} system</li>
                <li>• Share the public link for live tournament following</li>
                <li>• Use the admin panel for advanced management</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-800">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-orbitron">
                📋 Tournament Setup
              </h2>
              <p className="text-sm text-gray-400 font-jetbrains">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Tournament Info */}
          {currentStep === 1 && (
            <div className="space-y-6 fade-up">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                  Tournament Information
                </h3>
                <p className="text-gray-400 font-jetbrains">
                  Set up the basic details for your tournament
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tournament Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Tournament Name *
                  </label>
                  <div className="relative">
                    <Trophy className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={tournamentData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                      placeholder="Enter tournament name"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="date"
                      value={tournamentData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                    />
                  </div>
                </div>

                {/* Venue */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Venue *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={tournamentData.venue}
                      onChange={(e) => handleInputChange('venue', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                      placeholder="Tournament venue"
                    />
                  </div>
                </div>

                {/* Number of Rounds */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Number of Rounds
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tournamentData.rounds}
                      onChange={(e) => handleInputChange('rounds', parseInt(e.target.value) || 6)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                    />
                  </div>
                </div>

                {/* Number of Divisions */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Number of Divisions
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tournamentData.divisions}
                      onChange={(e) => handleInputChange('divisions', parseInt(e.target.value) || 1)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Pairing System Setup */}
          {currentStep === 2 && (
            <div className="space-y-8 fade-up">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                  Pairing System Setup
                </h3>
                <p className="text-gray-400 font-jetbrains">
                  Choose how players will be paired for matches
                </p>
              </div>

              {/* Wizard vs Manual Choice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <button
                  onClick={() => setShowWizard(true)}
                  className="p-6 bg-purple-900/20 border border-purple-500/30 rounded-xl hover:bg-purple-800/30 hover:border-purple-400/50 transition-all duration-300 text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform duration-300" />
                    <h4 className="text-xl font-bold text-white font-orbitron">Choose for me</h4>
                  </div>
                  <p className="text-gray-300 font-jetbrains mb-4">
                    Answer a few questions and get an AI-powered recommendation for the best pairing system for your tournament.
                  </p>
                  <div className="flex items-center gap-2 text-purple-400 font-jetbrains text-sm">
                    <Zap className="w-4 h-4" />
                    <span>Recommended for new directors</span>
                  </div>
                </button>

                <button
                  onClick={() => setShowScorecard(true)}
                  className="p-6 bg-cyan-900/20 border border-cyan-500/30 rounded-xl hover:bg-cyan-800/30 hover:border-cyan-400/50 transition-all duration-300 text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                    <h4 className="text-xl font-bold text-white font-orbitron">Let me choose manually</h4>
                  </div>
                  <p className="text-gray-300 font-jetbrains mb-4">
                    View detailed analysis of each pairing system and make your own informed decision.
                  </p>
                  <div className="flex items-center gap-2 text-cyan-400 font-jetbrains text-sm">
                    <Crown className="w-4 h-4" />
                    <span>For experienced directors</span>
                  </div>
                </button>
              </div>

              {/* Pairing Recommendation Wizard */}
              {showWizard && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 mb-8">
                  <div className="flex items-center gap-2 mb-6">
                    <Brain className="w-6 h-6 text-purple-400" />
                    <h4 className="text-xl font-bold text-white font-orbitron">Pairing Recommendation Wizard</h4>
                  </div>

                  <div className="space-y-6">
                    {/* Question 1: Top Players Meeting */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                        Should top players meet early or late in the tournament?
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { value: 'early', label: 'Early', desc: 'Top players face off immediately' },
                          { value: 'late', label: 'Late', desc: 'Build suspense, save best for last' },
                          { value: 'mixed', label: 'Mixed', desc: 'Balanced approach' }
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleWizardResponse('topPlayersMeeting', option.value)}
                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                              wizardResponses.topPlayersMeeting === option.value
                                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-jetbrains font-medium">{option.label}</div>
                            <div className="text-xs text-gray-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 2: Avoid Rematches */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                        Do you want to avoid repeat matchups?
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { value: true, label: 'Yes', desc: 'Players should face different opponents each round' },
                          { value: false, label: 'No', desc: 'Rematches are acceptable for better balance' }
                        ].map(option => (
                          <button
                            key={option.value.toString()}
                            onClick={() => handleWizardResponse('avoidRematches', option.value)}
                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                              wizardResponses.avoidRematches === option.value
                                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-jetbrains font-medium">{option.label}</div>
                            <div className="text-xs text-gray-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 3: Same Team Avoidance */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                        Should players from the same team avoid each other?
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { value: true, label: 'Yes', desc: 'Avoid same club/team matchups when possible' },
                          { value: false, label: 'No', desc: 'Team affiliation doesn\'t matter' }
                        ].map(option => (
                          <button
                            key={option.value.toString()}
                            onClick={() => handleWizardResponse('avoidSameTeam', option.value)}
                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                              wizardResponses.avoidSameTeam === option.value
                                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-jetbrains font-medium">{option.label}</div>
                            <div className="text-xs text-gray-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 4: Suspense */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                        Do you want suspense to last until the final round?
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { value: true, label: 'Yes', desc: 'Maximum excitement and unpredictability' },
                          { value: false, label: 'No', desc: 'Clear leaders emerging is fine' }
                        ].map(option => (
                          <button
                            key={option.value.toString()}
                            onClick={() => handleWizardResponse('suspenseUntilEnd', option.value)}
                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                              wizardResponses.suspenseUntilEnd === option.value
                                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-jetbrains font-medium">{option.label}</div>
                            <div className="text-xs text-gray-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 5: Manual vs Computer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                        Are players paired manually or by computer?
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { value: false, label: 'Computer', desc: 'Automated pairing system' },
                          { value: true, label: 'Manual', desc: 'Director creates pairings by hand' }
                        ].map(option => (
                          <button
                            key={option.value.toString()}
                            onClick={() => handleWizardResponse('manualPairing', option.value)}
                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                              wizardResponses.manualPairing === option.value
                                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-jetbrains font-medium">{option.label}</div>
                            <div className="text-xs text-gray-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 6: Competitive Level */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                        What's the competitive level of your tournament?
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { value: 'casual', label: 'Casual', desc: 'Fun, social tournament' },
                          { value: 'competitive', label: 'Competitive', desc: 'Serious but not elite' },
                          { value: 'elite', label: 'Elite', desc: 'High-level championship' }
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleWizardResponse('competitiveLevel', option.value)}
                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                              wizardResponses.competitiveLevel === option.value
                                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-jetbrains font-medium">{option.label}</div>
                            <div className="text-xs text-gray-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 7: Primary Goal */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                        What's your primary goal for this tournament?
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { value: 'fairness', label: 'Fairness', desc: 'Most accurate rankings' },
                          { value: 'suspense', label: 'Suspense', desc: 'Maximum excitement' },
                          { value: 'inclusivity', label: 'Inclusivity', desc: 'Give everyone a chance' },
                          { value: 'implementability', label: 'Simplicity', desc: 'Easy to manage' }
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleWizardResponse('primaryGoal', option.value)}
                            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                              wizardResponses.primaryGoal === option.value
                                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                                : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-jetbrains font-medium">{option.label}</div>
                            <div className="text-xs text-gray-400">{option.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Get Recommendation Button */}
                    <div className="text-center pt-4">
                      <button
                        onClick={runWizard}
                        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200 flex items-center gap-2 mx-auto"
                      >
                        <Brain className="w-5 h-5" />
                        Get My Recommendation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pairing System Scorecard */}
              {showScorecard && (
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-6 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-cyan-400" />
                      <h4 className="text-xl font-bold text-white font-orbitron">Pairing System Scorecard</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white font-orbitron">
                        {currentAnalysis.overallScore}/10
                      </div>
                      <div className="text-xs text-gray-400 font-jetbrains">Overall Score</div>
                    </div>
                  </div>

                  {/* Pairing System Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3 font-jetbrains">
                      Select Pairing System to Analyze
                    </label>
                    <select
                      value={tournamentData.pairingSystem}
                      onChange={(e) => handleInputChange('pairingSystem', e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-cyan-500 focus:outline-none transition-colors duration-300"
                    >
                      <option value="swiss">Swiss</option>
                      <option value="fonte-swiss">Fonte-Swiss</option>
                      <option value="king-of-hill">King of the Hill</option>
                      <option value="round-robin">Round Robin</option>
                      <option value="quartile">Quartile</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>

                  {/* Goals Analysis Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {Object.entries(currentAnalysis.goals).map(([goalId, analysis]) => {
                      const goal = PAIRING_GOALS[goalId];
                      const scoreFormat = formatGoalScore(analysis.score);
                      
                      return (
                        <div key={goalId} className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 group hover:bg-gray-700/50 transition-all duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-jetbrains font-medium text-white">
                              {goal?.name}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`text-lg font-bold font-orbitron ${scoreFormat.color}`}>
                                {analysis.score}/10
                              </div>
                              <div className="flex">
                                {Array.from({ length: 5 }, (_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < Math.round(analysis.score / 2)
                                        ? scoreFormat.color.replace('text-', 'text-') + ' fill-current'
                                        : 'text-gray-600'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mb-2">
                            {goal?.description}
                          </div>
                          <div className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {analysis.explanation}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* System Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-jetbrains font-medium text-green-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        Strengths
                      </h5>
                      <ul className="space-y-2">
                        {currentAnalysis.strengths.map((strength, index) => (
                          <li key={index} className="text-sm text-gray-300 font-jetbrains">
                            • {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-jetbrains font-medium text-red-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        Weaknesses
                      </h5>
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
                      <h5 className="font-jetbrains font-medium text-blue-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        Best For
                      </h5>
                      <ul className="space-y-2">
                        {currentAnalysis.bestFor.map((scenario, index) => (
                          <li key={index} className="text-sm text-gray-300 font-jetbrains">
                            • {scenario}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-jetbrains font-medium text-yellow-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                        Avoid If
                      </h5>
                      <ul className="space-y-2">
                        {currentAnalysis.avoidIf.map((scenario, index) => (
                          <li key={index} className="text-sm text-gray-300 font-jetbrains">
                            • {scenario}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Warning for poor choices */}
                  {currentAnalysis.overallScore < 6 && (
                    <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <span className="text-yellow-400 font-jetbrains font-medium">Consider Alternative</span>
                      </div>
                      <p className="text-yellow-300 font-jetbrains text-sm">
                        This pairing system may not be optimal for your tournament context. Consider the weaknesses listed above.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Current Selection Display */}
              <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-jetbrains font-medium text-white mb-1">
                      Selected Pairing System
                    </h5>
                    <p className="text-gray-400 font-jetbrains text-sm">
                      {tournamentData.pairingSystem.charAt(0).toUpperCase() + tournamentData.pairingSystem.slice(1).replace('-', '-')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold font-orbitron ${formatGoalScore(currentAnalysis.overallScore).color}`}>
                      {currentAnalysis.overallScore}/10
                    </div>
                    <div className="text-xs text-gray-400 font-jetbrains">Overall Score</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Division Naming */}
          {currentStep === 3 && tournamentData.divisions > 1 && (
            <div className="space-y-6 fade-up">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                  Division Names
                </h3>
                <p className="text-gray-400 font-jetbrains">
                  Name each division for your tournament
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: tournamentData.divisions }, (_, index) => (
                  <div key={index} className="fade-up" style={{ animationDelay: `${index * 0.1}s` }}>
                    <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                      Division {index + 1} Name *
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={tournamentData.divisionNames[index] || ''}
                        onChange={(e) => handleDivisionNameChange(index, e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                        placeholder={`Division ${index + 1}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700/50 bg-gray-800/30">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index + 1 <= currentStep
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors duration-200 font-jetbrains"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-jetbrains"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : currentStep === totalSteps ? (
                <>
                  <Trophy size={16} />
                  Create Tournament
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentSetupModal;