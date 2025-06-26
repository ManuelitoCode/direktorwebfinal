import React from 'react';
import ParticleBackground from '../ParticleBackground';

interface LayoutWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  headerActions?: React.ReactNode;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({
  children,
  title,
  subtitle,
  showBackButton = false,
  onBack,
  headerActions
}) => {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 max-w-6xl mx-auto">
          {/* Navigation */}
          {(showBackButton || headerActions) && (
            <div className="flex items-center justify-between mb-6">
              {showBackButton && onBack ? (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <span className="font-jetbrains">← Back to Dashboard</span>
                </button>
              ) : (
                <div />
              )}
              
              {headerActions && (
                <div className="flex items-center gap-4">
                  {headerActions}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <h1 
            className="glitch-text fade-up text-4xl md:text-6xl font-bold mb-4 text-white font-orbitron tracking-wider"
            data-text={title}
            style={{
              textShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)'
            }}
          >
            {title}
          </h1>
          
          {subtitle && (
            <p className="fade-up fade-up-delay-1 text-xl md:text-2xl text-cyan-400 mb-4 font-medium font-jetbrains">
              {subtitle}
            </p>
          )}
          
          <div className="fade-up fade-up-delay-2 w-24 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"></div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-6xl mx-auto w-full">
          {children}
        </div>

        {/* Footer */}
        <footer className="fade-up text-center mt-12">
          <p className="text-gray-500 text-sm font-light tracking-wider">
            Your personal tournament management hub
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
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

export default LayoutWrapper;