import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, RefreshCw, Filter, Search, X } from 'lucide-react';
import ParticleBackground from '../ParticleBackground';
import StatisticsCard from './StatisticsCard';
import { supabase } from '../../lib/supabase';
import { Tournament } from '../../types/database';

interface StatisticsProps {
  tournamentId?: string;
  isPublic?: boolean;
}

interface StatResult {
  id: string;
  player1_name: string;
  player2_name: string;
  player1_score: number;
  player2_score: number;
  player1_rating: number;
  player2_rating: number;
  round_number: number;
  table_number: number;
  spread?: number;
  total_score?: number;
  winner_name?: string;
  loser_name?: string;
  winner_score?: number;
  loser_score?: number;
  rating_diff?: number;
}

const Statistics: React.FC<StatisticsProps> = ({ tournamentId: propTournamentId, isPublic = false }) => {
  const { tournamentId: paramTournamentId, slug } = useParams<{ tournamentId?: string; slug?: string }>();
  const navigate = useNavigate();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Statistics data
  const [topCombinedScores, setTopCombinedScores] = useState<StatResult[]>([]);
  const [biggestBlowouts, setBiggestBlowouts] = useState<StatResult[]>([]);
  const [largestSpreads, setLargestSpreads] = useState<StatResult[]>([]);
  const [mostDominantWins, setMostDominantWins] = useState<StatResult[]>([]);
  const [fewestDefeats, setFewestDefeats] = useState<any[]>([]);
  const [tightestGames, setTightestGames] = useState<StatResult[]>([]);
  const [narrowEscapes, setNarrowEscapes] = useState<StatResult[]>([]);
  const [highestScoringGames, setHighestScoringGames] = useState<StatResult[]>([]);
  const [closeDefeats, setCloseDefeats] = useState<StatResult[]>([]);
  const [biggestUpsets, setBiggestUpsets] = useState<StatResult[]>([]);

  // Determine the actual tournament ID to use
  const effectiveTournamentId = propTournamentId || paramTournamentId;

  useEffect(() => {
    if (slug) {
      loadTournamentBySlug();
    } else if (effectiveTournamentId) {
      loadTournament();
    }
  }, [effectiveTournamentId, slug]);

  useEffect(() => {
    if (tournament) {
      loadStatistics();
    }
  }, [tournament]);

  const loadTournamentBySlug = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        throw error;
      }

      setTournament(data);
    } catch (err: any) {
      console.error('Error loading tournament by slug:', err);
      setError('Failed to load tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTournament = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', effectiveTournamentId)
        .single();

      if (error) {
        throw error;
      }

      setTournament(data);
    } catch (err: any) {
      console.error('Error loading tournament:', err);
      setError('Failed to load tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      setIsRefreshing(true);
      
      // 1. Top Combined Game Score
      await fetchTopCombinedScores();
      
      // 2. Biggest Blowouts
      await fetchBiggestBlowouts();
      
      // 3. Largest Point Spread
      await fetchLargestSpreads();
      
      // 4. Most Dominant Wins
      await fetchMostDominantWins();
      
      // 5. Fewest Defeats
      await fetchFewestDefeats();
      
      // 6. Tightest Games
      await fetchTightestGames();
      
      // 7. Narrow Escapes
      await fetchNarrowEscapes();
      
      // 8. Highest Scoring Games
      await fetchHighestScoringGames();
      
      // 9. Close Defeats
      await fetchCloseDefeats();
      
      // 10. Biggest Upsets
      await fetchBiggestUpsets();
      
    } catch (err: any) {
      console.error('Error loading statistics:', err);
      setError('Failed to load tournament statistics');
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchTopCombinedScores = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1:players!pairings_player1_id_fkey(name, rating),
          player2:players!pairings_player2_id_fkey(name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .order('player1_score', { ascending: false })
      .order('player2_score', { ascending: false })
      .limit(5);

    if (error) throw error;

    const formattedData = (data || []).map(result => ({
      id: result.id,
      player1_name: result.pairing.player1.name,
      player2_name: result.pairing.player2.name,
      player1_score: result.player1_score,
      player2_score: result.player2_score,
      player1_rating: result.pairing.player1.rating,
      player2_rating: result.pairing.player2.rating,
      round_number: result.round_number,
      table_number: result.pairing.table_number,
      total_score: result.player1_score + result.player2_score
    }));

    // Sort by total score
    formattedData.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    
    setTopCombinedScores(formattedData);
  };

  const fetchBiggestBlowouts = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        winner_id,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1_id,
          player2_id,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .not('winner_id', 'is', null)
      .order('player1_score', { ascending: true })
      .order('player2_score', { ascending: true })
      .limit(10);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const isPlayer1Winner = result.winner_id === result.pairing.player1_id;
      const loserScore = isPlayer1Winner ? result.player2_score : result.player1_score;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        winner_name: isPlayer1Winner ? result.pairing.player1.name : result.pairing.player2.name,
        loser_name: isPlayer1Winner ? result.pairing.player2.name : result.pairing.player1.name,
        winner_score: isPlayer1Winner ? result.player1_score : result.player2_score,
        loser_score: loserScore
      };
    });

    // Sort by loser score (ascending)
    formattedData.sort((a, b) => (a.loser_score || 0) - (b.loser_score || 0));
    
    setBiggestBlowouts(formattedData);
  };

  const fetchLargestSpreads = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1:players!pairings_player1_id_fkey(name, rating),
          player2:players!pairings_player2_id_fkey(name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .order('player1_score', { ascending: false })
      .order('player2_score', { ascending: true })
      .limit(10);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const spread = Math.abs(result.player1_score - result.player2_score);
      const isPlayer1Winner = result.player1_score > result.player2_score;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        spread: spread,
        winner_name: isPlayer1Winner ? result.pairing.player1.name : result.pairing.player2.name,
        loser_name: isPlayer1Winner ? result.pairing.player2.name : result.pairing.player1.name,
        winner_score: isPlayer1Winner ? result.player1_score : result.player2_score,
        loser_score: isPlayer1Winner ? result.player2_score : result.player1_score
      };
    });

    // Sort by spread (descending)
    formattedData.sort((a, b) => (b.spread || 0) - (a.spread || 0));
    
    setLargestSpreads(formattedData);
  };

  const fetchMostDominantWins = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        winner_id,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1_id,
          player2_id,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .not('winner_id', 'is', null)
      .order('player1_score', { ascending: false })
      .order('player2_score', { ascending: false })
      .limit(10);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const isPlayer1Winner = result.winner_id === result.pairing.player1_id;
      const winnerScore = isPlayer1Winner ? result.player1_score : result.player2_score;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        winner_name: isPlayer1Winner ? result.pairing.player1.name : result.pairing.player2.name,
        loser_name: isPlayer1Winner ? result.pairing.player2.name : result.pairing.player1.name,
        winner_score: winnerScore,
        loser_score: isPlayer1Winner ? result.player2_score : result.player1_score
      };
    });

    // Sort by winner score (descending)
    formattedData.sort((a, b) => (b.winner_score || 0) - (a.winner_score || 0));
    
    setMostDominantWins(formattedData);
  };

  const fetchFewestDefeats = async () => {
    // First get all players
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('id, name, rating')
      .eq('tournament_id', tournament?.id);

    if (playersError) throw playersError;

    // Then get all results
    const { data: resultsData, error: resultsError } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        winner_id,
        pairing:pairings!results_pairing_id_fkey(
          player1_id,
          player2_id
        )
      `)
      .eq('tournament_id', tournament?.id);

    if (resultsError) throw resultsError;

    // Calculate losses for each player
    const playerStats = (playersData || []).map(player => {
      let losses = 0;
      let gamesPlayed = 0;

      (resultsData || []).forEach(result => {
        const isPlayer1 = result.pairing.player1_id === player.id;
        const isPlayer2 = result.pairing.player2_id === player.id;

        if (!isPlayer1 && !isPlayer2) return;

        gamesPlayed++;

        if (result.winner_id && result.winner_id !== player.id) {
          losses++;
        }
      });

      return {
        id: player.id,
        name: player.name,
        rating: player.rating,
        losses,
        gamesPlayed,
        lossPercentage: gamesPlayed > 0 ? (losses / gamesPlayed) * 100 : 0
      };
    });

    // Filter players with at least 3 games
    const qualifiedPlayers = playerStats.filter(player => player.gamesPlayed >= 3);
    
    // Sort by fewest losses, then by loss percentage
    qualifiedPlayers.sort((a, b) => {
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.lossPercentage - b.lossPercentage;
    });

    setFewestDefeats(qualifiedPlayers.slice(0, 5));
  };

  const fetchTightestGames = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1:players!pairings_player1_id_fkey(name, rating),
          player2:players!pairings_player2_id_fkey(name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .order('player1_score', { ascending: false })
      .order('player2_score', { ascending: false })
      .limit(20);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const spread = Math.abs(result.player1_score - result.player2_score);
      const isPlayer1Winner = result.player1_score > result.player2_score;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        spread: spread,
        winner_name: isPlayer1Winner ? result.pairing.player1.name : result.pairing.player2.name,
        loser_name: isPlayer1Winner ? result.pairing.player2.name : result.pairing.player1.name,
        winner_score: isPlayer1Winner ? result.player1_score : result.player2_score,
        loser_score: isPlayer1Winner ? result.player2_score : result.player1_score
      };
    });

    // Sort by spread (ascending)
    formattedData.sort((a, b) => (a.spread || 0) - (b.spread || 0));
    
    // Filter out ties
    const nonTies = formattedData.filter(game => game.spread !== 0);
    
    setTightestGames(nonTies.slice(0, 5));
  };

  const fetchNarrowEscapes = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        winner_id,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1_id,
          player2_id,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .not('winner_id', 'is', null)
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const isPlayer1Winner = result.winner_id === result.pairing.player1_id;
      const spread = isPlayer1Winner 
        ? result.player1_score - result.player2_score 
        : result.player2_score - result.player1_score;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        spread: spread,
        winner_name: isPlayer1Winner ? result.pairing.player1.name : result.pairing.player2.name,
        loser_name: isPlayer1Winner ? result.pairing.player2.name : result.pairing.player1.name,
        winner_score: isPlayer1Winner ? result.player1_score : result.player2_score,
        loser_score: isPlayer1Winner ? result.player2_score : result.player1_score
      };
    });

    // Filter for narrow escapes (1-5 point wins)
    const narrowEscapes = formattedData.filter(game => game.spread && game.spread > 0 && game.spread <= 5);
    
    // Sort by spread (ascending)
    narrowEscapes.sort((a, b) => (a.spread || 0) - (b.spread || 0));
    
    setNarrowEscapes(narrowEscapes.slice(0, 5));
  };

  const fetchHighestScoringGames = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1:players!pairings_player1_id_fkey(name, rating),
          player2:players!pairings_player2_id_fkey(name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .order('player1_score', { ascending: false })
      .order('player2_score', { ascending: false })
      .limit(10);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const highestScore = Math.max(result.player1_score, result.player2_score);
      const isPlayer1Highest = result.player1_score === highestScore;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        highest_score: highestScore,
        highest_scorer: isPlayer1Highest ? result.pairing.player1.name : result.pairing.player2.name
      };
    });

    // Sort by highest individual score
    formattedData.sort((a, b) => (b.highest_score || 0) - (a.highest_score || 0));
    
    setHighestScoringGames(formattedData.slice(0, 5));
  };

  const fetchCloseDefeats = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        winner_id,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1_id,
          player2_id,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .not('winner_id', 'is', null)
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const isPlayer1Winner = result.winner_id === result.pairing.player1_id;
      const spread = isPlayer1Winner 
        ? result.player1_score - result.player2_score 
        : result.player2_score - result.player1_score;
      const loserScore = isPlayer1Winner ? result.player2_score : result.player1_score;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        spread: spread,
        winner_name: isPlayer1Winner ? result.pairing.player1.name : result.pairing.player2.name,
        loser_name: isPlayer1Winner ? result.pairing.player2.name : result.pairing.player1.name,
        winner_score: isPlayer1Winner ? result.player1_score : result.player2_score,
        loser_score: loserScore
      };
    });

    // Filter for close defeats (1-5 point loss and loser scored over 400)
    const closeDefeats = formattedData.filter(
      game => game.spread && game.spread > 0 && game.spread <= 5 && (game.loser_score || 0) > 400
    );
    
    // Sort by loser score (descending)
    closeDefeats.sort((a, b) => (b.loser_score || 0) - (a.loser_score || 0));
    
    setCloseDefeats(closeDefeats.slice(0, 5));
  };

  const fetchBiggestUpsets = async () => {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        pairing_id,
        player1_score,
        player2_score,
        winner_id,
        round_number,
        pairing:pairings!results_pairing_id_fkey(
          table_number,
          player1_id,
          player2_id,
          player1:players!pairings_player1_id_fkey(id, name, rating),
          player2:players!pairings_player2_id_fkey(id, name, rating)
        )
      `)
      .eq('tournament_id', tournament?.id)
      .not('winner_id', 'is', null)
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map(result => {
      const isPlayer1Winner = result.winner_id === result.pairing.player1_id;
      const winnerRating = isPlayer1Winner ? result.pairing.player1.rating : result.pairing.player2.rating;
      const loserRating = isPlayer1Winner ? result.pairing.player2.rating : result.pairing.player1.rating;
      const ratingDiff = loserRating - winnerRating;
      
      return {
        id: result.id,
        player1_name: result.pairing.player1.name,
        player2_name: result.pairing.player2.name,
        player1_score: result.player1_score,
        player2_score: result.player2_score,
        player1_rating: result.pairing.player1.rating,
        player2_rating: result.pairing.player2.rating,
        round_number: result.round_number,
        table_number: result.pairing.table_number,
        winner_name: isPlayer1Winner ? result.pairing.player1.name : result.pairing.player2.name,
        loser_name: isPlayer1Winner ? result.pairing.player2.name : result.pairing.player1.name,
        winner_score: isPlayer1Winner ? result.player1_score : result.player2_score,
        loser_score: isPlayer1Winner ? result.player2_score : result.player1_score,
        winner_rating: winnerRating,
        loser_rating: loserRating,
        rating_diff: ratingDiff
      };
    });

    // Filter for upsets (lower-rated player beat higher-rated by at least 200 points)
    const upsets = formattedData.filter(game => game.rating_diff && game.rating_diff >= 200);
    
    // Sort by rating difference (descending)
    upsets.sort((a, b) => (b.rating_diff || 0) - (a.rating_diff || 0));
    
    setBiggestUpsets(upsets.slice(0, 5));
  };

  const handleRefresh = () => {
    loadStatistics();
  };

  const handleBack = () => {
    if (isPublic && tournament?.slug) {
      navigate(`/tournaments/${tournament.slug}`);
    } else if (isPublic && tournament?.id) {
      navigate(`/t/${tournament.id}`);
    } else {
      navigate('/dashboard');
    }
  };

  const formatPlayerScore = (name: string, score: number) => {
    return (
      <span className="font-mono">
        {name}: <span className="font-bold">{score}</span>
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4 font-orbitron">Error</h1>
          <p className="text-gray-300 mb-8">{error}</p>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains transition-all duration-200 mx-auto"
          >
            <ArrowLeft size={16} />
            {isPublic ? '← Back to Tournament' : '← Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-yellow-400 mb-4 font-orbitron">Tournament Not Found</h1>
          <p className="text-gray-300 mb-8">The tournament you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-jetbrains transition-all duration-200 mx-auto"
          >
            <ArrowLeft size={16} />
            ← Back to Home
          </button>
        </div>
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
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft size={20} />
              <span className="font-jetbrains">
                {isPublic ? '← Back to Tournament' : '← Back to Dashboard'}
              </span>
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 bg-blue-800/80 backdrop-blur-lg text-blue-300 hover:text-white rounded-lg border border-blue-700/50 hover:border-blue-600/50 transition-all duration-200 ${
                isRefreshing ? 'animate-pulse' : ''
              }`}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
              data-text="TOURNAMENT STATISTICS">
            📊 TOURNAMENT STATISTICS
          </h1>
          
          <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-cyan-400 mb-4 font-medium">
            {tournament.name}
          </p>
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Detailed metrics and performance analysis
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"></div>
        </div>

        {/* Search Bar */}
        <div className="max-w-6xl mx-auto w-full mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player names..."
              className="block w-full pl-10 pr-10 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-jetbrains"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Combined Game Score */}
            <StatisticsCard
              title="Top Combined Game Score"
              value={topCombinedScores.length > 0 ? `${topCombinedScores[0].total_score} points` : 'No data'}
              caption={topCombinedScores.length > 0 ? 
                `Round ${topCombinedScores[0].round_number}: ${topCombinedScores[0].player1_name} (${topCombinedScores[0].player1_score}) vs ${topCombinedScores[0].player2_name} (${topCombinedScores[0].player2_score})` 
                : undefined}
              icon="trophy"
              color="blue"
            />

            {/* Biggest Blowouts */}
            <StatisticsCard
              title="Biggest Blowouts"
              value={biggestBlowouts.length > 0 ? 
                formatPlayerScore(biggestBlowouts[0].loser_name, biggestBlowouts[0].loser_score || 0) 
                : 'No data'}
              caption={biggestBlowouts.length > 0 ? 
                `Round ${biggestBlowouts[0].round_number}: Lost to ${biggestBlowouts[0].winner_name} (${biggestBlowouts[0].winner_score})` 
                : undefined}
              icon="trending"
              color="red"
            />

            {/* Largest Point Spread */}
            <StatisticsCard
              title="Largest Point Spread"
              value={largestSpreads.length > 0 ? `${largestSpreads[0].spread} points` : 'No data'}
              caption={largestSpreads.length > 0 ? 
                `Round ${largestSpreads[0].round_number}: ${largestSpreads[0].winner_name} (${largestSpreads[0].winner_score}) vs ${largestSpreads[0].loser_name} (${largestSpreads[0].loser_score})` 
                : undefined}
              icon="trending"
              color="purple"
            />

            {/* Most Dominant Wins */}
            <StatisticsCard
              title="Most Dominant Wins"
              value={mostDominantWins.length > 0 ? 
                formatPlayerScore(mostDominantWins[0].winner_name, mostDominantWins[0].winner_score || 0) 
                : 'No data'}
              caption={mostDominantWins.length > 0 ? 
                `Round ${mostDominantWins[0].round_number}: Defeated ${mostDominantWins[0].loser_name} (${mostDominantWins[0].loser_score})` 
                : undefined}
              icon="zap"
              color="yellow"
            />

            {/* Fewest Defeats */}
            <StatisticsCard
              title="Fewest Defeats"
              value={fewestDefeats.length > 0 ? 
                `${fewestDefeats[0].name} (${fewestDefeats[0].losses} losses)` 
                : 'No data'}
              caption={fewestDefeats.length > 0 ? 
                `${fewestDefeats[0].gamesPlayed} games played, ${(100 - fewestDefeats[0].lossPercentage).toFixed(1)}% win rate` 
                : undefined}
              icon="award"
              color="green"
            />

            {/* Tightest Games */}
            <StatisticsCard
              title="Tightest Games"
              value={tightestGames.length > 0 ? `${tightestGames[0].spread} point margin` : 'No data'}
              caption={tightestGames.length > 0 ? 
                `Round ${tightestGames[0].round_number}: ${tightestGames[0].player1_name} (${tightestGames[0].player1_score}) vs ${tightestGames[0].player2_name} (${tightestGames[0].player2_score})` 
                : undefined}
              icon="target"
              color="cyan"
            />

            {/* Narrow Escapes */}
            <StatisticsCard
              title="Narrow Escapes"
              value={narrowEscapes.length > 0 ? `${narrowEscapes[0].spread} point win` : 'No data'}
              caption={narrowEscapes.length > 0 ? 
                `Round ${narrowEscapes[0].round_number}: ${narrowEscapes[0].winner_name} (${narrowEscapes[0].winner_score}) vs ${narrowEscapes[0].loser_name} (${narrowEscapes[0].loser_score})` 
                : undefined}
              icon="zap"
              color="blue"
            />

            {/* Highest Scoring Games */}
            <StatisticsCard
              title="Highest Scoring Games"
              value={highestScoringGames.length > 0 ? 
                formatPlayerScore(highestScoringGames[0].highest_scorer || '', highestScoringGames[0].highest_score || 0) 
                : 'No data'}
              caption={highestScoringGames.length > 0 ? 
                `Round ${highestScoringGames[0].round_number}: vs ${highestScoringGames[0].highest_scorer === highestScoringGames[0].player1_name ? highestScoringGames[0].player2_name : highestScoringGames[0].player1_name} (${highestScoringGames[0].highest_scorer === highestScoringGames[0].player1_name ? highestScoringGames[0].player2_score : highestScoringGames[0].player1_score})` 
                : undefined}
              icon="trophy"
              color="yellow"
            />

            {/* Close Defeats */}
            <StatisticsCard
              title="Close Defeats"
              value={closeDefeats.length > 0 ? 
                formatPlayerScore(closeDefeats[0].loser_name, closeDefeats[0].loser_score || 0) 
                : 'No data'}
              caption={closeDefeats.length > 0 ? 
                `Round ${closeDefeats[0].round_number}: Lost by ${closeDefeats[0].spread} to ${closeDefeats[0].winner_name} (${closeDefeats[0].winner_score})` 
                : undefined}
              icon="target"
              color="purple"
            />

            {/* Biggest Upsets */}
            <StatisticsCard
              title="Biggest Upsets"
              value={biggestUpsets.length > 0 ? 
                `${biggestUpsets[0].rating_diff} rating difference` 
                : 'No data'}
              caption={biggestUpsets.length > 0 ? 
                `Round ${biggestUpsets[0].round_number}: ${biggestUpsets[0].winner_name} (${biggestUpsets[0].winner_rating}) defeated ${biggestUpsets[0].loser_name} (${biggestUpsets[0].loser_rating})` 
                : undefined}
              icon="zap"
              color="green"
            />
          </div>
        </div>

        {/* Detailed Statistics Sections */}
        <div className="fade-up fade-up-delay-5 max-w-6xl mx-auto w-full mb-8">
          {/* Top Combined Scores */}
          <div className="bg-gray-900/50 border border-blue-500/30 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white font-orbitron mb-4 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Top Combined Game Scores
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Round</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Table</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 1</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player 2</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {topCombinedScores.map((game) => (
                    <tr key={game.id} className="hover:bg-gray-800/30 transition-colors duration-200">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                        {game.round_number}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                        {game.table_number}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {game.player1_name}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-white font-mono font-bold">
                        {game.player1_score}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {game.player2_name}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-white font-mono font-bold">
                        {game.player2_score}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-blue-400 font-mono font-bold">
                        {game.total_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Largest Point Spreads */}
          <div className="bg-gray-900/50 border border-purple-500/30 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white font-orbitron mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              Largest Point Spreads
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Round</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Winner</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Loser</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Spread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {largestSpreads.map((game) => (
                    <tr key={game.id} className="hover:bg-gray-800/30 transition-colors duration-200">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                        {game.round_number}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {game.winner_name}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-green-400 font-mono font-bold">
                        {game.winner_score}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {game.loser_name}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-red-400 font-mono font-bold">
                        {game.loser_score}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-purple-400 font-mono font-bold">
                        {game.spread}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Biggest Upsets */}
          <div className="bg-gray-900/50 border border-green-500/30 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white font-orbitron mb-4 flex items-center gap-2">
              <Zap className="w-6 h-6 text-green-400" />
              Biggest Upsets
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Round</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Winner</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Loser</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rating</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Diff</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {biggestUpsets.map((game) => (
                    <tr key={game.id} className="hover:bg-gray-800/30 transition-colors duration-200">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                        {game.round_number}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {game.winner_name}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-green-400 font-mono">
                        {game.winner_rating}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {game.loser_name}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-red-400 font-mono">
                        {game.loser_rating}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-green-400 font-mono font-bold">
                        +{game.rating_diff}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-sm text-white font-mono">
                        {game.winner_score}-{game.loser_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Tournament Statistics • Powered by Direktor
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default Statistics;