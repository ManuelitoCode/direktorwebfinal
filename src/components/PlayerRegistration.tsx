import React, { useState, useEffect } from 'react';
import { Users, Eye, Save, ArrowLeft, ChevronRight, Trophy, CheckCircle, Share2, Copy, Check, UserCheck, Settings, Calendar } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import PlayerPreviewTable from './PlayerPreviewTable';
import TournamentHeader from './TournamentHeader';
import TeamManager from './TeamManager';
import TeamScheduleModal from './TeamScheduleModal';
import { parsePlayerInput } from '../utils/playerParser';
import { generateTeamRoundRobinPairings } from '../utils/teamPairingAlgorithms';
import { supabase } from '../lib/supabase';
import { ParsedPlayer, Player, Tournament, Division, Team } from '../types/database';

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentDivisionIndex, setCurrentDivisionIndex] = useState(0);
  const [inputText, setInputText] = useState('');
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedDivisions, setCompletedDivisions] = useState<Set<number>>(new Set());
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);

  const getPlaceholderText = (isTeamMode: boolean) => {
    if (isTeamMode) {
      return `Samuel, Anikoh  2000 ; ; team LSC
Adekoyejo,  Adegbesan  1500 ; ; team LSC
Lukeman, Owolabi  2000 ; ; team MGI
Nsikan, Iyanam  1800 ; ; team MGI
Chioma, Okoh  1650 ; ; team LSC
Funmi, Jimoh  1720 ; ; team MGI`;
    } else {
      return `Jane Doe, 1752
Ahmed Musa, 1640
Kayla James, 1833
Robert Chen, 1925
Maria Garcia, 1567
David Thompson, 1789
Sarah Wilson, 1698
Michael Brown, 1834
Lisa Anderson, 1723
James Rodriguez, 1856`;
    }
  };

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
          const defaultDivisions = Array.from({ length: tournamentData.divisions }, (_,i) => ({
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

      // Load teams if in team mode
      if (tournamentData.team_mode) {
        await loadTeams();
      }

    } catch (err) {
      console.error('Error loading tournament data:', err);
      setError('Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (teamsError && teamsError.code !== 'PGRST116') {
        throw teamsError;
      }

      setTeams(teamsData || []);
    } catch (err) {
      console.error('Error loading teams:', err);
    }
  };

  const currentDivision = divisions[currentDivisionIndex];
  const isLastDivision = currentDivisionIndex === divisions.length - 1;
  const allDivisionsCompleted = completedDivisions.size === divisions.length;
  const isTeamMode = tournament?.team_mode || false;

  const handlePreviewPlayers = () => {
    if (!inputText.trim()) {
      setError('Please enter player data first');
      return;
    }

    setError(null);
    const players = parsePlayerInput(inputText, isTeamMode);
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

    // Team mode validation
    if (isTeamMode) {
      const teams = new Set(validPlayers.map(p => p.team_name).filter(Boolean));
      if (teams.size < 2) {
        setError('Team mode requires at least 2 teams');
        return;
      }
      
      // Check that each team has at least one player
      for (const teamName of teams) {
        const teamPlayers = validPlayers.filter(p => p.team_name === teamName);
        if (teamPlayers.length === 0) {
          setError(`Team ${teamName} has no valid players`);
          return;
        }
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const playersToInsert: Omit<Player, 'id' | 'created_at'>[] = validPlayers.map(player => ({
        name: player.name,
        rating: player.rating,
        tournament_id: tournamentId,
        team_name: isTeamMode ? player.team_name : undefined
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
        if (isTeamMode) {
          // For team mode, show the schedule generation modal
          const teamNames = Array.from(new Set(validPlayers.map(p => p.team_name).filter(Boolean)));
          if (teamNames.length >= 2) {
            setShowScheduleModal(true);
          } else {
            onNext();
          }
        } else {
          onNext();
        }
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

  const handleGenerateTeamSchedule = async () => {
    if (!isTeamMode) return;
    
    setIsGeneratingSchedule(true);
    setError(null);
    
    try {
      // Get all players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId);
        
      if (playersError) throw playersError;
      
      // Group players by team
      const teamMap = new Map<string, Player[]>();
      playersData?.forEach(player => {
        if (!player.team_name) return;
        
        if (!teamMap.has(player.team_name)) {
          teamMap.set(player.team_name, []);
        }
        teamMap.get(player.team_name)!.push(player);
      });
      
      const teamNames = Array.from(teamMap.keys());
      
      if (teamNames.length < 2) {
        throw new Error('Need at least 2 teams to generate schedule');
      }
      
      // Calculate total rounds needed
      const totalRounds = teamNames.length - 1;
      
      // Update tournament rounds if needed
      if (tournament && tournament.rounds !== totalRounds) {
        await supabase
          .from('tournaments')
          .update({ rounds: totalRounds })
          .eq('id', tournamentId);
      }
      
      // Generate round-robin schedule for teams
      for (let round = 1; round <= totalRounds; round++) {
        // Generate pairings for this round
        const playersWithRank = playersData?.map(player => ({
          ...player,
          rank: 0,
          previous_starts: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          points: 0,
          spread: 0,
          is_gibsonized: false
        })) || [];
        
        const { pairings } = generateTeamRoundRobinPairings(
          playersWithRank,
          round,
          []
        );
        
        // Insert pairings into database
        if (pairings.length > 0) {
          const pairingsToInsert = pairings.map((pairing, index) => ({
            round_number: round,
            tournament_id: tournamentId,
            table_number: pairing.table_number,
            player1_id: pairing.player1.id!,
            player2_id: pairing.player2.id!,
            player1_rank: pairing.player1.rank,
            player2_rank: pairing.player2.rank,
            first_move_player_id: pairing.first_move_player_id,
            player1_gibsonized: false,
            player2_gibsonized: false
          }));
          
          const { error: pairingError } = await supabase
            .from('pairings')
            .insert(pairingsToInsert);
            
          if (pairingError) throw pairingError;
        }
      }
      
      // Success - proceed to next step
      onNext();
      
    } catch (err: any) {
      console.error('Error generating team schedule:', err);
      setError(`Failed to generate team schedule: ${err.message}`);
      // Still allow proceeding to next step even if schedule generation fails
      onNext();
    } finally {
      setIsGeneratingSchedule(false);
      setShowScheduleModal(false);
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
            <div className="flex items-center gap-4">
              {/* Team Manager Button (Team Mode Only) */}
              {isTeamMode && (
                <button
                  onClick={() => setShowTeamManager(!showTeamManager)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                    showTeamManager
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/30'
                  }`}
                >
                  <Settings size={16} />
                  Team Manager
                </button>
              )}
              
              <div className="flex items-center gap-2 text-blue-400">
                {isTeamMode ? <UserCheck size={24} /> : <Users size={24} />}
                <span className="font-jetbrains text-sm">
                  {isTeamMode ? 'Team Registration' : 'Player Registration'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Manager Section */}
        {isTeamMode && showTeamManager && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
              <TeamManager 
                tournamentId={tournamentId} 
                onTeamsUpdated={loadTeams}
              />
            </div>
          </div>
        )}

        {/* Team Mode Banner */}
        {isTeamMode && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                <span className="text-blue-300 font-jetbrains font-medium">Team Mode Active</span>
              </div>
              <p className="text-gray-300 font-jetbrains text-sm mb-3">
                This tournament uses team-based competition. Each player must be assigned to a team.
              </p>
              <p className="text-blue-200 font-jetbrains text-xs">
                Format: Player Name, Rating ; ; team TeamName
              </p>
              {teams.length > 0 && (
                <div className="mt-4">
                  <p className="text-blue-300 font-jetbrains text-sm mb-2">Available teams:</p>
                  <div className="flex flex-wrap gap-2">
                    {teams.map(team => (
                      <span
                        key={team.id}
                        className="inline-flex items-center px-2 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded text-xs font-jetbrains"
                      >
                        {team.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
                Register {isTeamMode ? 'Teams' : 'Players'} for {currentDivision.name}
              </h2>
              <p className="text-lg text-gray-300 mb-6 font-light tracking-wide">
                {isTeamMode 
                  ? 'Enter each player with their team assignment'
                  : 'Enter each player\'s full name and rating per line'
                }
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
                {isTeamMode ? 'Team Player List:' : 'Player List (Name, Rating):'}
              </label>
              
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={getPlaceholderText(isTeamMode)}
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
                  label={`Preview ${isTeamMode ? 'Teams' : 'Players'}`}
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
              <PlayerPreviewTable players={parsedPlayers} teamMode={isTeamMode} teams={teams} />
            </div>
          )}

          {/* Action Buttons */}
          {showPreview && validPlayerCount > 0 && (
            <div className="fade-up text-center mb-8">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  icon={Save}
                  label={isSaving ? `Saving ${isTeamMode ? 'Teams' : 'Players'}...` : `Save ${validPlayerCount} ${isTeamMode ? 'Team Player' : 'Player'}${validPlayerCount !== 1 ? 's' : ''} & Continue`}
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
                  All {isTeamMode ? 'teams' : 'players'} have been registered. Ready to proceed to tournament management.
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
            {isTeamMode 
              ? 'Format: Name, Rating ; ; team TeamName • Share the public link for live following'
              : 'Format: Name, Rating (e.g., "John Smith, 1650") • Share the public link for live following'
            }
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Team Schedule Modal */}
      {isTeamMode && (
        <TeamScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onConfirm={handleGenerateTeamSchedule}
          onSkip={onNext}
          teams={Array.from(new Set(parsedPlayers.filter(p => p.isValid).map(p => p.team_name || '')))}
          totalRounds={Math.max(1, Array.from(new Set(parsedPlayers.filter(p => p.isValid).map(p => p.team_name))).length - 1)}
        />
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-green-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default PlayerRegistration;