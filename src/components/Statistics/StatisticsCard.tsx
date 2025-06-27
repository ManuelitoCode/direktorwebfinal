import React from 'react';
import { Trophy, TrendingUp, Zap, Target, Award } from 'lucide-react';

interface StatisticsCardProps {
  title: string;
  value: string | React.ReactNode;
  caption?: string;
  icon?: 'trophy' | 'trending' | 'zap' | 'target' | 'award';
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'cyan';
  className?: string;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({
  title,
  value,
  caption,
  icon = 'trophy',
  color = 'blue',
  className = ''
}) => {
  const getIconComponent = () => {
    switch (icon) {
      case 'trophy':
        return <Trophy className="w-6 h-6" />;
      case 'trending':
        return <TrendingUp className="w-6 h-6" />;
      case 'zap':
        return <Zap className="w-6 h-6" />;
      case 'target':
        return <Target className="w-6 h-6" />;
      case 'award':
        return <Award className="w-6 h-6" />;
      default:
        return <Trophy className="w-6 h-6" />;
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return 'border-blue-500/50 from-blue-900/20 to-blue-800/20 text-blue-400';
      case 'green':
        return 'border-green-500/50 from-green-900/20 to-green-800/20 text-green-400';
      case 'purple':
        return 'border-purple-500/50 from-purple-900/20 to-purple-800/20 text-purple-400';
      case 'yellow':
        return 'border-yellow-500/50 from-yellow-900/20 to-yellow-800/20 text-yellow-400';
      case 'red':
        return 'border-red-500/50 from-red-900/20 to-red-800/20 text-red-400';
      case 'cyan':
        return 'border-cyan-500/50 from-cyan-900/20 to-cyan-800/20 text-cyan-400';
      default:
        return 'border-blue-500/50 from-blue-900/20 to-blue-800/20 text-blue-400';
    }
  };

  return (
    <div 
      className={`bg-gradient-to-br ${getColorClasses()} border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] ${className}`}
      style={{ boxShadow: `0 0 15px rgba(0, 0, 0, 0.2)` }}
      aria-label={`${title}: ${typeof value === 'string' ? value : 'See details'}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getColorClasses()}`}>
          {getIconComponent()}
        </div>
        <h3 className="text-xl font-bold text-white font-orbitron">
          {title}
        </h3>
      </div>
      
      <div className="text-2xl font-bold text-white font-jetbrains mb-2">
        {value}
      </div>
      
      {caption && (
        <div className="text-sm text-gray-400 font-jetbrains">
          {caption}
        </div>
      )}
    </div>
  );
};

export default StatisticsCard;