import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Edit3, Trash2, Save, AlertTriangle, Users, Target, Shield, Upload, Plus, ExternalLink, Image, X } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import { supabase } from '../lib/supabase';
import { Tournament, Player, PairingWithPlayers, Result, Sponsor } from '../types/database';

interface AdminPanelProps {
  onBack: () => void;
  tournamentId: string;
}

interface EditableResult {
  id?: string;
  pairingId: string;
  tableNumber: number;
  player1: Player;
  player2: Player;
  player1Score: number;
  player2Score: number;
  firstMovePlayerId: string;
  roundNumber: number;
  hasChanges: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack, tournamentId }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [maxRounds] = useState(7);
  const [editableResults, setEditableResults] = useState<EditableResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Manual pairing state
  const [manualRound, setManualRound] = useState(1);
  const [manualPlayer1, setManualPlayer1] = useState('');
  const [manualPlayer2, setManualPlayer2] = useState('');
  const [manualTable, setManualTable] = useState(1);
  const [manualFirstMove, setManualFirstMove] = useState('');

  // Player editing state
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerRating, setEditPlayerRating] = useState(0);

  // Sponsor management state
  const [isUploadingSponsor, setIsUploadingSponsor] = useState(false);
  const [newSponsorName, setNewSponsorName] = useState('');
  const [newSponsorWebsite, setNewSponsorWebsite] = useState('');
  const [sponsorFileInput, setSponsorFileInput] = useState<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  useEffect(() => {
    loadRoundData();
  }, [selectedRound, tournamentId]);

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

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;
      setPlayers(playersData);

      // Load sponsors
      const { data: sponsorsData, error: sponsorsError } = await supabase
        .from('sponsors')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('display_order');

      if (sponsorsError && sponsorsError.code !== 'PGRST116') {
        throw sponsorsError;
      }
      setSponsors(sponsorsData || []);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoundData = async () => {
    try {
      // Load pairings with player details for selected round
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select(`
          *,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        `)
        .eq('tournament_id', tournamentId)
        .eq('round_number', selectedRound)
        .order('table_number');

      if (pairingsError) throw pairingsError;

      // Load results for this round
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('round_number', selectedRound)
        .in('pairing_id', pairingsData.map(p => p.id));

      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }

      // Combine pairings and results
      const editableData: EditableResult[] = pairingsData.map(pairing => {
        const result = resultsData?.find(r => r.pairing_id === pairing.id);
        
        return {
          id: result?.id,
          pairingId: pairing.id,
          tableNumber: pairing.table_number,
          player1: pairing.player1,
          player2: pairing.player2,
          player1Score: result?.player1_score || 0,
          player2Score: result?.player2_score || 0,
          firstMovePlayerId: pairing.first_move_player_id,
          roundNumber: selectedRound,
          hasChanges: false
        };
      });

      setEditableResults(editableData);
    } catch (err) {
      console.error('Error loading round data:', err);
      setError('Failed to load round data');
    }
  };

  const handleScoreChange = (pairingId: string, field: 'player1Score' | 'player2Score', value: number) => {
    setEditableResults(prev => prev.map(result => 
      result.pairingId === pairingId 
        ? { ...result, [field]: value, hasChanges: true }
        : result
    ));
  };

  const handleFirstMoveChange = (pairingId: string, playerId: string) => {
    setEditableResults(prev => prev.map(result => 
      result.pairingId === pairingId 
        ? { ...result, firstMovePlayerId: playerId, hasChanges: true }
        : result
    ));
  };

  const handleUpdateResult = async (result: EditableResult) => {
    setIsSaving(true);
    setError(null);

    try {
      // Update or insert result
      const resultData = {
        pairing_id: result.pairingId,
        round_number: result.roundNumber,
        player1_score: result.player1Score,
        player2_score: result.player2Score,
        winner_id: result.player1Score > result.player2Score ? result.player1.id :
                   result.player2Score > result.player1Score ? result.player2.id : null,
        submitted_by: null
      };

      if (result.id) {
        // Update existing result
        const { error: updateError } = await supabase
          .from('results')
          .update(resultData)
          .eq('id', result.id);

        if (updateError) throw updateError;
      } else {
        // Insert new result
        const { error: insertError } = await supabase
          .from('results')
          .insert([resultData]);

        if (insertError) throw insertError;
      }

      // Update pairing first move if changed
      const { error: pairingError } = await supabase
        .from('pairings')
        .update({ first_move_player_id: result.firstMovePlayerId })
        .eq('id', result.pairingId);

      if (pairingError) throw pairingError;

      // Reload round data
      await loadRoundData();
      
    } catch (err) {
      console.error('Error updating result:', err);
      setError('Failed to update result');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePairing = async (pairingId: string) => {
    if (deleteConfirm !== pairingId) {
      setDeleteConfirm(pairingId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Delete result first (if exists)
      await supabase
        .from('results')
        .delete()
        .eq('pairing_id', pairingId);

      // Delete pairing
      const { error: pairingError } = await supabase
        .from('pairings')
        .delete()
        .eq('id', pairingId);

      if (pairingError) throw pairingError;

      // Reload round data
      await loadRoundData();
      setDeleteConfirm(null);
      
    } catch (err) {
      console.error('Error deleting pairing:', err);
      setError('Failed to delete pairing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (deleteConfirm !== `player-${playerId}`) {
      setDeleteConfirm(`player-${playerId}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Delete player (cascading deletes will handle pairings and results)
      const { error: playerError } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (playerError) throw playerError;

      // Reload data
      await loadData();
      await loadRoundData();
      setDeleteConfirm(null);
      
    } catch (err) {
      console.error('Error deleting player:', err);
      setError('Failed to delete player');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPlayer = async (playerId: string) => {
    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('players')
        .update({
          name: editPlayerName,
          rating: editPlayerRating
        })
        .eq('id', playerId);

      if (updateError) throw updateError;

      // Reload data
      await loadData();
      await loadRoundData();
      setEditingPlayer(null);
      
    } catch (err) {
      console.error('Error updating player:', err);
      setError('Failed to update player');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPairing = async () => {
    if (!manualPlayer1 || !manualPlayer2 || manualPlayer1 === manualPlayer2) {
      setError('Please select two different players');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Get player ranks
      const player1 = players.find(p => p.id === manualPlayer1);
      const player2 = players.find(p => p.id === manualPlayer2);
      
      if (!player1 || !player2) {
        throw new Error('Players not found');
      }

      const player1Rank = players.findIndex(p => p.id === manualPlayer1) + 1;
      const player2Rank = players.findIndex(p => p.id === manualPlayer2) + 1;

      // Insert manual pairing
      const { error: pairingError } = await supabase
        .from('pairings')
        .insert([{
          round_number: manualRound,
          tournament_id: tournamentId,
          table_number: manualTable,
          player1_id: manualPlayer1,
          player2_id: manualPlayer2,
          player1_rank: player1Rank,
          player2_rank: player2Rank,
          first_move_player_id: manualFirstMove || manualPlayer1
        }]);

      if (pairingError) throw pairingError;

      // Reset form
      setManualPlayer1('');
      setManualPlayer2('');
      setManualTable(manualTable + 1);
      setManualFirstMove('');

      // Reload round data if viewing the same round
      if (manualRound === selectedRound) {
        await loadRoundData();
      }
      
    } catch (err) {
      console.error('Error creating manual pairing:', err);
      setError('Failed to create manual pairing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSponsorUpload = async (file: File) => {
    if (!file) return;

    setIsUploadingSponsor(true);
    setError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${tournamentId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sponsor-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('sponsor-logos')
        .getPublicUrl(fileName);

      // Save sponsor to database
      const { error: insertError } = await supabase
        .from('sponsors')
        .insert([{
          tournament_id: tournamentId,
          name: newSponsorName.trim() || null,
          logo_url: urlData.publicUrl,
          website_link: newSponsorWebsite.trim() || null,
          display_order: sponsors.length
        }]);

      if (insertError) throw insertError;

      // Reset form
      setNewSponsorName('');
      setNewSponsorWebsite('');
      if (sponsorFileInput) {
        sponsorFileInput.value = '';
      }

      // Reload sponsors
      await loadData();
      
    } catch (err: any) {
      console.error('Error uploading sponsor:', err);
      setError(err.message || 'Failed to upload sponsor logo');
    } finally {
      setIsUploadingSponsor(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId: string) => {
    if (deleteConfirm !== `sponsor-${sponsorId}`) {
      setDeleteConfirm(`sponsor-${sponsorId}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const sponsor = sponsors.find(s => s.id === sponsorId);
      if (!sponsor) throw new Error('Sponsor not found');

      // Delete from storage
      const fileName = sponsor.logo_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('sponsor-logos')
          .remove([`${tournamentId}/${fileName}`]);
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('sponsors')
        .delete()
        .eq('id', sponsorId);

      if (deleteError) throw deleteError;

      // Reload sponsors
      await loadData();
      setDeleteConfirm(null);
      
    } catch (err) {
      console.error('Error deleting sponsor:', err);
      setError('Failed to delete sponsor');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleSponsorUpload(file);
      }
    };
    setSponsorFileInput(input);
    input.click();
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
            <div className="flex items-center gap-2 text-red-400">
              <Shield size={24} />
              <span className="font-jetbrains text-sm">Admin Access</span>
            </div>
          </div>

          <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
              data-text="ADMIN PANEL">
            ⚙️ ADMIN PANEL
          </h1>
          
          {tournament && (
            <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-red-400 mb-4 font-medium">
              Tournament Admin Tools
            </p>
          )}
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Manage your tournament. Fix errors, adjust scores, or override pairings.
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-red-500 to-orange-500 mx-auto rounded-full"></div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Section 1: Sponsors */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-12">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6 font-orbitron flex items-center gap-2">
              <Image size={24} />
              Sponsor Logos
            </h2>
            
            {/* Upload Section */}
            <div className="mb-8 bg-gray-800/50 border border-gray-600 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4 font-jetbrains">Add New Sponsor</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                    Sponsor Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newSponsorName}
                    onChange={(e) => setNewSponsorName(e.target.value)}
                    placeholder="Enter sponsor name"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                    Website Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={newSponsorWebsite}
                    onChange={(e) => setNewSponsorWebsite(e.target.value)}
                    placeholder="https://sponsor-website.com"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
                  />
                </div>
              </div>
              
              <button
                onClick={triggerFileUpload}
                disabled={isUploadingSponsor}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg font-jetbrains font-medium transition-all duration-300 flex items-center justify-center gap-3 border-2 border-transparent hover:border-blue-400/50"
              >
                {isUploadingSponsor ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading Logo...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Upload Sponsor Logo
                  </>
                )}
              </button>
              
              <p className="text-xs text-gray-400 mt-2 font-jetbrains text-center">
                Supported formats: JPG, PNG, GIF • Max size: 5MB
              </p>
            </div>

            {/* Sponsors Grid */}
            {sponsors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sponsors.map((sponsor) => (
                  <div
                    key={sponsor.id}
                    className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 hover:bg-gray-700/50 transition-all duration-200 group"
                  >
                    {/* Logo */}
                    <div className="aspect-video bg-white rounded-lg mb-4 overflow-hidden flex items-center justify-center">
                      <img
                        src={sponsor.logo_url}
                        alt={sponsor.name || 'Sponsor Logo'}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = '<div class="text-gray-500 text-sm">Image not found</div>';
                        }}
                      />
                    </div>
                    
                    {/* Sponsor Info */}
                    <div className="mb-4">
                      {sponsor.name && (
                        <h4 className="text-white font-medium font-jetbrains mb-1">
                          {sponsor.name}
                        </h4>
                      )}
                      
                      {sponsor.website_link && (
                        <a
                          href={sponsor.website_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm font-jetbrains flex items-center gap-1 transition-colors duration-200"
                        >
                          <ExternalLink size={12} />
                          Visit Website
                        </a>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleDeleteSponsor(sponsor.id!)}
                        className={`px-3 py-2 rounded-lg font-jetbrains text-sm transition-all duration-200 flex items-center gap-2 ${
                          deleteConfirm === `sponsor-${sponsor.id}`
                            ? 'bg-red-700 text-white animate-pulse'
                            : 'bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white'
                        }`}
                      >
                        <Trash2 size={14} />
                        {deleteConfirm === `sponsor-${sponsor.id}` ? 'Confirm' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 font-jetbrains">
                <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No sponsor logos uploaded yet</p>
                <p className="text-sm mt-2">Upload your first sponsor logo to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Round Score Editor */}
        <div className="fade-up fade-up-delay-5 max-w-6xl mx-auto w-full mb-12">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6 font-orbitron flex items-center gap-2">
              <Edit3 size={24} />
              Round Score Editor
            </h2>
            
            {/* Round Selection */}
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                Select Round
              </label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(parseInt(e.target.value))}
                className="w-full max-w-xs bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none transition-colors duration-300"
              >
                {Array.from({ length: maxRounds }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Round {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Results Table */}
            {editableResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Table</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 1</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 2</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">First Move</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {editableResults.map((result) => (
                      <tr key={result.pairingId} className={`transition-colors duration-200 hover:bg-gray-800/30 ${result.hasChanges ? 'bg-blue-900/20 border border-blue-500/30' : ''}`}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono font-bold">
                          {result.tableNumber}
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {result.player1.name}
                          </div>
                          <div className="text-xs text-gray-400 font-jetbrains">
                            Rating: {result.player1.rating}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={result.player1Score}
                            onChange={(e) => handleScoreChange(result.pairingId, 'player1Score', parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-blue-500 focus:outline-none transition-colors duration-300"
                          />
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={result.player2Score}
                            onChange={(e) => handleScoreChange(result.pairingId, 'player2Score', parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-blue-500 focus:outline-none transition-colors duration-300"
                          />
                        </td>
                        
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {result.player2.name}
                          </div>
                          <div className="text-xs text-gray-400 font-jetbrains">
                            Rating: {result.player2.rating}
                          </div>
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <select
                            value={result.firstMovePlayerId}
                            onChange={(e) => handleFirstMoveChange(result.pairingId, e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs font-jetbrains focus:border-blue-500 focus:outline-none"
                          >
                            <option value={result.player1.id}>{result.player1.name}</option>
                            <option value={result.player2.id}>{result.player2.name}</option>
                          </select>
                        </td>
                        
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleUpdateResult(result)}
                              disabled={!result.hasChanges || isSaving}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-xs font-jetbrains transition-all duration-200 flex items-center gap-1"
                            >
                              <Save size={12} />
                              Update
                            </button>
                            <button
                              onClick={() => handleDeletePairing(result.pairingId)}
                              className={`px-3 py-1 rounded text-xs font-jetbrains transition-all duration-200 flex items-center gap-1 ${
                                deleteConfirm === result.pairingId
                                  ? 'bg-red-700 text-white animate-pulse'
                                  : 'bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white'
                              }`}
                            >
                              <Trash2 size={12} />
                              {deleteConfirm === result.pairingId ? 'Confirm' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {editableResults.length === 0 && (
              <div className="text-center py-8 text-gray-400 font-jetbrains">
                No pairings found for Round {selectedRound}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Player Manager */}
        <div className="fade-up fade-up-delay-6 max-w-6xl mx-auto w-full mb-12">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6 font-orbitron flex items-center gap-2">
              <Users size={24} />
              Player Manager
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rating</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {players.map((player) => (
                    <tr key={player.id} className="transition-colors duration-200 hover:bg-gray-800/30">
                      <td className="px-4 py-4 whitespace-nowrap">
                        {editingPlayer === player.id ? (
                          <input
                            type="text"
                            value={editPlayerName}
                            onChange={(e) => setEditPlayerName(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                          />
                        ) : (
                          <div className="text-sm font-medium text-white">
                            {player.name}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-4 text-center">
                        {editingPlayer === player.id ? (
                          <input
                            type="number"
                            min="0"
                            max="3000"
                            value={editPlayerRating}
                            onChange={(e) => setEditPlayerRating(parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center font-mono focus:border-blue-500 focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-300 font-mono">
                            {player.rating}
                          </span>
                        )}
                      </td>
                      
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {editingPlayer === player.id ? (
                            <>
                              <button
                                onClick={() => handleEditPlayer(player.id!)}
                                disabled={isSaving}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-jetbrains transition-all duration-200 flex items-center gap-1"
                              >
                                <Save size={12} />
                                Save
                              </button>
                              <button
                                onClick={() => setEditingPlayer(null)}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-jetbrains transition-all duration-200"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingPlayer(player.id!);
                                  setEditPlayerName(player.name);
                                  setEditPlayerRating(player.rating);
                                }}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-jetbrains transition-all duration-200 flex items-center gap-1"
                              >
                                <Edit3 size={12} />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeletePlayer(player.id!)}
                                className={`px-3 py-1 rounded text-xs font-jetbrains transition-all duration-200 flex items-center gap-1 ${
                                  deleteConfirm === `player-${player.id}`
                                    ? 'bg-red-700 text-white animate-pulse'
                                    : 'bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white'
                                }`}
                              >
                                <Trash2 size={12} />
                                {deleteConfirm === `player-${player.id}` ? 'Confirm' : 'Delete'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 4: Manual Pairing Override */}
        <div className="fade-up fade-up-delay-7 max-w-6xl mx-auto w-full mb-12">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6 font-orbitron flex items-center gap-2">
              <Target size={24} />
              Manual Pairing Override
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Round
                </label>
                <select
                  value={manualRound}
                  onChange={(e) => setManualRound(parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                >
                  {Array.from({ length: maxRounds }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Round {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Player 1
                </label>
                <select
                  value={manualPlayer1}
                  onChange={(e) => setManualPlayer1(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select Player 1</option>
                  {players.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.rating})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Player 2
                </label>
                <select
                  value={manualPlayer2}
                  onChange={(e) => setManualPlayer2(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select Player 2</option>
                  {players.filter(p => p.id !== manualPlayer1).map(player => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.rating})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  Table #
                </label>
                <input
                  type="number"
                  min="1"
                  value={manualTable}
                  onChange={(e) => setManualTable(parseInt(e.target.value) || 1)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2 font-jetbrains">
                  First Move
                </label>
                <select
                  value={manualFirstMove}
                  onChange={(e) => setManualFirstMove(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white font-jetbrains focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Auto</option>
                  {manualPlayer1 && (
                    <option value={manualPlayer1}>
                      {players.find(p => p.id === manualPlayer1)?.name}
                    </option>
                  )}
                  {manualPlayer2 && (
                    <option value={manualPlayer2}>
                      {players.find(p => p.id === manualPlayer2)?.name}
                    </option>
                  )}
                </select>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleManualPairing}
                disabled={!manualPlayer1 || !manualPlayer2 || isSaving}
                className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-jetbrains font-medium transition-all duration-300 flex items-center justify-center gap-2 mx-auto"
              >
                <Target size={16} />
                Force Save Pairing
              </button>
            </div>
          </div>
        </div>

        {/* Warning Notice */}
        <div className="fade-up max-w-6xl mx-auto w-full mb-8">
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 text-yellow-300 font-jetbrains text-sm flex items-center gap-2">
            <AlertTriangle size={20} />
            <span>
              <strong>Warning:</strong> Admin actions can permanently modify tournament data. 
              Use with caution and ensure you have backups if needed.
            </span>
          </div>
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Admin Panel - Handle with care
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-red-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-orange-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default AdminPanel;