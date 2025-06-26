import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface OfflineData {
  tournaments: any[];
  players: any[];
  pairings: any[];
  results: any[];
  lastSync: string;
}

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isOfflineMode) {
        syncPendingChanges();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsOfflineMode(true);
      showOfflineToast();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOfflineMode]);

  const showOfflineToast = () => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 z-50 bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-lg font-jetbrains text-sm border border-yellow-500/50';
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
        You're working offline – changes will sync when internet is restored
      </div>
    `;
    document.body.appendChild(toast);
    
    // Keep toast visible while offline
    const checkOnline = () => {
      if (navigator.onLine) {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      } else {
        setTimeout(checkOnline, 1000);
      }
    I'll implement all four production-level upgrades for the Direktor app. Let me start with the database migrations and then implement the features systematically.

<boltArtifact id="production-upgrades" title="Production-Level Upgrades for Direktor">