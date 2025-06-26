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
      syncPendingChanges();
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
  }, []);

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
      }I'll implement all four production-level upgrades while preserving the existing functionality and design system. Let me start with the database migrations and then move through each enhancement.

<boltArtifact id="production-upgrades" title="Production-Level Upgrades for Direktor">