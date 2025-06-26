import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Define a type for the cache
interface PromptCache {
  [key: string]: {
    content: string;
    timestamp: number;
  };
}

// In-memory cache
const promptCache: PromptCache = {};
const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

export function usePrompt(title: string, category?: string) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const cacheKey = `${title}-${category || 'all'}`;
        
        // Check cache first
        if (promptCache[cacheKey] && 
            Date.now() - promptCache[cacheKey].timestamp < CACHE_EXPIRY) {
          setContent(promptCache[cacheKey].content);
          setIsLoading(false);
          return;
        }

        // Build query
        let query = supabase
          .from('prompts')
          .select('content')
          .eq('title', title);
        
        // Add category filter if provided
        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query.single();

        if (error) {
          throw error;
        }

        if (data) {
          // Update cache
          promptCache[cacheKey] = {
            content: data.content,
            timestamp: Date.now()
          };
          
          setContent(data.content);
        }
      } catch (err: any) {
        console.error('Error fetching prompt:', err);
        setError(err.message || 'Failed to load prompt');
        
        // Return a fallback message
        setContent('Information not available. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrompt();
  }, [title, category]);

  return { content, isLoading, error };
}

export function usePromptsByCategory(category: string) {
  const [prompts, setPrompts] = useState<Array<{ title: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const cacheKey = `category-${category}`;
        
        // Check cache first
        if (promptCache[cacheKey] && 
            Date.now() - promptCache[cacheKey].timestamp < CACHE_EXPIRY) {
          setPrompts(JSON.parse(promptCache[cacheKey].content));
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('prompts')
          .select('title, content')
          .eq('category', category);

        if (error) {
          throw error;
        }

        if (data) {
          // Update cache
          promptCache[cacheKey] = {
            content: JSON.stringify(data),
            timestamp: Date.now()
          };
          
          setPrompts(data);
        }
      } catch (err: any) {
        console.error('Error fetching prompts by category:', err);
        setError(err.message || 'Failed to load prompts');
        setPrompts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrompts();
  }, [category]);

  return { prompts, isLoading, error };
}