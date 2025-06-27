import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { set, get, del } from 'idb-keyval';

interface OfflineData {
  tournaments: any[];
  players: any[];
  pairings: any[];
  results: any[];
  lastSync: string;
}

interface PendingChange {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize offline mode detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsOfflineMode(true);
      showOfflineToast();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending changes on load
    loadPendingChanges();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending changes from IndexedDB
  const loadPendingChanges = async () => {
    try {
      const changes = await get('pendingChanges') || [];
      setPendingChanges(changes);
      
      if (changes.length > 0 && navigator.onLine) {
        syncPendingChanges();
      }
    } catch (err) {
      console.error('Error loading pending changes:', err);
    }
  };

  // Save pending changes to IndexedDB
  const savePendingChanges = async (changes: PendingChange[]) => {
    try {
      await set('pendingChanges', changes);
      setPendingChanges(changes);
    } catch (err) {
      console.error('Error saving pending changes:', err);
    }
  };

  // Add a pending change
  const addPendingChange = async (change: Omit<PendingChange, 'timestamp'>) => {
    try {
      const newChange = {
        ...change,
        timestamp: new Date().toISOString()
      };
      
      const updatedChanges = [...pendingChanges, newChange];
      await savePendingChanges(updatedChanges);
      
      return true;
    } catch (err) {
      console.error('Error adding pending change:', err);
      return false;
    }
  };

  // Sync pending changes with Supabase
  const syncPendingChanges = async () => {
    if (pendingChanges.length === 0 || !navigator.onLine || isSyncing) {
      return;
    }

    setIsSyncing(true);
    
    try {
      const successfulChanges: string[] = [];
      
      // Process changes in order (oldest first)
      const sortedChanges = [...pendingChanges].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      for (const change of sortedChanges) {
        let success = false;
        
        try {
          switch (change.operation) {
            case 'insert':
              const { error: insertError } = await supabase
                .from(change.table)
                .insert([change.data]);
              
              success = !insertError;
              break;
              
            case 'update':
              const { error: updateError } = await supabase
                .from(change.table)
                .update(change.data)
                .eq('id', change.id);
              
              success = !updateError;
              break;
              
            case 'delete':
              const { error: deleteError } = await supabase
                .from(change.table)
                .delete()
                .eq('id', change.id);
              
              success = !deleteError;
              break;
          }
          
          if (success) {
            successfulChanges.push(change.id);
          }
        } catch (err) {
          console.error(`Error syncing change ${change.id}:`, err);
        }
      }
      
      // Remove successful changes
      if (successfulChanges.length > 0) {
        const remainingChanges = pendingChanges.filter(
          change => !successfulChanges.includes(change.id)
        );
        
        await savePendingChanges(remainingChanges);
        
        // Show success toast if all changes synced
        if (remainingChanges.length === 0) {
          showSyncSuccessToast();
        }
      }
    } catch (err) {
      console.error('Error syncing pending changes:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Cache tournament data for offline use
  const cacheTournamentData = async (tournamentId: string) => {
    if (!navigator.onLine) return;
    
    try {
      // Fetch tournament data
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
      
      // Fetch players
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId);
      
      // Fetch pairings
      const { data: pairings } = await supabase
        .from('pairings')
        .select('*')
        .eq('tournament_id', tournamentId);
      
      // Fetch results
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .eq('tournament_id', tournamentId);
      
      // Save to IndexedDB
      const offlineData: OfflineData = {
        tournaments: tournament ? [tournament] : [],
        players: players || [],
        pairings: pairings || [],
        results: results || [],
        lastSync: new Date().toISOString()
      };
      
      await set(`tournament_${tournamentId}`, offlineData);
    } catch (err) {
      console.error('Error caching tournament data:', err);
    }
  };

  // Get cached tournament data
  const getCachedTournamentData = async (tournamentId: string): Promise<OfflineData | null> => {
    try {
      const data = await get(`tournament_${tournamentId}`);
      return data || null;
    } catch (err) {
      console.error('Error getting cached tournament data:', err);
      return null;
    }
  };

  // Clear cached tournament data
  const clearCachedTournamentData = async (tournamentId: string) => {
    try {
      await del(`tournament_${tournamentId}`);
    } catch (err) {
      console.error('Error clearing cached tournament data:', err);
    }
  };

  // Show offline toast
  const showOfflineToast = () => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-yellow-500/50';
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
        You're working offline – changes will sync when internet is restored
      </div>
    `;
    document.body.appendChild(toast);
    
    // Keep toast visible while offline
    const checkOnline = setInterval(() => {
      if (navigator.onLine) {
        clearInterval(checkOnline);
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }
    }, 5000);
  };

  // Show sync success toast
  const showSyncSuccessToast = () => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-green-500/50';
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        All changes synced successfully
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  };

  return {
    isOnline,
    isOfflineMode,
    pendingChanges,
    isSyncing,
    addPendingChange,
    syncPendingChanges,
    cacheTournamentData,
    getCachedTournamentData,
    clearCachedTournamentData
  };
}