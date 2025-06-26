import React from 'react';
import { Settings } from 'lucide-react';

interface SettingsButtonProps {
  onClick: () => void;
  className?: string;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`absolute bottom-4 right-4 w-10 h-10 bg-purple-600/20 border border-purple-500/50 rounded-lg flex items-center justify-center text-purple-400 hover:bg-purple-600/30 hover:text-white hover:border-purple-400 transition-all duration-200 group/gear ${className}`}
      title="Edit Profile"
      aria-label="Edit Profile Settings"
    >
      <Settings className="w-5 h-5 group-hover/gear:rotate-90 transition-transform duration-300" />
    </button>
  );
};

export default SettingsButton;