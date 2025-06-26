import React, { useState } from 'react';
import { X, Calendar, MapPin, Users, Trophy, Zap, Brain, Target, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WizardResponses, TournamentConfig, PairingFormat } from '../types/database';
import { recommendPairingSystem } from '../utils/pairingStrategyIntelligence';

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

const TournamentSetupModal: React.FC<TournamentSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<'basic' | 'wizard' | 'review'>('basic');
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
    divisionNames: ['Main Division']
  });

  // Wizard responses
  const [wizardResponses, setWizardResponses] = useState<Partial<WizardResponses>>({});
  const [recommendedSystem, setRecommendedSystem] = useState<PairingFormat>('swiss');
  const [recommendationReasoning, setRecommendationReasoning] = useState<string>('');

  const handleInputChange = (field: keyof FormData, value: string | number) => {
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
    return true;
  };

  const handleBasicNext = () => {
    setError(null);
    if (validateBasicForm()) {
      setCurrentStep('wizard');
      setWizardStepIndex(0);
    }
  };

  const handleWizardResponse = (value: string) => {
    const currentWizardStep = WIZARD_STEPS[wizardStepIndex];
    const updatedResponses = {
      ...wizardResponses,
      [currentWizardStep.id]: value
    };
    setWizardResponses(updatedResponses);

    if (wizardStepIndex < WIZARD_STEPS.length - 1) {
      setWizardStepIndex(wizardStepIndex + 1);
    } else {
      // Wizard complete, generate recommendation
      generateRecommendation(updatedResponses);
      setCurrentStep('review');
    }
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
    setRecommendationReasoning(recommendation.reasoning);
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
        pairing_system: recommendedSystem,
        wizard_responses: {
          ...wizardResponses,
          topPlayersMeeting: wizardResponses.topPlayersMeeting || 'late',
          avoidRematches: wizardResponses.avoidRematches === 'yes',
          avoidSameTeam: false,
          suspenseUntilEnd: wizardResponses.suspenseUntilEnd === 'critical',
          manualPairing: false,
          competitiveLevel: wizardResponses.competitiveLevel || 'competitive',
          primaryGoal: wizardResponses.suspenseUntilEnd === 'critical' ? 'Max suspense' : 'Max fairness'
        } as WizardResponses,
        tournament_config: {
          pairing_system: recommendedSystem,
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
      divisionNames: ['Main Division']
    });
    setWizardResponses({});
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
                 currentStep === 'wizard' ? 'Pairing Strategy Wizard' :
                 'Review & Create'}
              </h2>
              <p className="text-blue-300 font-jetbrains">
                {currentStep === 'basic' ? 'Set up your tournament details' :
                 currentStep === 'wizard' ? `Question ${wizardStepIndex + 1} of ${WIZARD_STEPS.length}` :
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
                  <Brain size={16} />
                  Continue to Pairing Wizard
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
                </div>
              </div>

              {/* Recommended Pairing System */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                <h4 className="text-lg font-bold text-blue-300 font-orbitron mb-4 flex items-center gap-2">
                  <Target size={20} />
                  Recommended Pairing System
                </h4>
                <div className="text-white font-jetbrains mb-2 text-lg">
                  {recommendedSystem.charAt(0).toUpperCase() + recommendedSystem.slice(1).replace('-', '-')}
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
                  onClick={() => setCurrentStep('wizard')}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
                >
                  Back to Wizard
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