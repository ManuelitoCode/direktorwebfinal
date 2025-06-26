import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Define a type for the cache
interface LogicBlockCache {
  [key: string]: {
    code: string;
    timestamp: number;
  };
}

// In-memory cache
const logicBlockCache: LogicBlockCache = {};
const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

export function useLogicBlock(featureName: string) {
  const [logicCode, setLogicCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogicBlock = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check cache first
        if (logicBlockCache[featureName] && 
            Date.now() - logicBlockCache[featureName].timestamp < CACHE_EXPIRY) {
          setLogicCode(logicBlockCache[featureName].code);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('logic_blocks')
          .select('logic_code')
          .eq('feature_name', featureName)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          // Update cache
          logicBlockCache[featureName] = {
            code: data.logic_code,
            timestamp: Date.now()
          };
          
          setLogicCode(data.logic_code);
        }
      } catch (err: any) {
        console.error(`Error fetching logic block for ${featureName}:`, err);
        setError(err.message || 'Failed to load logic block');
        
        // Return empty logic code
        setLogicCode('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogicBlock();
  }, [featureName]);

  return { logicCode, isLoading, error };
}

export function useLogicBlocksByFeature(featureNames: string[]) {
  const [logicBlocks, setLogicBlocks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogicBlocks = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check which feature names need to be fetched
        const featuresToFetch = featureNames.filter(name => 
          !logicBlockCache[name] || 
          Date.now() - logicBlockCache[name].timestamp >= CACHE_EXPIRY
        );

        if (featuresToFetch.length === 0) {
          // All data is in cache
          const cachedBlocks: Record<string, string> = {};
          featureNames.forEach(name => {
            cachedBlocks[name] = logicBlockCache[name].code;
          });
          setLogicBlocks(cachedBlocks);
          setIsLoading(false);
          return;
        }

        // Fetch only what we need
        const { data, error } = await supabase
          .from('logic_blocks')
          .select('feature_name, logic_code')
          .in('feature_name', featuresToFetch);

        if (error) {
          throw error;
        }

        // Update cache and prepare result
        const result: Record<string, string> = {};
        
        // First add cached items
        featureNames.forEach(name => {
          if (logicBlockCache[name] && 
              Date.now() - logicBlockCache[name].timestamp < CACHE_EXPIRY) {
            result[name] = logicBlockCache[name].code;
          }
        });
        
        // Then add newly fetched items
        if (data) {
          data.forEach(item => {
            // Update cache
            logicBlockCache[item.feature_name] = {
              code: item.logic_code,
              timestamp: Date.now()
            };
            
            // Add to result
            result[item.feature_name] = item.logic_code;
          });
        }
        
        setLogicBlocks(result);
      } catch (err: any) {
        console.error('Error fetching logic blocks:', err);
        setError(err.message || 'Failed to load logic blocks');
        setLogicBlocks({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogicBlocks();
  }, [featureNames]);

  return { logicBlocks, isLoading, error };
}