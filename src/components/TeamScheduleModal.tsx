import React, { useState } from 'react';
import { X, Calendar, Users, Trophy, CheckCircle, ArrowRight } from 'lucide-react';

interface TeamScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSkip: () => void;
  teams: string[];
  totalRounds: number;
}

const TeamScheduleModal: React.FC<TeamScheduleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  teams,
  totalRounds
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900/95 backdrop-blur-lg border-2 border-green-500/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-green-500/30 bg-gradient-to-r from-green-900/30 to-blue-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white font-orbitron">
                Generate Team Schedule?
              </h2>
              <p className="text-green-300 font-jetbrains">
                Automatic team round-robin scheduling
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            
            <h3 className="text-xl font-bold text-white font-orbitron mb-4">
              Ready to Generate Full Team Schedule
            </h3>
            
            <p className="text-gray-300 font-jetbrains leading-relaxed mb-6">
              We can automatically create a complete team round-robin schedule where each team plays every other team once. 
              This will generate {totalRounds} rounds with all necessary matchups.
            </p>
          </div>

          {/* Team Summary */}
          <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6 mb-8">
            <h4 className="text-lg font-bold text-white font-orbitron mb-4 flex items-center gap-2">
              <Users size={20} />
              Tournament Summary
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-400 font-orbitron">
                  {teams.length}
                </div>
                <div className="text-gray-400 font-jetbrains text-sm">Teams</div>
              </div>
              
              <div>
                <div className="text-2xl font-bold text-blue-400 font-orbitron">
                  {totalRounds}
                </div>
                <div className="text-gray-400 font-jetbrains text-sm">Rounds</div>
              </div>
              
              <div>
                <div className="text-2xl font-bold text-purple-400 font-orbitron">
                  {Math.floor((teams.length * (teams.length - 1)) / 2)}
                </div>
                <div className="text-gray-400 font-jetbrains text-sm">Total Matches</div>
              </div>
            </div>
          </div>

          {/* Teams List */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 mb-8">
            <h4 className="text-lg font-bold text-blue-300 font-orbitron mb-4">
              Participating Teams
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {teams.map((team, index) => (
                <div
                  key={team}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-600 rounded-lg"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold font-orbitron text-sm">
                    {team.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white font-jetbrains">{team}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Details */}
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6 mb-8">
            <h4 className="text-lg font-bold text-green-300 font-orbitron mb-4 flex items-center gap-2">
              <CheckCircle size={20} />
              What Will Be Generated
            </h4>
            
            <ul className="space-y-3 text-gray-300 font-jetbrains">
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Complete round-robin schedule ensuring each team plays every other team
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                All players from one team will play all players from the opposing team
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Automatic table assignments and first-move determination
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Ready-to-use pairings for immediate tournament start
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={onConfirm}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-jetbrains font-medium transition-all duration-200 transform hover:scale-105"
            >
              <CheckCircle size={20} />
              ✔️ Yes, Generate Team Schedule
            </button>
            
            <button
              onClick={onSkip}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-jetbrains font-medium transition-all duration-200"
            >
              <ArrowRight size={20} />
              No, I'll Do This Manually Later
            </button>
          </div>

          {/* Note */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 font-jetbrains text-sm">
              You can always modify pairings later in the tournament control center
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamScheduleModal;