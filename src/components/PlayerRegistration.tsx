import React, { useState, useEffect } from 'react';
import { Users, Eye, Save, ArrowLeft, ChevronRight, Trophy, CheckCircle, Share2, Copy, Check } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import PlayerPreviewTable from './PlayerPreviewTable';
import TournamentHeader from './TournamentHeader';
import { parsePlayerInput } from '../utils/playerParser';
import { supabase } from '../lib/supabase';
import { ParsedPlayer, Player, Tournament, Division } from '../types/database';

interface PlayerRegistrationProps {
  onBack: () => void;
  onNext: () => void;
  tournamentId: string;
}

const PlayerRegistration: React.FC<PlayerRegistrationProps> = ({ 
  onBack, 
  onNext, 
  tournamentId 
}) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [currentDivisionIndex, setCurrentDivisionIndex] = useState(0);
  const [inputText, setInputText] = useState('');
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedDivisions, setCompletedDivisions] = useState<Set<number>>(new Set());
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);

  const placeholderText = `Jane Doe, 1752
Ahmed Musa, 1640
Kayla James, 1833
Robert Chen, 1925
Maria Garcia, 1567
David Thompson, 1789
Sarah Wilson, 1698
Michael Brown, 1834
Lisa Anderson, 1723
James Rodriguez, 1856`;

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId]);

  const loadTournamentData = async () => {
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

      // Generate public URL
      setPublicUrl(`${window.location.origin}/t/${tournamentId}`);

      // Load divisions if they exist
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('division_number');

      if (divisionsError && divisionsError.code !== 'PGRST116') {
        throw divisionsError;
      }

      // If no divisions found or only 1 division configured, create a default division
      if (!divisionsData || divisionsData.length === 0) {
        if (tournamentData.divisions && tournamentData.divisions > 1) {
          // Create default divisions
          const defaultDivisions = Array.from({ length: tournamentData.divisions }, (_, i) => ({
            tournament_id: tournamentId,
            name: `Division ${i + 1}`,
            division_number: i + 1
          }));

          const { data: createdDivisions, error: createError } = await supabase
            .from('divisions')
            .insert(defaultDivisions)
            .select();

          if (createError) throw createError;
          setDivisions(createdDivisions || []);
        } else {
          // Single division tournament - create one default division
          const { data: singleDivision, error: singleError } = await supabase
            .from('divisions')
            .insert([{
              tournament_id: tournamentId,
              name: 'Main Division',
              division_number: 1
            }])
            .select()
            .single();

          if (singleError) throw singleError;
          setDivisions([singleDivision]);
        }
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

  const currentDivision = divisions[currentDivisionIndex];
  const isLastDivision = currentDivisionIndex === divisions.length - 1;
  const allDivisionsCompleted = completedDivisions.size === divisions.length;

  const handlePreviewPlayers = () => {
    if (!inputText.trim()) {
      setError('Please enter player data first');
      return;
    }

    setError(null);
    const players = parsePlayerInput(inputText);
    setParsedPlayers(players);
    setShowPreview(true);
  };

  const handleSavePlayersForDivision = async () => {
    const validPlayers = parsedPlayers.filter(p => p.isValid);
    
    if (validPlayers.length === 0) {
      setError('No valid players to save');
      return;
    }

    if (!currentDivision) {
      setError('No division selected');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const playersToInsert: Omit<Player, 'id' | 'created_at'>[] = validPlayers.map(player => ({
        name: player.name,
        rating: player.rating,
        tournament_id: tournamentId
      }));

      const { error: insertError } = await supabase
        .from('players')
        .insert(playersToInsert);

      if (insertError) {
        throw insertError;
      }

      // Mark this division as completed
      setCompletedDivisions(prev => new Set([...prev, currentDivisionIndex]));

      // Clear form for next division
      setInputText('');
      setParsedPlayers([]);
      setShowPreview(false);

      // Move to next division or finish
      if (isLastDivision) {
        // All divisions completed
        onNext();
      } else {
        setCurrentDivisionIndex(currentDivisionIndex + 1);
      }

    } catch (err) {
      console.error('Error saving players:', err);
      setError('Failed to save players. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviousDivision = () => {
    if (currentDivisionIndex > 0) {
      setCurrentDivisionIndex(currentDivisionIndex - 1);
      setInputText('');
      setParsedPlayers([]);
      setShowPreview(false);
      setError(null);
    }
  };

  const handleSkipToTournament = () => {
    if (completedDivisions.size > 0) {
      onNext();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: show alert with link
      alert(`Tournament link: ${publicUrl}`);
    }
  };

  const validPlayerCount = parsedPlayers.filter(p => p.isValid).length;

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
      
      {/* Tournament Header */}
      {tournament && (
        <TournamentHeader
          tournament={tournament}
          division={currentDivision}
          showDivision={divisions.length > 1}
          variant="default"
        />
      )}
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Navigation */}
        <div className="max-w-6xl mx-auto w-full mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft size={20} />
              <span className="font-jetbrains">Back</span>
            </button>
            <div className="flex items-center gap-2 text-blue-400">
              <Users size={24} />
              <span className="font-jetbrains text-sm">Player Registration</span>
            </div>
          </div>
        </div>

        {/* Public Link Sharing Section */}
        {publicUrl && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Share2 className="w-5 h-5 text-green-400" />
                    <span className="text-green-300 font-jetbrains font-medium">Share Your Tournament</span>
                  </div>
                  <p className="text-gray-300 font-jetbrains text-sm mb-3">
                    Players and spectators can follow live results at:
                  </p>
                  <p className="text-white font-jetbrains text-sm break-all bg-gray-800/50 px-3 py-2 rounded border border-gray-600">
                    {publicUrl}
                  </p>
                </div>
                
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                    linkCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-green-600/20 border border-green-500/50 text-green-400 hover:bg-green-600 hover:text-white'
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
          </div>
        )}

        {/* Main Content Header */}
        <div className="text-center mb-12 max-w-4xl mx-auto">
          {/* Division Progress */}
          {divisions.length > 1 && (
            <div className="fade-up fade-up-delay-1 mb-8">
              <div className="flex items-center justify-center gap-4 mb-4">
                {divisions.map((division, index) => (
                  <div
                    key={division.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300 ${
                      index === currentDivisionIndex
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : completedDivisions.has(index)
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'bg-gray-800/50 border-gray-600/50 text-gray-400'
                    }`}
                  >
                    {completedDivisions.has(index) ? (
                      <CheckCircle size={16} />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        index === currentDivisionIndex ? 'border-blue-400' : 'border-gray-500'
                      }`} />
                    )}
                    <span className="font-jetbrains text-sm">{division.name}</span>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(completedDivisions.size / divisions.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Current Division Title */}
          {currentDivision && (
            <div className="fade-up fade-up-delay-2">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white font-orbitron">
                Register Players for {currentDivision.name}
              </h2>
              <p className="text-lg text-gray-300 mb-6 font-light tracking-wide">
                Enter each player's full name and rating per line
              </p>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto rounded-full"></div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-6xl mx-auto w-full">
          {/* Input Section */}
          <div className="fade-up fade-up-delay-3 mb-8">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <label className="block text-white text-lg font-medium mb-4 font-jetbrains">
                Player List (Name, Rating):
              </label>
              
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={placeholderText}
                  className="w-full h-64 bg-gray-800/50 border-2 border-gray-600 rounded-xl px-6 py-4 text-white font-jetbrains text-sm leading-relaxed resize-none focus:border-blue-500 focus:outline-none transition-colors duration-300 backdrop-blur-sm placeholder-gray-500"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
                <div className="absolute bottom-4 right-4 text-gray-500 text-xs font-jetbrains">
                  {inputText.split('\n').filter(line => line.trim()).length} lines
                </div>
              </div>

              <div className="mt-4 text-center">
                <Button
                  icon={Eye}
                  label="Preview Players"
                  onClick={handlePreviewPlayers}
                  variant="blue"
                  className="max-w-md mx-auto"
                />
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8">
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
                {error}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {showPreview && (
            <div className="mb-8">
              <PlayerPreviewTable players={parsedPlayers} />
            </div>
          )}

          {/* Action Buttons */}
          {showPreview && validPlayerCount > 0 && (
            <div className="fade-up text-center mb-8">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  icon={Save}
                  label={isSaving ? 'Saving Players...' : `Save ${validPlayerCount} Player${validPlayerCount !== 1 ? 's' : ''} & Continue`}
                  onClick={handleSavePlayersForDivision}
                  variant="green"
                  className="max-w-md"
                  disabled={isSaving}
                />
                
                {divisions.length > 1 && currentDivisionIndex > 0 && (
                  <button
                    onClick={handlePreviousDivision}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg font-jetbrains transition-all duration-200"
                  >
                    <ArrowLeft size={16} />
                    Previous Division
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tournament Dashboard Button */}
          {allDivisionsCompleted && (
            <div className="fade-up text-center mb-8">
              <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span className="text-green-400 font-orbitron font-bold text-lg">
                    All Divisions Completed!
                  </span>
                </div>
                <p className="text-gray-300 font-jetbrains">
                  All players have been registered. Ready to proceed to tournament management.
                </p>
              </div>
              
              <Button
                icon={Trophy}
                label="Continue to Pairings"
                onClick={onNext}
                variant="green"
                className="max-w-md mx-auto"
              />
            </div>
          )}

          {/* Skip Option */}
          {completedDivisions.size > 0 && !allDivisionsCompleted && (
            <div className="text-center mb-8">
              <button
                onClick={handleSkipToTournament}
                className="text-gray-400 hover:text-white font-jetbrains text-sm transition-colors duration-200 underline"
              >
                Skip remaining divisions and proceed to tournament
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-8">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Format: Name, Rating (e.g., "John Smith, 1650") • Share the public link for live following
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-green-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default PlayerRegistration;