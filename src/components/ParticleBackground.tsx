import React, { useEffect, useRef } from 'react';

const ParticleBackground: React.FC = () => {
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;

    // Clear existing particles
    container.innerHTML = '';

    // Create particles
    const particleCount = window.innerWidth > 768 ? 50 : 30;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (Math.random() * 4 + 6) + 's';
      container.appendChild(particle);
    }
  }, []);

  return <div ref={particlesRef} className="particles" />;
};

export default ParticleBackground;