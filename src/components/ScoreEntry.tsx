import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mic, Trophy, Save, MicOff } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import { supabase } from '../lib/supabase';
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
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    loadData();
    initializeSpeechRecognition();
  }, [tournamentId, currentRound]);

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

      // Initialize scores state
      const initialScores: Record<string, ScoreInput> = {};
      pairingsData.forEach(pairing => {
        initialScores[pairing.id] = {
          pairingId: pairing.id,
          player1Score: '',
          player2Score: ''
        };
      });
      setScores(initialScores);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load tournament data');
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
          [`${player}Score`]: numValue
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
    for (const pairing of pairings) {
      const score = scores[pairing.id];
      if (score.player1Score === '' || score.player2Score === '') {
        setError('Please enter scores for all pairings');
        return false;
      }
      
      const score1 = Number(score.player1Score);
      const score2 = Number(score.player2Score);
      
      if (score1 < 0 || score1 > 9999 || score2 < 0 || score2 > 9999) {
        setError('Scores must be between 0 and 9999');
        return false;
      }
    }
    return true;
  };

  const handleSubmitScores = async () => {
    if (!validateScores()) return;

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

      // Navigate to standings
      onNext();
    } catch (err) {
      console.error('Error saving scores:', err);
      setError('Failed to save scores. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
              {tournament.name} - Round {currentRound}
            </p>
          )}
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Enter scores for each pairing below. Use voice or manual input.
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full"></div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Score Entry Table */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                <Trophy size={24} />
                Round {currentRound} Scores
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {pairings.map((pairing) => {
                    const score = scores[pairing.id];
                    const isPlayer1Winner = score?.winnerId === pairing.player1_id;
                    const isPlayer2Winner = score?.winnerId === pairing.player2_id;
                    
                    return (
                      <tr key={pairing.id} className="bg-gray-900/30 hover:bg-gray-800/30 transition-colors duration-200">
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
                              onChange={(e) => handleScoreChange(pairing.id, 'player1', e.target.value)}
                              className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-purple-500 focus:outline-none transition-colors duration-300"
                              placeholder="0"
                            />
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
                              onChange={(e) => handleScoreChange(pairing.id, 'player2', e.target.value)}
                              className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-purple-500 focus:outline-none transition-colors duration-300"
                              placeholder="0"
                            />
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
          <Button
            icon={Save}
            label={isSaving ? 'Saving Scores...' : 'Submit Scores & View Standings'}
            onClick={handleSubmitScores}
            variant="green"
            className="max-w-md mx-auto"
            disabled={isSaving}
          />
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

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-pink-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default ScoreEntry;