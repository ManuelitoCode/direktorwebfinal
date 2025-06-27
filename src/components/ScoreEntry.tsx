import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic, Trophy, Save, MicOff, Edit3, AlertTriangle, History, X, Check, RefreshCw } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import { supabase } from '../lib/supabase';
import { useAuditLog } from '../hooks/useAuditLog';
import { Tournament, PairingWithPlayers, Result } from '../types/database';

interface ScoreEntryProps {
  onBack: () => void;
  onNext: () => void;
  tournamentId: string;
  currentRound: number;
}

interface ScoreInput {
  pairingId: string;
  player1Score: number | '';
  player2Score: number | '';
  winnerId?: string;
  hasChanges?: boolean;
  isEdited?: boolean;
}

interface ScoreHistory {
  id: string;
  pairing_id: string;
  player1_score: number;
  player2_score: number;
  submitted_by: string | null;
  created_at: string;
  player1_name: string;
  player2_name: string;
}

const ScoreEntry: React.FC<ScoreEntryProps> = ({ 
  onBack, 
  onNext, 
  tournamentId, 
  currentRound 
}) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pairings, setPairings] = useState<PairingWithPlayers[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreInput>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [selectedPairingForHistory, setSelectedPairingForHistory] = useState<string | null>(null);
  const [pastRounds, setPastRounds] = useState<number[]>([]);
  const [selectedPastRound, setSelectedPastRound] = useState<number | null>(null);
  const [pastRoundScores, setPastRoundScores] = useState<Record<string, ScoreInput>>({});
  const [isEditingPastRound, setIsEditingPastRound] = useState(false);
  
  const { logAction } = useAuditLog();
  const scoreInputRefs = useRef<Record<string, HTMLInputElement>>({});

  useEffect(() => {
    loadData();
    initializeSpeechRecognition();
    loadPastRounds();
  }, [tournamentId, currentRound]);
  
  useEffect(() => {
    if (selectedPastRound !== null) {
      loadPastRoundScores(selectedPastRound);
    }
  }, [selectedPastRound]);

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const score = parseVoiceInput(transcript);
        
        if (score !== null && listeningFor) {
          const [pairingId, player] = listeningFor.split('-');
          handleScoreChange(pairingId, player as 'player1' | 'player2', score);
        }
        
        setListeningFor(null);
      };
      
      recognitionInstance.onerror = () => {
        setListeningFor(null);
      };
      
      recognitionInstance.onend = () => {
        setListeningFor(null);
      };
      
      setRecognition(recognitionInstance);
    }
  };

  const parseVoiceInput = (transcript: string): number | null => {
    // Remove common words and clean up
    const cleaned = transcript.toLowerCase()
      .replace(/\b(score|points?|is|was|got|scored)\b/g, '')
      .trim();
    
    // Try to extract number
    const numberMatch = cleaned.match(/\d+/);
    if (numberMatch) {
      const score = parseInt(numberMatch[0], 10);
      return score >= 0 && score <= 9999 ? score : null;
    }
    
    return null;
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Load pairings with player details
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

      // Load existing results
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('round_number', currentRound);
        
      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }

      // Initialize scores state
      const initialScores: Record<string, ScoreInput> = {};
      pairingsData.forEach(pairing => {
        const existingResult = resultsData?.find(r => r.pairing_id === pairing.id);
        
        initialScores[pairing.id] = {
          pairingId: pairing.id,
          player1Score: existingResult ? existingResult.player1_score : '',
          player2Score: existingResult ? existingResult.player2_score : '',
          winnerId: existingResult?.winner_id,
          hasChanges: false,
          isEdited: false
        };
      });
      setScores(initialScores);
      
      // Log access
      logAction({
        action: 'score_entry_accessed',
        details: {
          tournament_id: tournamentId,
          round: currentRound,
          pairing_count: pairingsData.length
        }
      });

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadPastRounds = async () => {
    try {
      // Get all rounds with results
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('round_number')
        .eq('tournament_id', tournamentId)
        .order('round_number');
        
      if (resultsError) throw resultsError;
      
      // Extract unique round numbers less than current round
      const rounds = [...new Set(resultsData?.map(r => r.round_number) || [])]
        .filter(round => round < currentRound)
        .sort((a, b) => b - a); // Sort descending
        
      setPastRounds(rounds);
    } catch (err) {
      console.error('Error loading past rounds:', err);
    }
  };
  
  const loadPastRoundScores = async (round: number) => {
    try {
      setIsLoading(true);
      
      // Load pairings for the selected round
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select(`
          *,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        `)
        .eq('tournament_id', tournamentId)
        .eq('round_number', round)
        .order('table_number');

      if (pairingsError) throw pairingsError;
      
      // Load results for the selected round
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('round_number', round);
        
      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }
      
      // Initialize scores state for past round
      const pastScores: Record<string, ScoreInput> = {};
      pairingsData.forEach(pairing => {
        const existingResult = resultsData?.find(r => r.pairing_id === pairing.id);
        
        pastScores[pairing.id] = {
          pairingId: pairing.id,
          player1Score: existingResult ? existingResult.player1_score : '',
          player2Score: existingResult ? existingResult.player2_score : '',
          winnerId: existingResult?.winner_id,
          hasChanges: false,
          isEdited: false
        };
      });
      
      setPastRoundScores(pastScores);
      setPairings(pairingsData as PairingWithPlayers[]);
      
    } catch (err) {
      console.error('Error loading past round scores:', err);
      setError(`Failed to load scores for round ${round}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadScoreHistory = async (pairingId: string) => {
    try {
      setIsLoading(true);
      
      // Get pairing details for player names
      const { data: pairingData, error: pairingError } = await supabase
        .from('pairings')
        .select(`
          *,
          player1:players!pairings_player1_id_fkey(id, name),
          player2:players!pairings_player2_id_fkey(id, name)
        `)
        .eq('id', pairingId)
        .single();
        
      if (pairingError) throw pairingError;
      
      // Get audit logs for this pairing
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'score_updated')
        .filter('details->pairing_id', 'eq', pairingId)
        .order('timestamp', { ascending: false });
        
      if (auditError) throw auditError;
      
      // Format history data
      const history: ScoreHistory[] = (auditData || []).map(log => ({
        id: log.id,
        pairing_id: pairingId,
        player1_score: log.details.player1_score || 0,
        player2_score: log.details.player2_score || 0,
        submitted_by: log.user_id,
        created_at: log.timestamp,
        player1_name: pairingData.player1.name,
        player2_name: pairingData.player2.name
      }));
      
      setScoreHistory(history);
      setSelectedPairingForHistory(pairingId);
      setShowHistory(true);
      
    } catch (err) {
      console.error('Error loading score history:', err);
      setError('Failed to load score history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreChange = (pairingId: string, player: 'player1' | 'player2', value: number | string) => {
    const numValue = value === '' ? '' : Number(value);
    
    setScores(prev => {
      const updated = {
        ...prev,
        [pairingId]: {
          ...prev[pairingId],
          [`${player}Score`]: numValue,
          hasChanges: true,
          isEdited: true
        }
      };

      // Determine winner
      const pairing = updated[pairingId];
      if (pairing.player1Score !== '' && pairing.player2Score !== '') {
        const score1 = Number(pairing.player1Score);
        const score2 = Number(pairing.player2Score);
        const pairingData = pairings.find(p => p.id === pairingId);
        
        if (pairingData) {
          if (score1 > score2) {
            updated[pairingId].winnerId = pairingData.player1_id;
          } else if (score2 > score1) {
            updated[pairingId].winnerId = pairingData.player2_id;
          } else {
            updated[pairingId].winnerId = undefined; // Tie
          }
        }
      }

      return updated;
    });
    
    // Validate scores
    validateScores();
  };
  
  const handlePastRoundScoreChange = (pairingId: string, player: 'player1' | 'player2', value: number | string) => {
    const numValue = value === '' ? '' : Number(value);
    
    setPastRoundScores(prev => {
      const updated = {
        ...prev,
        [pairingId]: {
          ...prev[pairingId],
          [`${player}Score`]: numValue,
          hasChanges: true,
          isEdited: true
        }
      };

      // Determine winner
      const pairing = updated[pairingId];
      if (pairing.player1Score !== '' && pairing.player2Score !== '') {
        const score1 = Number(pairing.player1Score);
        const score2 = Number(pairing.player2Score);
        const pairingData = pairings.find(p => p.id === pairingId);
        
        if (pairingData) {
          if (score1 > score2) {
            updated[pairingId].winnerId = pairingData.player1_id;
          } else if (score2 > score1) {
            updated[pairingId].winnerId = pairingData.player2_id;
          } else {
            updated[pairingId].winnerId = undefined; // Tie
          }
        }
      }

      return updated;
    });
  };

  const startVoiceInput = (pairingId: string, player: 'player1' | 'player2') => {
    if (!recognition) {
      alert('Voice recognition is not supported in your browser');
      return;
    }

    const key = `${pairingId}-${player}`;
    setListeningFor(key);
    recognition.start();
  };

  const stopVoiceInput = () => {
    if (recognition) {
      recognition.stop();
    }
    setListeningFor(null);
  };

  const validateScores = (): boolean => {
    const newWarnings: string[] = [];
    
    // Check for missing scores
    const missingScores = Object.values(scores).filter(score => 
      score.player1Score === '' || score.player2Score === ''
    );
    
    if (missingScores.length > 0) {
      newWarnings.push(`Missing scores for ${missingScores.length} pairings`);
    }
    
    // Check for unusual score differences (potential errors)
    const unusualScores = Object.values(scores).filter(score => {
      if (score.player1Score === '' || score.player2Score === '') return false;
      
      const score1 = Number(score.player1Score);
      const score2 = Number(score.player2Score);
      const diff = Math.abs(score1 - score2);
      
      // Flag very large score differences (over 300 points)
      return diff > 300;
    });
    
    if (unusualScores.length > 0) {
      newWarnings.push(`${unusualScores.length} pairings have unusually large score differences`);
    }
    
    // Check for very low scores (potential errors)
    const lowScores = Object.values(scores).filter(score => {
      if (score.player1Score === '' || score.player2Score === '') return false;
      
      const score1 = Number(score.player1Score);
      const score2 = Number(score.player2Score);
      
      // Flag very low scores (under 200 points)
      return score1 < 200 || score2 < 200;
    });
    
    if (lowScores.length > 0) {
      newWarnings.push(`${lowScores.length} pairings have unusually low scores (below 200)`);
    }
    
    setWarnings(newWarnings);
    return missingScores.length === 0;
  };

  const handleSubmitScores = async () => {
    if (!validateScores()) {
      if (!confirm('Some scores are missing or unusual. Continue anyway?')) {
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      // Prepare results data with tournament_id
      const resultsToInsert: Omit<Result, 'id' | 'created_at'>[] = Object.values(scores).map(score => ({
        pairing_id: score.pairingId,
        tournament_id: tournamentId, // Include tournament_id for direct relationship
        round_number: currentRound,
        player1_score: Number(score.player1Score),
        player2_score: Number(score.player2Score),
        winner_id: score.winnerId || null,
        submitted_by: null // Could be user ID if needed
      }));

      // Delete existing results for this round (in case of re-entry)
      await supabase
        .from('results')
        .delete()
        .eq('round_number', currentRound)
        .eq('tournament_id', tournamentId);

      // Insert new results
      const { error: insertError } = await supabase
        .from('results')
        .insert(resultsToInsert);

      if (insertError) throw insertError;
      
      // Log scores submitted
      logAction({
        action: 'scores_submitted',
        details: {
          tournament_id: tournamentId,
          round: currentRound,
          score_count: resultsToInsert.length
        }
      });

      // Navigate to standings
      onNext();
    } catch (err) {
      console.error('Error saving scores:', err);
      setError('Failed to save scores. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleUpdatePastRoundScores = async () => {
    if (selectedPastRound === null) return;
    
    setIsSaving(true);
    setError(null);

    try {
      // Prepare results data
      const resultsToUpdate: Omit<Result, 'id' | 'created_at'>[] = Object.values(pastRoundScores)
        .filter(score => score.hasChanges)
        .map(score => ({
          pairing_id: score.pairingId,
          tournament_id: tournamentId,
          round_number: selectedPastRound,
          player1_score: Number(score.player1Score),
          player2_score: Number(score.player2Score),
          winner_id: score.winnerId || null,
          submitted_by: null
        }));
        
      if (resultsToUpdate.length === 0) {
        setError('No changes to save');
        setIsSaving(false);
        return;
      }

      // Update results
      for (const result of resultsToUpdate) {
        // Get existing result ID
        const { data: existingResult } = await supabase
          .from('results')
          .select('id')
          .eq('pairing_id', result.pairing_id)
          .eq('round_number', selectedPastRound)
          .single();
          
        if (existingResult) {
          // Update existing result
          const { error: updateError } = await supabase
            .from('results')
            .update({
              player1_score: result.player1_score,
              player2_score: result.player2_score,
              winner_id: result.winner_id
            })
            .eq('id', existingResult.id);
            
          if (updateError) throw updateError;
          
          // Log score update in audit log
          logAction({
            action: 'score_updated',
            details: {
              tournament_id: tournamentId,
              round: selectedPastRound,
              pairing_id: result.pairing_id,
              player1_score: result.player1_score,
              player2_score: result.player2_score
            }
          });
        } else {
          // Insert new result
          const { error: insertError } = await supabase
            .from('results')
            .insert([result]);
            
          if (insertError) throw insertError;
          
          // Log score added in audit log
          logAction({
            action: 'score_added',
            details: {
              tournament_id: tournamentId,
              round: selectedPastRound,
              pairing_id: result.pairing_id,
              player1_score: result.player1_score,
              player2_score: result.player2_score
            }
          });
        }
      }
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-green-500/50';
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          Past round scores updated successfully!
        </div>
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
      
      // Reset editing state
      setIsEditingPastRound(false);
      
      // Reload current round data
      await loadData();
      
    } catch (err) {
      console.error('Error updating past round scores:', err);
      setError('Failed to update past round scores');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCancelPastRoundEdit = () => {
    setIsEditingPastRound(false);
    setSelectedPastRound(null);
    loadData(); // Reload current round data
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

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
            <div className="flex items-center gap-2 text-purple-400">
              <Trophy size={24} />
              <span className="font-jetbrains text-sm">Score Entry</span>
            </div>
          </div>

          <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
              data-text="SCORE ENTRY">
            📝 SCORE ENTRY
          </h1>
          
          {tournament && (
            <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-purple-400 mb-4 font-medium">
              {tournament.name} - Round {selectedPastRound !== null ? selectedPastRound : currentRound}
              {selectedPastRound !== null && (
                <span className="ml-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm rounded font-jetbrains">
                  Editing Past Round
                </span>
              )}
            </p>
          )}
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Enter scores for each pairing below. Use voice or manual input.
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full"></div>
        </div>
        
        {/* Past Rounds Selector */}
        {pastRounds.length > 0 && !isEditingPastRound && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-300 font-jetbrains font-medium">Edit Past Round Scores</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPastRound || ''}
                    onChange={(e) => setSelectedPastRound(e.target.value ? parseInt(e.target.value) : null)}
                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select a round</option>
                    {pastRounds.map(round => (
                      <option key={round} value={round}>Round {round}</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => setIsEditingPastRound(true)}
                    disabled={selectedPastRound === null}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                  >
                    <Edit3 size={16} />
                    Edit Scores
                  </button>
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
        
        {/* Warnings Display */}
        {warnings.length > 0 && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 font-jetbrains text-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} />
                <span className="font-bold">Warnings</span>
              </div>
              <ul className="space-y-1 ml-6 list-disc">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Score Entry Table */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                <Trophy size={24} />
                Round {selectedPastRound !== null ? selectedPastRound : currentRound} Scores
                {isEditingPastRound && (
                  <span className="ml-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm rounded font-jetbrains">
                    Editing Mode
                  </span>
                )}
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Table</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 1</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">VS</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 2</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Winner</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {pairings.map((pairing) => {
                    const score = isEditingPastRound 
                      ? pastRoundScores[pairing.id] 
                      : scores[pairing.id];
                      
                    if (!score) return null;
                    
                    const isPlayer1Winner = score?.winnerId === pairing.player1_id;
                    const isPlayer2Winner = score?.winnerId === pairing.player2_id;
                    
                    return (
                      <tr key={pairing.id} className={`bg-gray-900/30 hover:bg-gray-800/30 transition-colors duration-200 ${
                        score?.isEdited ? 'bg-blue-900/20 border-y border-blue-500/30' : ''
                      }`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono font-bold">
                          {pairing.table_number}
                        </td>
                        
                        {/* Player 1 */}
                        <td className={`px-6 py-4 whitespace-nowrap ${isPlayer1Winner ? 'bg-green-500/20 border border-green-500/50 rounded-l-lg' : ''}`}>
                          <div className="flex items-center gap-2">
                            {isPlayer1Winner && <Trophy className="w-4 h-4 text-yellow-400" />}
                            <div>
                              <div className="text-sm font-medium text-white">
                                {pairing.player1.name}
                              </div>
                              <div className="text-xs text-gray-400 font-jetbrains">
                                #{pairing.player1_rank} • {pairing.player1.rating}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Player 1 Score */}
                        <td className={`px-6 py-4 text-center ${isPlayer1Winner ? 'bg-green-500/20 border-t border-b border-green-500/50' : ''}`}>
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="9999"
                              value={score?.player1Score || ''}
                              onChange={(e) => isEditingPastRound 
                                ? handlePastRoundScoreChange(pairing.id, 'player1', e.target.value)
                                : handleScoreChange(pairing.id, 'player1', e.target.value)
                              }
                              className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-purple-500 focus:outline-none transition-colors duration-300"
                              placeholder="0"
                              ref={el => {
                                if (el) scoreInputRefs.current[`${pairing.id}-player1`] = el;
                              }}
                            />
                            {!isEditingPastRound && (
                              <button
                                onClick={() => startVoiceInput(pairing.id, 'player1')}
                                disabled={listeningFor === `${pairing.id}-player1`}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                  listeningFor === `${pairing.id}-player1`
                                    ? 'bg-red-600 text-white animate-pulse'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                }`}
                              >
                                {listeningFor === `${pairing.id}-player1` ? (
                                  <MicOff size={16} />
                                ) : (
                                  <Mic size={16} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        
                        {/* VS */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-gray-500 font-bold">VS</span>
                        </td>
                        
                        {/* Player 2 Score */}
                        <td className={`px-6 py-4 text-center ${isPlayer2Winner ? 'bg-green-500/20 border-t border-b border-green-500/50' : ''}`}>
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="9999"
                              value={score?.player2Score || ''}
                              onChange={(e) => isEditingPastRound 
                                ? handlePastRoundScoreChange(pairing.id, 'player2', e.target.value)
                                : handleScoreChange(pairing.id, 'player2', e.target.value)
                              }
                              className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-purple-500 focus:outline-none transition-colors duration-300"
                              placeholder="0"
                              ref={el => {
                                if (el) scoreInputRefs.current[`${pairing.id}-player2`] = el;
                              }}
                            />
                            {!isEditingPastRound && (
                              <button
                                onClick={() => startVoiceInput(pairing.id, 'player2')}
                                disabled={listeningFor === `${pairing.id}-player2`}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                  listeningFor === `${pairing.id}-player2`
                                    ? 'bg-red-600 text-white animate-pulse'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                }`}
                              >
                                {listeningFor === `${pairing.id}-player2` ? (
                                  <MicOff size={16} />
                                ) : (
                                  <Mic size={16} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        
                        {/* Player 2 */}
                        <td className={`px-6 py-4 whitespace-nowrap ${isPlayer2Winner ? 'bg-green-500/20 border border-green-500/50 rounded-r-lg' : ''}`}>
                          <div className="flex items-center gap-2">
                            {isPlayer2Winner && <Trophy className="w-4 h-4 text-yellow-400" />}
                            <div>
                              <div className="text-sm font-medium text-white">
                                {pairing.player2.name}
                              </div>
                              <div className="text-xs text-gray-400 font-jetbrains">
                                #{pairing.player2_rank} • {pairing.player2.rating}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Winner */}
                        <td className="px-6 py-4 text-center">
                          {score?.winnerId && (
                            <div className="flex items-center justify-center gap-1">
                              <Trophy className="w-4 h-4 text-yellow-400" />
                              <span className="text-xs text-yellow-400 font-jetbrains">
                                {isPlayer1Winner ? 'P1' : 'P2'}
                              </span>
                            </div>
                          )}
                          {score?.player1Score !== '' && score?.player2Score !== '' && !score?.winnerId && (
                            <span className="text-xs text-gray-400 font-jetbrains">TIE</span>
                          )}
                        </td>
                        
                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {!isEditingPastRound && (
                              <button
                                onClick={() => loadScoreHistory(pairing.id)}
                                className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white transition-all duration-200"
                                title="View Score History"
                              >
                                <History size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Voice Input Status */}
        {listeningFor && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-red-300">
                <Mic className="w-5 h-5 animate-pulse" />
                <span className="font-jetbrains">Listening for score... Speak clearly</span>
                <button
                  onClick={stopVoiceInput}
                  className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors duration-200"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="fade-up text-center mb-8">
          {isEditingPastRound ? (
            <div className="flex items-center justify-center gap-4">
              <Button
                icon={Save}
                label={isSaving ? 'Saving Changes...' : 'Save Past Round Changes'}
                onClick={handleUpdatePastRoundScores}
                variant="green"
                className="max-w-md"
                disabled={isSaving}
              />
              
              <button
                onClick={handleCancelPastRoundEdit}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-200"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          ) : (
            <Button
              icon={Save}
              label={isSaving ? 'Saving Scores...' : 'Submit Scores & View Standings'}
              onClick={handleSubmitScores}
              variant="green"
              className="max-w-md mx-auto"
              disabled={isSaving}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Click 🎤 for voice input or enter scores manually
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>
      
      {/* Score History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-2xl bg-gray-900/95 backdrop-blur-lg border-2 border-blue-500/50 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-2 border-blue-500/30 bg-gradient-to-r from-blue-900/30 to-purple-900/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <History className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white font-orbitron">
                    Score History
                  </h2>
                  <p className="text-blue-300 font-jetbrains">
                    View previous score entries
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowHistory(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {scoreHistory.length > 0 ? (
                <div className="space-y-4">
                  {scoreHistory.map((entry, index) => (
                    <div 
                      key={entry.id}
                      className="bg-gray-800/50 border border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-300 font-jetbrains">
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400 font-jetbrains">
                          {index === 0 ? 'Current' : `Revision ${scoreHistory.length - index}`}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-white">
                            {entry.player1_name}
                          </div>
                          <div className="text-lg font-bold text-white font-mono">
                            {entry.player1_score}
                          </div>
                        </div>
                        
                        <div className="text-gray-500 font-bold">vs</div>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-bold text-white font-mono">
                            {entry.player2_score}
                          </div>
                          <div className="text-sm font-medium text-white">
                            {entry.player2_name}
                          </div>
                        </div>
                      </div>
                      
                      {index === 0 && index < scoreHistory.length - 1 && (
                        <div className="mt-2 text-xs text-blue-400 font-jetbrains">
                          <RefreshCw size={12} className="inline mr-1" />
                          Updated from previous value
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 font-jetbrains">No history available for this pairing</p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-700 bg-gray-800/30">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400 font-jetbrains">
                  Score revision history
                </div>
                
                <button
                  onClick={() => setShowHistory(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains text-sm transition-all duration-200"
                >
                  <Check size={16} />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-pink-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default ScoreEntry;