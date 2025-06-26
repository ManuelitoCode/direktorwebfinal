import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { ParsedPlayer } from '../types/database';

interface PlayerPreviewTableProps {
  players: ParsedPlayer[];
}

const PlayerPreviewTable: React.FC<PlayerPreviewTableProps> = ({ players }) => {
  if (players.length === 0) return null;

  const validPlayers = players.filter(p => p.isValid);
  const invalidPlayers = players.filter(p => !p.isValid);

  return (
    <div className="fade-up w-full max-w-4xl mx-auto">
      {/* Stats Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

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

export default PlayerPreviewTable;