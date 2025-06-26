import React, { useState, useEffect } from 'react';
import { Trophy, Users, Target, TrendingUp, Medal, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Player, Result, Pairing, TeamStanding } from '../types/database';
import { calculateTeamStandings } from '../utils/teamPairingAlgorithms';

interface TeamStandingsProps {
  tournamentId: string;
  onPlayerClick?: (playerId: string) => void;
}

const TeamStandings: React.FC<TeamStandingsProps> = ({ 
  tournamentId, 
  onPlayerClick 
}) => {
  const [teamStandings, setTeamStandings] = useState<TeamStanding[]>([]);
  const [individualStandings, setIndividualStandings] = useState<Array<{
    id: string;
    name: string;
    team_name: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    points: number;
    spread: number;
    rank: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'individuals'>('teams');

  useEffect(() => {
    loadStandings();
  }, [tournamentId]);

  const loadStandings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('rating', { ascending: false });

      if (playersError) throw playersError;

      // Load all results
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (resultsError && resultsError.code !== 'PGRST116') {
        throw resultsError;
      }

      // Load all pairings
      const { data: pairingsData, error: pairingsError } = await supabase
        .from('pairings')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (pairingsError && pairingsError.code !== 'PGRST116') {
        throw pairingsError;
      }

      // Calculate team standings
      const teamStandingsData = calculateTeamStandings(
        playersData || [],
        resultsData || [],
        pairingsData || []
      );

      setTeamStandings(teamStandingsData);

      // Calculate individual standings within teams
      const individualStandingsData = calculateIndividualStandings(
        playersData || [],
        resultsData || [],
        pairingsData || []
      );

      setIndividualStandings(individualStandingsData);

    } catch (err) {
      console.error('Error loading team standings:', err);
      setError('Failed to load team standings');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateIndividualStandings = (
    players: Player[],
    results: any[],
    pairings: any[]
  ) => {
    const standings = players.map(player => {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      results.forEach(result => {
        const pairing = pairings.find(p => p.id === result.pairing_id);
        if (!pairing) return;

        const isPlayer1 = pairing.player1_id === player.id;
        const isPlayer2 = pairing.player2_id === player.id;

        if (!isPlayer1 && !isPlayer2) return;

        const playerScore = isPlayer1 ? result.player1_score : result.player2_score;
        const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;

        pointsFor += playerScore;
        pointsAgainst += opponentScore;

        if (playerScore > opponentScore) {
          wins++;
        } else if (playerScore < opponentScore) {
          losses++;
        } else {
          draws++;
        }
      });

      const points = wins + (draws * 0.5);
      const spread = pointsFor - pointsAgainst;

      return {
        id: player.id!,
        name: player.name,
        team_name: player.team_name || '',
        rating: player.rating,
        wins,
        losses,
        draws,
        points,
        spread,
        rank: 0
      };
    });

    // Sort by points, then spread, then rating
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

  const exportTeamStandings = () => {
    const headers = ['Rank', 'Team', 'Matches W-L-D', 'Games Won', 'Total Spread', 'Players'];
    const rows = teamStandings.map(team => [
      team.rank,
      team.team_name,
      `${team.matches_won}-${team.matches_lost}-${team.matches_drawn}`,
      team.total_games_won,
      team.total_spread,
      team.players.map(p => p.name).join(', ')
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Team_Standings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportIndividualStandings = () => {
    const headers = ['Rank', 'Name', 'Team', 'Rating', 'W-L-D', 'Points', 'Spread'];
    const rows = individualStandings.map(player => [
      player.rank,
      player.name,
      player.team_name,
      player.rating,
      `${player.wins}-${player.losses}-${player.draws}`,
      player.points,
      player.spread
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Individual_Standings.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/50';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/50';
      default:
        return '';
    }
  };

  const getTeamColor = (teamName: string) => {
    // Generate consistent colors for teams
    const colors = [
      'bg-blue-500/20 border-blue-500/50 text-blue-300',
      'bg-green-500/20 border-green-500/50 text-green-300',
      'bg-purple-500/20 border-purple-500/50 text-purple-300',
      'bg-red-500/20 border-red-500/50 text-red-300',
      'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
      'bg-pink-500/20 border-pink-500/50 text-pink-300',
      'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
      'bg-orange-500/20 border-orange-500/50 text-orange-300'
    ];
    
    const hash = teamName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400 font-jetbrains">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
              activeTab === 'teams'
                ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                : 'bg-gray-800/50 border border-gray-600/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            <Users size={16} />
            Team Standings
          </button>
          
          <button
            onClick={() => setActiveTab('individuals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
              activeTab === 'individuals'
                ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                : 'bg-gray-800/50 border border-gray-600/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            <Target size={16} />
            Individual Standings
          </button>
        </div>

        <button
          onClick={activeTab === 'teams' ? exportTeamStandings : exportIndividualStandings}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 backdrop-blur-lg text-gray-300 hover:text-white rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Team Standings */}
      {activeTab === 'teams' && (
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
              <Users size={24} />
              Team Standings
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rank</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Team</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Matches W-L-D</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Games Won</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Total Spread</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Players</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {teamStandings.map((team) => (
                  <tr 
                    key={team.team_name} 
                    className={`transition-colors duration-200 hover:bg-gray-800/30 ${getRankStyle(team.rank)}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getRankIcon(team.rank)}
                        <span className="text-lg font-bold font-orbitron text-white">
                          #{team.rank}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getTeamColor(team.team_name)}`}>
                        {team.team_name}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className="font-mono text-sm text-white">
                        <span className="text-green-400">{team.matches_won}</span>–
                        <span className="text-red-400">{team.matches_lost}</span>–
                        <span className="text-yellow-400">{team.matches_drawn}</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-bold text-white font-orbitron">
                        {team.total_games_won}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`font-mono text-sm ${
                        team.total_spread > 0 ? 'text-green-400' : 
                        team.total_spread < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {team.total_spread > 0 ? '+' : ''}{team.total_spread}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {team.players.map((player) => (
                          <button
                            key={player.id}
                            onClick={() => onPlayerClick?.(player.id!)}
                            className="text-xs bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white px-2 py-1 rounded transition-all duration-200"
                          >
                            {player.name}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {teamStandings.length === 0 && (
            <div className="text-center py-12 text-gray-400 font-jetbrains">
              No team standings available yet
            </div>
          )}
        </div>
      )}

      {/* Individual Standings */}
      {activeTab === 'individuals' && (
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white font-orbitron flex items-center gap-2">
              <Target size={24} />
              Individual Standings
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Rank</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Player</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Team</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">W-L-D</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Points</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider font-jetbrains">Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {individualStandings.map((player) => (
                  <tr 
                    key={player.id} 
                    className={`transition-colors duration-200 hover:bg-gray-800/30 ${getRankStyle(player.rank)}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getRankIcon(player.rank)}
                        <span className="text-lg font-bold font-orbitron text-white">
                          #{player.rank}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onPlayerClick?.(player.id)}
                        className="text-left hover:bg-blue-500/20 rounded-lg p-2 -m-2 transition-all duration-200 group"
                      >
                        <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors duration-200">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-400 font-jetbrains">
                          Rating: {player.rating}
                        </div>
                      </button>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTeamColor(player.team_name)}`}>
                        {player.team_name}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className="font-mono text-sm text-white">
                        <span className="text-green-400">{player.wins}</span>–
                        <span className="text-red-400">{player.losses}</span>–
                        <span className="text-yellow-400">{player.draws}</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-bold text-white font-orbitron">
                        {player.points}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`font-mono text-sm ${
                        player.spread > 0 ? 'text-green-400' : 
                        player.spread < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {player.spread > 0 ? '+' : ''}{player.spread}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {individualStandings.length === 0 && (
            <div className="text-center py-12 text-gray-400 font-jetbrains">
              No individual standings available yet
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamStandings;