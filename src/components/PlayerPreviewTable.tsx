import React from 'react';
import { CheckCircle, AlertCircle, Users } from 'lucide-react';
import { ParsedPlayer, Team } from '../types/database';
import TeamLogo from './TeamLogo';

interface PlayerPreviewTableProps {
  players: ParsedPlayer[];
  teamMode?: boolean;
  teams?: Team[];
}

const PlayerPreviewTable: React.FC<PlayerPreviewTableProps> = ({ 
  players, 
  teamMode = false, 
  teams = [] 
}) => {
  if (players.length === 0) return null;

  const validPlayers = players.filter(p => p.isValid);
  const invalidPlayers = players.filter(p => !p.isValid);

  // Group players by team if in team mode
  const teamGroups = teamMode ? groupPlayersByTeam(validPlayers) : new Map();

  // Helper function to get team info
  const getTeamInfo = (teamName: string): Team | undefined => {
    return teams.find(team => team.name === teamName);
  };

  return (
    <div className="fade-up w-full max-w-4xl mx-auto">
      {/* Stats Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white font-orbitron">{players.length}</div>
          <div className="text-gray-400 text-sm">Total Entries</div>
        </div>
        <div className="bg-gray-900/50 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400 font-orbitron">{validPlayers.length}</div>
          <div className="text-gray-400 text-sm">Valid Players</div>
        </div>
        <div className="bg-gray-900/50 border border-red-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400 font-orbitron">{invalidPlayers.length}</div>
          <div className="text-gray-400 text-sm">Errors</div>
        </div>
        {teamMode && (
          <div className="bg-gray-900/50 border border-blue-500/30 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400 font-orbitron">{teamGroups.size}</div>
            <div className="text-gray-400 text-sm">Teams</div>
          </div>
        )}
      </div>

      {/* Team Summary (Team Mode Only) */}
      {teamMode && teamGroups.size > 0 && (
        <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-300 font-orbitron mb-4 flex items-center gap-2">
            <Users size={20} />
            Team Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(teamGroups.entries()).map(([teamName, teamPlayers]) => {
              const teamInfo = getTeamInfo(teamName);
              return (
                <div key={teamName} className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <TeamLogo 
                      team={teamInfo} 
                      teamName={teamName} 
                      size="sm" 
                      showFlag={true}
                    />
                    <div className="font-medium text-white">{teamName}</div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {teamPlayers.length} player{teamPlayers.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Avg Rating: {Math.round(teamPlayers.reduce((sum, p) => sum + p.rating, 0) / teamPlayers.length)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Players Table */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">#</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rating</th>
                {teamMode && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                )}
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {players.map((player, index) => (
                <tr 
                  key={index} 
                  className={`${
                    player.isValid 
                      ? 'bg-gray-900/30 hover:bg-gray-800/30' 
                      : 'bg-red-900/20 hover:bg-red-800/20'
                  } transition-colors duration-200`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {player.isValid ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                    {player.name || <span className="text-gray-500 italic">No name</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                    {player.isValid ? player.rating : '-'}
                  </td>
                  {teamMode && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.team_name ? (
                        <div className="flex items-center gap-2">
                          <TeamLogo 
                            team={getTeamInfo(player.team_name)} 
                            teamName={player.team_name} 
                            size="xs" 
                            showFlag={false}
                          />
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100/10 text-blue-300 border border-blue-500/30">
                            {player.team_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-sm">No team</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400">
                    {player.error || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function groupPlayersByTeam(players: ParsedPlayer[]): Map<string, ParsedPlayer[]> {
  const teams = new Map<string, ParsedPlayer[]>();
  
  players.forEach(player => {
    if (!player.team_name) return;
    
    if (!teams.has(player.team_name)) {
      teams.set(player.team_name, []);
    }
    teams.get(player.team_name)!.push(player);
  });
  
  return teams;
}

export default PlayerPreviewTable;