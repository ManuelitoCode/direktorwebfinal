import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Download, ArrowRight, Users, Medal } from 'lucide-react';
import ParticleBackground from './ParticleBackground';
import Button from './Button';
import PlayerDetailsModal from './PlayerDetailsModal';
import { supabase } from '../lib/supabase';
import { Tournament, Player, Result, Pairing } from '../types/database';

interface StandingsProps {
  onBack: () => void;
  onNextRound: () => void;
  tournamentId: string;
  currentRound: number;
  maxRounds: number;
}

interface PlayerStanding {
  id: string;
  name: string;
  rank: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  spread: number;
  lastGame: {
    result: 'won' | 'lost' | 'drew';
    playerScore: number;
    opponentScore: number;
    opponentName: string;
    opponentRank: number;
  } | null;
  starts: number;
}

const Standings: React.FC<StandingsProps> = ({ 
  onBack, 
  onNextRound, 
  tournamentId, 
  currentRound,
  maxRounds 
}) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  useEffect(() => {
    loadStandings();
  }, [tournamentId, currentRound]);

  const loadStandings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Load all players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;

      // Load all results for this tournament
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select(`
          *,
          pairing:pairings!results_pairing_id_fkey(
            player1_id,
            player2_id,
            player1_rank,
            player2_rank,
            round_number
          )
        `)
        .eq('pairing.tournament_id', tournamentId);

      if (resultsError) throw resultsError;

      // Load all pairings to calculate starts
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select('first_move_player_id, player1_id, player2_id, player1_rank, player2_rank, round_number')
        .eq('tournament_id', tournamentId);

      if (pairingsError) throw pairingsError;

      // Calculate standings
      const playerStandings = await calculateStandings(
        playersData, 
        resultsData, 
        pairingsData
      );

      setStandings(playerStandings);
    } catch (err) {
      console.error('Error loading standings:', err);
      setError('Failed to load standings');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStandings = async (
    players: Player[], 
    results: any[], 
    pairings: any[]
  ): Promise<PlayerStanding[]> => {
    const standings: PlayerStanding[] = [];

    for (const player of players) {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;
      let lastGame = null;
      let lastRound = 0;

      // Count starts
      const starts = pairings.filter(p => p.first_move_player_id === player.id).length;

      // Process each result
      for (const result of results) {
        const pairing = result.pairing;
        if (!pairing) continue;

        const isPlayer1 = pairing.player1_id === player.id;
        const isPlayer2 = pairing.player2_id === player.id;

        if (!isPlayer1 && !isPlayer2) continue;

        const playerScore = isPlayer1 ? result.player1_score : result.player2_score;
        const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;
        const opponentId = isPlayer1 ? pairing.player2_id : pairing.player1_id;
        const opponentRank = isPlayer1 ? pairing.player2_rank : pairing.player1_rank;

        pointsFor += playerScore;
        pointsAgainst += opponentScore;

        // Determine result
        let gameResult: 'won' | 'lost' | 'drew';
        if (playerScore > opponentScore) {
          wins++;
          gameResult = 'won';
        } else if (playerScore < opponentScore) {
          losses++;
          gameResult = 'lost';
        } else {
          draws++;
          gameResult = 'drew';
        }

        // Track most recent game
        if (pairing.round_number > lastRound) {
          lastRound = pairing.round_number;
          
          // Get opponent name
          const opponent = players.find(p => p.id === opponentId);
          
          lastGame = {
            result: gameResult,
            playerScore,
            opponentScore,
            opponentName: opponent?.name || 'Unknown',
            opponentRank
          };
        }
      }

      const points = wins + (draws * 0.5);
      const spread = pointsFor - pointsAgainst;

      standings.push({
        id: player.id!,
        name: player.name,
        rank: 0, // Will be calculated after sorting
        rating: player.rating,
        wins,
        losses,
        draws,
        points,
        spread,
        lastGame,
        starts
      });
    }

    // Sort by points (desc), then spread (desc), then rating (desc)
    standings.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });

    // Assign ranks
    standings.forEach((standing, index) => {
      standing.rank = index + 1;
    });

    return standings;
  };

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setShowPlayerModal(true);
  };

  const exportToCSV = () => {
    const headers = ['Rank', 'Name', 'ID', 'W-L-D', 'Points', 'Spread', 'Last Game', 'Starts'];
    const rows = standings.map(s => [
      s.rank,
      s.name,
      s.id,
      `${s.wins}-${s.losses}-${s.draws}`,
      s.points,
      s.spread,
      s.lastGame ? 
        `${s.lastGame.result === 'won' ? 'Won' : s.lastGame.result === 'lost' ? 'Lost' : 'Drew'} (${s.lastGame.playerScore}-${s.lastGame.opponentScore}) vs ${s.lastGame.opponentName}` :
        'No games',
      s.starts
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament?.name || 'Tournament'}_Round_${currentRound}_Standings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/50 text-yellow-400';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50 text-gray-300';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/50 text-amber-400';
      default:
        return '';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const formatLastGame = (lastGame: PlayerStanding['lastGame']) => {
    if (!lastGame) return 'No games';

    const resultIcon = lastGame.result === 'won' ? '✅' : lastGame.result === 'lost' ? '❌' : '⚖️';
    const resultText = lastGame.result === 'won' ? 'Won' : lastGame.result === 'lost' ? 'Lost' : 'Drew';
    
    return (
      <div className="text-xs">
        <div className="flex items-center gap-1 mb-1">
          <span>{resultIcon}</span>
          <span className="font-medium">{resultText}</span>
        </div>
        <div className="text-gray-400">
          ({lastGame.playerScore}–{lastGame.opponentScore}) vs {lastGame.opponentName} (#{lastGame.opponentRank})
        </div>
      </div>
    );
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
            <div className="flex items-center gap-2 text-yellow-400">
              <Trophy size={24} />
              <span className="font-jetbrains text-sm">Live Standings</span>
            </div>
          </div>

          <h1 className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
              data-text="STANDINGS">
            STANDINGS
          </h1>
          
          {tournament && (
            <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-yellow-400 mb-4 font-medium">
              {tournament.name}
            </p>
          )}
          
          <p className="fade-up fade-up-delay-2 text-lg text-gray-300 mb-6 font-light tracking-wide">
            Live Standings – Round {currentRound}
          </p>
          
          <div className="fade-up fade-up-delay-3 w-24 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 mx-auto rounded-full"></div>
        </div>

        {/* Export Button */}
        <div className="fade-up fade-up-delay-4 max-w-6xl mx-auto w-full mb-8 text-right">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/80 backdrop-blur-lg text-gray-300 hover:text-white rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200"
          >
            <Download size={16} />
            📄 Export Standings (CSV)
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-6xl mx-auto w-full mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 font-jetbrains text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Standings Table */}
        <div className="fade-up fade-up-delay-5 max-w-6xl mx-auto w-full mb-8">
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
                <Users size={24} />
                Tournament Leaderboard
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player Name (#ID)</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">W–L–D</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Points</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Spread</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Last Game</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains"># Starts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {standings.map((standing) => (
                    <tr 
                      key={standing.id} 
                      className={`transition-colors duration-200 hover:bg-gray-800/30 ${getRankStyle(standing.rank)}`}
                    >
                      {/* Rank */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getRankIcon(standing.rank)}
                          <span className="text-lg font-bold font-orbitron">
                            {standing.rank}
                          </span>
                        </div>
                      </td>
                      
                      {/* Player Name - Clickable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handlePlayerClick(standing.id)}
                          className="text-left hover:bg-blue-500/20 rounded-lg p-2 -m-2 transition-all duration-200 group"
                        >
                          <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors duration-200">
                            {standing.name}
                          </div>
                          <div className="text-xs text-gray-400 font-jetbrains">
                            Rating: {standing.rating}
                          </div>
                        </button>
                      </td>
                      
                      {/* W-L-D */}
                      <td className="px-6 py-4 text-center">
                        <div className="font-mono text-sm text-white">
                          <span className="text-green-400">{standing.wins}</span>–
                          <span className="text-red-400">{standing.losses}</span>–
                          <span className="text-yellow-400">{standing.draws}</span>
                        </div>
                      </td>
                      
                      {/* Points */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-lg font-bold text-white font-orbitron">
                          {standing.points}
                        </span>
                      </td>
                      
                      {/* Spread */}
                      <td className="px-6 py-4 text-center">
                        <span className={`font-mono text-sm ${
                          standing.spread > 0 ? 'text-green-400' : 
                          standing.spread < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {standing.spread > 0 ? '+' : ''}{standing.spread}
                        </span>
                      </td>
                      
                      {/* Last Game */}
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          {formatLastGame(standing.lastGame)}
                        </div>
                      </td>
                      
                      {/* Starts */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-300 font-mono">
                          {standing.starts}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fade-up max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Button
            icon={ArrowLeft}
            label="⬅ Back to Round Manager"
            onClick={onBack}
            variant="blue"
          />
          
          {currentRound < maxRounds && (
            <Button
              icon={ArrowRight}
              label="➡ Next Round"
              onClick={onNextRound}
              variant="green"
            />
          )}
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-auto">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Standings updated after Round {currentRound} • Click player names for detailed stats
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </footer>
      </div>

      {/* Player Details Modal */}
      {selectedPlayerId && (
        <PlayerDetailsModal
          isOpen={showPlayerModal}
          onClose={() => {
            setShowPlayerModal(false);
            setSelectedPlayerId(null);
          }}
          playerId={selectedPlayerId}
          tournamentId={tournamentId}
        />
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-yellow-500/20 to-transparent rounded-br-full blur-xl"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-orange-500/20 to-transparent rounded-tl-full blur-xl"></div>
    </div>
  );
};

export default Standings;