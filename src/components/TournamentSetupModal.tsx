import React, { useState } from 'react';
import { X, Calendar, MapPin, Users, Trophy, Zap, Brain, Target, Save, UserCheck, ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WizardResponses, TournamentConfig, PairingFormat } from '../types/database';
import { recommendPairingSystem } from '../utils/pairingStrategyIntelligence';
import { useAuditLog } from '../hooks/useAuditLog';

interface TournamentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tournamentId: string) => void;
}

interface FormData {
  name: string;
  date: string;
  venue: string;
  rounds: number;
  divisions: number;
  divisionNames: string[];
  teamMode: boolean;
  isPasswordProtected: boolean;
  password: string;
  publicSharingEnabled: boolean;
  showPassword: boolean;
}

interface WizardStep {
  id: string;
  question: string;
  description: string;
  options: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'topPlayersMeeting',
    question: 'When should the top players meet?',
    description: 'This affects tournament excitement and fairness',
    options: [
      {
        value: 'early',
        label: 'Early rounds',
        description: 'Top players face each other immediately (King of the Hill style)'
      },
      {
        value: 'late',
        label: 'Later rounds',
        description: 'Top players meet after building records (Swiss style)'
      },
      {
        value: 'mixed',
        label: 'Mixed approach',
        description: 'Balance between early excitement and late suspense'
      }
    ]
  },
  {
    id: 'avoidRematches',
    question: 'Should players avoid playing the same opponent twice?',
    description: 'Rematch avoidance vs. optimal skill matching',
    options: [
      {
        value: 'yes',
        label: 'Yes, avoid rematches',
        description: 'Players should face different opponents each round'
      },
      {
        value: 'no',
        label: 'Allow rematches if needed',
        description: 'Prioritize skill-based pairings over rematch avoidance'
      }
    ]
  },
  {
    id: 'suspenseUntilEnd',
    question: 'How important is suspense until the final round?',
    description: 'Tournament excitement vs. predictable outcomes',
    options: [
      {
        value: 'critical',
        label: 'Critical - maximum suspense',
        description: 'Anyone should be able to win until the very end'
      },
      {
        value: 'important',
        label: 'Important but not critical',
        description: 'Some suspense while maintaining fairness'
      },
      {
        value: 'minimal',
        label: 'Not important',
        description: 'Focus on fair rankings over suspense'
      }
    ]
  },
  {
    id: 'competitiveLevel',
    question: 'What is the competitive level of this tournament?',
    description: 'This affects pairing strategy recommendations',
    options: [
      {
        value: 'casual',
        label: 'Casual/Recreational',
        description: 'Fun-focused event with mixed skill levels'
      },
      {
        value: 'competitive',
        label: 'Competitive',
        description: 'Serious tournament with skilled players'
      },
      {
        value: 'elite',
        label: 'Elite/Professional',
        description: 'High-level competition with expert players'
      }
    ]
  }
];

const PAIRING_FORMATS: Array<{
  id: PairingFormat;
  name: string;
  description: string;
  bestFor: string;
}> = [
  {
    id: 'swiss',
    name: 'Swiss System',
    description: 'Standard tournament format pairing players with similar records',
    bestFor: 'Most competitive tournaments'
  },
  {
    id: 'fonte-swiss',
    name: 'Fonte-Swiss',
    description: 'Advanced Swiss with score-group pairing for maximum fairness',
    bestFor: 'Elite competitive events'
  },
  {
    id: 'king-of-hill',
    name: 'King of the Hill',
    description: 'Highest vs lowest ranked players for maximum suspense',
    bestFor: 'Casual, exciting tournaments'
  },
  {
    id: 'round-robin',
    name: 'Round Robin',
    description: 'Every player plays every other player once',
    bestFor: 'Small tournaments (8 players or fewer)'
  },
  {
    id: 'quartile',
    name: 'Quartile Pairing',
    description: 'Split players into quartiles and pair within groups',
    bestFor: 'Mixed-skill recreational events'
  }
];

