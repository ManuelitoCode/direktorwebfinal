import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface ButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'blue' | 'green';
  className?: string;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  icon: Icon, 
  label, 
  onClick, 
  variant = 'blue',
  className = '',
  disabled = false
}) => {
  const glowClass = variant === 'blue' ? 'neon-glow' : 'neon-glow-green';
  const borderColor = variant === 'blue' ? 'border-blue-500' : 'border-green-500';
  const textColor = variant === 'blue' ? 'text-blue-400' : 'text-green-400';
  const hoverBg = variant === 'blue' ? 'hover:bg-blue-500/10' : 'hover:bg-green-500/10';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${!disabled ? glowClass : ''}
        ${borderColor}
        ${textColor}
        ${!disabled ? hoverBg : ''}
        group relative overflow-hidden
        border-2 bg-gray-900/50 backdrop-blur-sm
        px-8 py-6 rounded-xl
        font-semibold text-lg tracking-wide
        transition-all duration-300 ease-out
        ${!disabled ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'}
        flex items-center justify-center gap-4
        min-h-[80px] w-full
        ${className}
      `}
    >
      {!disabled && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
      )}
      
      <Icon size={28} className="relative z-10" />
      <span className="relative z-10 font-orbitron">{label}</span>
    </button>
  );
};

export default Button;