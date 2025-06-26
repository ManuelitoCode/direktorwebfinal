import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Trophy, Crown, Zap } from 'lucide-react';
import { Tournament, Division } from '../types/database';

interface TournamentHeaderProps {
  tournament: Tournament;
  division?: Division | null;
  showDivision?: boolean;
  variant?: 'default' | 'projector' | 'public';
  className?: string;
}

const TournamentHeader: React.FC<TournamentHeaderProps> = ({
  tournament,
  division,
  showDivision = false,
  variant = 'default',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const getVariantStyles = () => {
    switch (variant) {
      case 'projector':
        return {
          container: 'bg-gradient-to-r from-blue-900/80 to-purple-900/80 border-b-4 border-blue-400',
          title: 'text-6xl md:text-8xl text-white',
          subtitle: 'text-2xl md:text-3xl text-blue-300',
          info: 'text-xl md:text-2xl text-blue-200',
          neonBorder: 'shadow-[0_0_30px_rgba(59,130,246,0.6)]'
        };
      case 'public':
        return {
          container: 'bg-gradient-to-r from-gray-900/90 to-blue-900/90 border-b-2 border-cyan-400',
          title: 'text-4xl md:text-6xl text-white',
          subtitle: 'text-xl md:text-2xl text-cyan-300',
          info: 'text-lg md:text-xl text-cyan-200',
          neonBorder: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]'
        };
      default:
        return {
          container: 'bg-gradient-to-r from-gray-900/85 to-blue-900/85 border-b-2 border-blue-500',
          title: 'text-3xl md:text-5xl text-white',
          subtitle: 'text-lg md:text-xl text-blue-300',
          info: 'text-base md:text-lg text-blue-200',
          neonBorder: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]'
        };
    }
  };

  const styles = getVariantStyles();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusIcon = () => {
    switch (tournament.status) {
      case 'setup':
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 'registration':
        return <Users className="w-6 h-6 text-blue-400" />;
      case 'active':
        return <Zap className="w-6 h-6 text-green-400 animate-pulse" />;
      case 'completed':
        return <Trophy className="w-6 h-6 text-gold-400" />;
      case 'paused':
        return <div className="w-6 h-6 bg-orange-400 rounded-full animate-pulse" />;
      default:
        return <Trophy className="w-6 h-6 text-blue-400" />;
    }
  };

  const getStatusText = () => {
    switch (tournament.status) {
      case 'setup':
        return 'Setting Up';
      case 'registration':
        return 'Registration Open';
      case 'active':
        return 'Tournament Active';
      case 'completed':
        return 'Tournament Complete';
      case 'paused':
        return 'Tournament Paused';
      default:
        return 'Tournament';
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Top Neon Border */}
      <div className={`h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 ${styles.neonBorder}`} />
      
      {/* Main Header Container */}
      <div 
        className={`${styles.container} backdrop-blur-lg transition-all duration-1000 transform ${
          isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left Side: Tournament Info */}
            <div className="flex-1">
              {/* Tournament Name */}
              <div className="mb-4">
                <h1 
                  className={`${styles.title} font-bold font-orbitron tracking-wider leading-tight transition-all duration-700 delay-200 transform ${
                    isVisible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
                  }`}
                  style={{
                    textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  {tournament.name}
                </h1>
                
                {/* Division Name */}
                {showDivision && division && (
                  <div 
                    className={`${styles.subtitle} font-medium font-jetbrains mt-2 transition-all duration-700 delay-300 transform ${
                      isVisible ? 'translate-x-0 opacity-100' : '-translate-x-6 opacity-0'
                    }`}
                  >
                    {division.name}
                  </div>
                )}
              </div>

              {/* Tournament Details */}
              <div 
                className={`flex flex-wrap items-center gap-6 ${styles.info} transition-all duration-700 delay-400 transform ${
                  isVisible ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                }`}
              >
                {tournament.date && (
                  <div className="flex items-center gap-2 font-jetbrains">
                    <Calendar className="w-5 h-5" />
                    <span>{formatDate(tournament.date)}</span>
                  </div>
                )}
                
                {tournament.venue && (
                  <div className="flex items-center gap-2 font-jetbrains">
                    <MapPin className="w-5 h-5" />
                    <span>{tournament.venue}</span>
                  </div>
                )}
                
                {tournament.rounds && (
                  <div className="flex items-center gap-2 font-jetbrains">
                    <Trophy className="w-5 h-5" />
                    <span>{tournament.rounds} Rounds</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Status & Round Info */}
            <div 
              className={`flex flex-col items-end gap-4 transition-all duration-700 delay-500 transform ${
                isVisible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
              }`}
            >
              {/* Tournament Status */}
              <div className="flex items-center gap-3 px-4 py-2 bg-black/30 backdrop-blur-sm rounded-lg border border-white/20">
                {getStatusIcon()}
                <span className={`${styles.info} font-jetbrains font-medium`}>
                  {getStatusText()}
                </span>
              </div>

              {/* Current Round (if active) */}
              {tournament.status === 'active' && tournament.current_round && (
                <div className="flex items-center gap-3 px-4 py-2 bg-green-500/20 backdrop-blur-sm rounded-lg border border-green-500/50">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  <span className={`${styles.info} font-jetbrains font-bold text-green-300`}>
                    Round {tournament.current_round}
                  </span>
                </div>
              )}

              {/* Live Indicator for Projector Mode */}
              {variant === 'projector' && (
                <div className="flex items-center gap-3 px-6 py-3 bg-red-500/20 backdrop-blur-sm rounded-lg border border-red-500/50">
                  <div className="w-4 h-4 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-2xl font-jetbrains font-bold text-red-300">
                    LIVE
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Optional Banner Image Placeholder */}
          {/* This could be enhanced later to support actual image uploads */}
          <div className="mt-6 opacity-0 animate-pulse">
            {/* Reserved space for future banner image functionality */}
          </div>
        </div>
      </div>

      {/* Bottom Neon Border */}
      <div className={`h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 ${styles.neonBorder}`} />
      
      {/* Animated Glow Effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 animate-pulse" />
      </div>
    </div>
  );
};

export default TournamentHeader;