import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TournamentProgressUpdate {
  tournamentId: string;
  currentRound?: number;
  status?: 'setup' | 'registration' | 'active' | 'completed' | 'paused';
}

export const useTournamentProgress = () => {
  const updateTournamentProgress = async ({
    tournamentId,
    currentRound,
    status
  }: TournamentProgressUpdate) => {
    try {
      const updates: any = {
        last_activity: new Date().toISOString()
      };

      if (currentRound !== undefined) {
        updates.current_round = currentRound;
      }

      if (status !== undefined) {
        updates.status = status;
      }

      const { error } = await supabase
        .from('tournaments')
        .update(updates)
        .eq('id', tournamentId);

      if (error) {
        console.error('Error updating tournament progress:', error);
      }
    } catch (err) {
      console.error('Error updating tournament progress:', err);
    }
  };

  const markTournamentCompleted = async (tournamentId: string) => {
    await updateTournamentProgress({
      tournamentId,
      status: 'completed'
    });
  };

  const setTournamentRound = async (tournamentId: string, round: number) => {
    await updateTournamentProgress({
      tournamentId,
      currentRound: round,
      status: 'active'
    });
  };

  const setTournamentStatus = async (tournamentId: string, status: 'setup' | 'registration' | 'active' | 'completed' | 'paused') => {
    await updateTournamentProgress({
      tournamentId,
      status
    });
  };

  return {
    updateTournamentProgress,
    markTournamentCompleted,
    setTournamentRound,
    setTournamentStatus
  };
};