const TournamentSetupModal: React.FC<TournamentSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<'basic' | 'pairing-method' | 'wizard' | 'manual-selection' | 'review'>('basic');
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    name: '',
    date: '',
    venue: '',
    rounds: 7,
    divisions: 1,
    divisionNames: ['Main Division'],
    teamMode: false,
    isPasswordProtected: false,
    password: '',
    publicSharingEnabled: true,
    showPassword: false
  });

  // Wizard responses
  const [wizardResponses, setWizardResponses] = useState<Partial<WizardResponses>>({});
  const [selectedPairingFormat, setSelectedPairingFormat] = useState<PairingFormat>('swiss');
  const [recommendedSystem, setRecommendedSystem] = useState<PairingFormat>('swiss');
  const [recommendationReasoning, setRecommendationReasoning] = useState<string>('');

  const { logAction } = useAuditLog();

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Update division names when division count changes
      if (field === 'divisions') {
        const divisionCount = value as number;
        const newDivisionNames = Array.from({ length: divisionCount }, (_, i) => {
          return prev.divisionNames[i] || `Division ${String.fromCharCode(65 + i)}`;
        });
        updated.divisionNames = newDivisionNames;
      }
      
      return updated;
    });
  };

  const handleDivisionNameChange = (index: number, name: string) => {
    setFormData(prev => ({
      ...prev,
      divisionNames: prev.divisionNames.map((n, i) => i === index ? name : n)
    }));
  };

  const validateBasicForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Tournament name is required');
      return false;
    }
    if (!formData.date) {
      setError('Tournament date is required');
      return false;
    }
    if (formData.rounds < 1 || formData.rounds > 15) {
      setError('Number of rounds must be between 1 and 15');
      return false;
    }
    if (formData.divisions < 1 || formData.divisions > 10) {
      setError('Number of divisions must be between 1 and 10');
      return false;
    }
    for (let i = 0; i < formData.divisions; i++) {
      if (!formData.divisionNames[i]?.trim()) {
        setError(`Division ${i + 1} name is required`);
        return false;
      }
    }
    if (formData.isPasswordProtected && !formData.password.trim()) {
      setError('Password is required when password protection is enabled');
      return false;
    }
    return true;
  };

  const handleBasicNext = () => {
    setError(null);
    if (validateBasicForm()) {
      // If team mode is selected, skip pairing method selection and go directly to review
      if (formData.teamMode) {
        setSelectedPairingFormat('team-round-robin');
        setRecommendedSystem('team-round-robin');
        setRecommendationReasoning('Team Round-Robin is automatically selected for team-based tournaments, ensuring each team plays every other team with all possible player matchups.');
        setCurrentStep('review');
      } else {
        setCurrentStep('pairing-method');
      }
    }
  };

  const handlePairingMethodSelection = (method: 'wizard' | 'manual') => {
    if (method === 'wizard') {
      setCurrentStep('wizard');
      setWizardStepIndex(0);
      
      // Log wizard selection
      logAction({
        action: 'pairing_wizard_started',
        details: {
          tournament_name: formData.name
        }
      });
    } else {
      setCurrentStep('manual-selection');
      
      // Log manual selection
      logAction({
        action: 'manual_pairing_selected',
        details: {
          tournament_name: formData.name
        }
      });
    }
  };

  const handleWizardResponse = (value: string) => {
    const currentWizardStep = WIZARD_STEPS[wizardStepIndex];
    const updatedResponses = {
      ...wizardResponses,
      [currentWizardStep.id]: value
    };
    setWizardResponses(updatedResponses);
    
    // Log wizard response
    logAction({
      action: 'pairing_wizard_response',
      details: {
        question: currentWizardStep.id,
        response: value,
        step: wizardStepIndex + 1,
        total_steps: WIZARD_STEPS.length
      }
    });

    if (wizardStepIndex < WIZARD_STEPS.length - 1) {
      setWizardStepIndex(wizardStepIndex + 1);
    } else {
      // Wizard complete, generate recommendation
      generateRecommendation(updatedResponses);
      setCurrentStep('review');
      
      // Log wizard completion
      logAction({
        action: 'pairing_wizard_completed',
        details: {
          responses: updatedResponses
        }
      });
    }
  };

  const handleManualSelection = (format: PairingFormat) => {
    setSelectedPairingFormat(format);
    setRecommendedSystem(format);
    setRecommendationReasoning(`You manually selected ${format.charAt(0).toUpperCase() + format.slice(1).replace('-', ' ')} as your preferred pairing system.`);
    setCurrentStep('review');
    
    // Log manual format selection
    logAction({
      action: 'pairing_format_selected',
      details: {
        format,
        selection_method: 'manual'
      }
    });
  };

  const generateRecommendation = (responses: Partial<WizardResponses>) => {
    // Convert wizard responses to DirectorIntent
    const priorityGoals: string[] = [];
    
    if (responses.topPlayersMeeting === 'late') {
      priorityGoals.push('aristomachy');
    }
    if (responses.avoidRematches === 'yes') {
      priorityGoals.push('monagony');
    }
    if (responses.suspenseUntilEnd === 'critical') {
      priorityGoals.push('suspense');
    }
    
    // Always include fairness as important
    priorityGoals.push('fairness');

    const recommendation = recommendPairingSystem({
      primary: responses.suspenseUntilEnd === 'critical' ? 'Max suspense' : 'Max fairness',
      playerCount: 32, // Estimate
      rounds: formData.rounds,
      competitiveLevel: (responses.competitiveLevel as any) || 'competitive',
      priorityGoals
    });

    setRecommendedSystem(recommendation.primary);
    setSelectedPairingFormat(recommendation.primary);
    setRecommendationReasoning(recommendation.reasoning);
    
    // Log recommendation
    logAction({
      action: 'pairing_recommendation_generated',
      details: {
        recommended_format: recommendation.primary,
        reasoning: recommendation.reasoning,
        wizard_responses: responses
      }
    });
  };

  const handleCreateTournament = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to create a tournament');
      }

      // Prepare tournament data
      const tournamentData = {
        name: formData.name.trim(),
        date: formData.date,
        venue: formData.venue.trim() || null,
        rounds: formData.rounds,
        divisions: formData.divisions,
        director_id: user.id,
        status: 'registration' as const,
        team_mode: formData.teamMode,
        pairing_system: selectedPairingFormat,
        password: formData.isPasswordProtected ? formData.password : null,
        public_sharing_enabled: formData.publicSharingEnabled,
        wizard_responses: {
          ...wizardResponses,
          topPlayersMeeting: wizardResponses.topPlayersMeeting || 'late',
          avoidRematches: wizardResponses.avoidRematches === 'yes',
          avoidSameTeam: formData.teamMode,
          suspenseUntilEnd: wizardResponses.suspenseUntilEnd === 'critical',
          manualPairing: false,
          competitiveLevel: wizardResponses.competitiveLevel || 'competitive',
          primaryGoal: wizardResponses.suspenseUntilEnd === 'critical' ? 'Max suspense' : 'Max fairness'
        } as WizardResponses,
        tournament_config: {
          pairing_system: selectedPairingFormat,
          avoid_rematches: wizardResponses.avoidRematches === 'yes',
          wizard_completed: true,
          recommended_system: recommendedSystem,
          recommendation_reasoning: recommendationReasoning
        } as TournamentConfig
      };

      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert([tournamentData])
        .select()
        .single();

      if (tournamentError) throw tournamentError;

      // Create divisions if multiple
      if (formData.divisions > 1) {
        const divisionsToInsert = formData.divisionNames.map((name, index) => ({
          tournament_id: tournament.id,
          name: name.trim(),
          division_number: index + 1
        }));

        const { error: divisionsError } = await supabase
          .from('divisions')
          .insert(divisionsToInsert);

        if (divisionsError) throw divisionsError;
      } else {
        // Create single default division
        const { error: divisionError } = await supabase
          .from('divisions')
          .insert([{
            tournament_id: tournament.id,
            name: formData.divisionNames[0] || 'Main Division',
            division_number: 1
          }]);

        if (divisionError) throw divisionError;
      }

      // Log tournament creation
      logAction({
        action: 'tournament_created',
        details: {
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          team_mode: formData.teamMode,
          pairing_system: selectedPairingFormat,
          divisions: formData.divisions,
          rounds: formData.rounds,
          password_protected: formData.isPasswordProtected
        }
      });

      // Success! Call the success callback with tournament ID
      onSuccess(tournament.id);

    } catch (err: any) {
      console.error('Error creating tournament:', err);
      setError(err.message || 'Failed to create tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep('basic');
    setWizardStepIndex(0);
    setFormData({
      name: '',
      date: '',
      venue: '',
      rounds: 7,
      divisions: 1,
      divisionNames: ['Main Division'],
      teamMode: false,
      isPasswordProtected: false,
      password: '',
      publicSharingEnabled: true,
      showPassword: false
    });
    setWizardResponses({});
    setSelectedPairingFormat('swiss');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const currentWizardStep = WIZARD_STEPS[wizardStepIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900/95 backdrop-blur-lg border-2 border-blue-500/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-blue-500/30 bg-gradient-to-r from-blue-900/30 to-purple-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white font-orbitron">
                {currentStep === 'basic' ? 'Create Tournament' :
                 currentStep === 'pairing-method' ? 'Choose Pairing Method' :
                 currentStep === 'wizard' ? 'Tournament Setup Wizard' :
                 currentStep === 'manual-selection' ? 'Select Pairing Format' :
                 'Review & Create'}
              </h2>
              <p className="text-blue-300 font-jetbrains">
                {currentStep === 'basic' ? 'Set up your tournament details' :
                 currentStep === 'pairing-method' ? 'AI recommendation or manual selection' :
                 currentStep === 'wizard' ? `Question ${wizardStepIndex + 1} of ${WIZARD_STEPS.length}` :
                 currentStep === 'manual-selection' ? 'Choose your preferred pairing system' :
                 'Review your settings and create tournament'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Basic Information Step */}
          {currentStep === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tournament Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                    placeholder="Enter tournament name"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                  />
                </div>

                {/* Venue */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Venue
                  </label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => handleInputChange('venue', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                    placeholder="Tournament venue"
                  />
                </div>

                {/* Rounds */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    <Trophy className="w-4 h-4 inline mr-2" />
                    Number of Rounds *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={formData.rounds}
                    onChange={(e) => handleInputChange('rounds', parseInt(e.target.value) || 7)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                  />
                </div>

                {/* Divisions */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                    <Users className="w-4 h-4 inline mr-2" />
                    Number of Divisions *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.divisions}
                    onChange={(e) => handleInputChange('divisions', parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                  />
                </div>
              </div>

              {/* Team Mode Toggle */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-6 h-6 text-blue-400" />
                    <div>
                      <h3 className="text-lg font-bold text-white font-orbitron">Team Mode</h3>
                      <p className="text-blue-300 font-jetbrains text-sm">Enable team-based competition</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleInputChange('teamMode', !formData.teamMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                      formData.teamMode ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        formData.teamMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {formData.teamMode && (
                  <div className="text-blue-200 font-jetbrains text-sm">
                    <p className="mb-2">✅ Team mode enabled - players will be grouped into teams</p>
                    <p className="text-xs text-blue-300">Teams will compete against each other with automatic round-robin scheduling</p>
                  </div>
                )}
              </div>

              {/* Password Protection */}
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Lock className="w-6 h-6 text-purple-400" />
                    <div>
                      <h3 className="text-lg font-bold text-white font-orbitron">Password Protection</h3>
                      <p className="text-purple-300 font-jetbrains text-sm">Require a password to view tournament</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleInputChange('isPasswordProtected', !formData.isPasswordProtected)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                      formData.isPasswordProtected ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        formData.isPasswordProtected ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {formData.isPasswordProtected && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2 font-jetbrains">
                      Tournament Password *
                    </label>
                    <div className="relative">
                      <input
                        type={formData.showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 font-jetbrains pr-10"
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => handleInputChange('showPassword', !formData.showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200"
                      >
                        {formData.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-purple-300 mt-2 font-jetbrains">
                      This password will be required to view the tournament
                    </p>
                  </div>
                )}
              </div>

              {/* Public Sharing */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Share2 className="w-6 h-6 text-green-400" />
                    <div>
                      <h3 className="text-lg font-bold text-white font-orbitron">Public Sharing</h3>
                      <p className="text-green-300 font-jetbrains text-sm">Allow public access to tournament</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleInputChange('publicSharingEnabled', !formData.publicSharingEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                      formData.publicSharingEnabled ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        formData.publicSharingEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                <p className="text-green-200 font-jetbrains text-sm">
                  {formData.publicSharingEnabled 
                    ? '✅ Tournament will be publicly viewable via shared link' 
                    : '❌ Tournament will be private and cannot be shared'}
                </p>
              </div>

              {/* Division Names */}
              {formData.divisions > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4 font-jetbrains">
                    Division Names
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.divisionNames.slice(0, formData.divisions).map((name, index) => (
                      <input
                        key={index}
                        type="text"
                        value={name}
                        onChange={(e) => handleDivisionNameChange(index, e.target.value)}
                        className="px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
                        placeholder={`Division ${index + 1} name`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
                  {error}
                </div>
              )}

              {/* Next Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleBasicNext}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  <ArrowRight size={16} />
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Pairing Method Selection */}
          {currentStep === 'pairing-method' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                  Choose Your Pairing Method
                </h3>
                <p className="text-gray-400 font-jetbrains">
                  How would you like to determine the best pairing system for your tournament?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* AI Recommendation Option */}
                <button
                  onClick={() => handlePairingMethodSelection('wizard')}
                  className="group p-8 bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-500/30 rounded-2xl hover:border-purple-400/50 hover:from-purple-900/40 hover:to-blue-900/40 transition-all duration-300 text-left"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Brain className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-white font-orbitron group-hover:text-purple-300 transition-colors duration-300">
                        🤖 AI Recommendation
                      </h4>
                      <p className="text-purple-300 font-jetbrains">Intelligent pairing wizard</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 font-jetbrains mb-4 leading-relaxed">
                    Answer a few strategic questions and let our AI recommend the optimal pairing system based on your tournament goals, player count, and competitive level.
                  </p>
                  
                  <div className="flex items-center gap-2 text-purple-400 font-jetbrains text-sm">
                    <Zap className="w-4 h-4" />
                    <span>Recommended for most tournaments</span>
                  </div>
                </button>

                {/* Manual Selection Option */}
                <button
                  onClick={() => handlePairingMethodSelection('manual')}
                  className="group p-8 bg-gradient-to-br from-cyan-900/30 to-green-900/30 border-2 border-cyan-500/30 rounded-2xl hover:border-cyan-400/50 hover:from-cyan-900/40 hover:to-green-900/40 transition-all duration-300 text-left"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Target className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-white font-orbitron group-hover:text-cyan-300 transition-colors duration-300">
                        🎯 Manual Selection
                      </h4>
                      <p className="text-cyan-300 font-jetbrains">Direct format choice</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 font-jetbrains mb-4 leading-relaxed">
                    Browse and select from available pairing formats directly. Perfect if you already know which system you want to use for your tournament.
                  </p>
                  
                  <div className="flex items-center gap-2 text-cyan-400 font-jetbrains text-sm">
                    <Users className="w-4 h-4" />
                    <span>For experienced tournament directors</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step */}
          {currentStep === 'wizard' && currentWizardStep && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                  {currentWizardStep.question}
                </h3>
                <p className="text-gray-400 font-jetbrains">
                  {currentWizardStep.description}
                </p>
              </div>

              <div className="space-y-4">
                {currentWizardStep.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleWizardResponse(option.value)}
                    className="w-full p-6 bg-gray-800/50 border border-gray-600 rounded-lg hover:bg-gray-700/50 hover:border-blue-500/50 transition-all duration-200 text-left group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 border-2 border-gray-500 rounded-full group-hover:border-blue-400 transition-colors duration-200 flex-shrink-0 mt-1"></div>
                      <div>
                        <div className="text-white font-medium font-jetbrains mb-2">
                          {option.label}
                        </div>
                        <div className="text-gray-400 font-jetbrains text-sm">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Progress */}
              <div className="mt-8">
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  <span>Progress</span>
                  <span>{wizardStepIndex + 1} of {WIZARD_STEPS.length}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((wizardStepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Manual Selection */}
          {currentStep === 'manual-selection' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                  Select Pairing Format
                </h3>
                <p className="text-gray-400 font-jetbrains">
                  Choose the pairing system that best fits your tournament
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PAIRING_FORMATS.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleManualSelection(format.id)}
                    className="p-6 bg-gray-800/50 border border-gray-600 rounded-lg hover:bg-gray-700/50 hover:border-cyan-500/50 transition-all duration-200 text-left group"
                  >
                    <div className="mb-4">
                      <h4 className="text-lg font-bold text-white font-orbitron mb-2 group-hover:text-cyan-300 transition-colors duration-200">
                        {format.name}
                      </h4>
                      <p className="text-gray-400 font-jetbrains text-sm mb-3">
                        {format.description}
                      </p>
                      <div className="text-cyan-400 font-jetbrains text-xs">
                        Best for: {format.bestFor}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
                  Review Your Tournament
                </h3>
                <p className="text-gray-400 font-jetbrains">
                  Confirm your settings and create the tournament
                </p>
              </div>

              {/* Tournament Summary */}
              <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6">
                <h4 className="text-lg font-bold text-white font-orbitron mb-4">Tournament Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Name:</span>
                    <span className="text-white ml-2 font-jetbrains">{formData.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Date:</span>
                    <span className="text-white ml-2 font-jetbrains">{formData.date}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Venue:</span>
                    <span className="text-white ml-2 font-jetbrains">{formData.venue || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Rounds:</span>
                    <span className="text-white ml-2 font-jetbrains">{formData.rounds}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Divisions:</span>
                    <span className="text-white ml-2 font-jetbrains">{formData.divisions}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white ml-2 font-jetbrains flex items-center gap-1">
                      {formData.teamMode ? (
                        <>
                          <UserCheck className="w-4 h-4 text-blue-400" />
                          Team Tournament
                        </>
                      ) : (
                        'Individual Tournament'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Password Protected:</span>
                    <span className="text-white ml-2 font-jetbrains flex items-center gap-1">
                      {formData.isPasswordProtected ? (
                        <>
                          <Lock className="w-4 h-4 text-purple-400" />
                          Yes
                        </>
                      ) : (
                        'No'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Public Sharing:</span>
                    <span className="text-white ml-2 font-jetbrains flex items-center gap-1">
                      {formData.publicSharingEnabled ? (
                        <>
                          <Share2 className="w-4 h-4 text-green-400" />
                          Enabled
                        </>
                      ) : (
                        'Disabled'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommended Pairing System */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                <h4 className="text-lg font-bold text-blue-300 font-orbitron mb-4 flex items-center gap-2">
                  <Target size={20} />
                  {formData.teamMode ? 'Selected' : 'Recommended'} Pairing System
                </h4>
                <div className="text-white font-jetbrains mb-2 text-lg">
                  {selectedPairingFormat.charAt(0).toUpperCase() + selectedPairingFormat.slice(1).replace('-', ' ')}
                </div>
                <div className="text-gray-300 font-jetbrains text-sm">
                  {recommendationReasoning}
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
                  {error}
                </div>
              )}

              {/* Create Button */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setCurrentStep(formData.teamMode ? 'basic' : 'pairing-method')}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateTournament}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Tournament...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Create Tournament
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentSetupModal;