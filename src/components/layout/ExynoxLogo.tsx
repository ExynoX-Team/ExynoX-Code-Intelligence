import { useState } from 'react';

interface ExynoxLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ExynoxLogo({ className = '', size = 'md' }: ExynoxLogoProps) {
  const [imageError, setImageError] = useState(false);

  // Dimension mappings
  const dimensions = {
    sm: { box: 'w-6 h-6', text: 'text-xs' },
    md: { box: 'w-8 h-8', text: 'text-sm' },
    lg: { box: 'w-10 h-10', text: 'text-base' }
  };

  const dim = dimensions[size] || dimensions.md;

  if (imageError) {
    // High-precision vector emblem representing AST code trees + ExynoX neural nexus
    return (
      <div 
        id="exynox-brand-mark"
        className={`inline-flex items-center justify-center shrink-0 ${dim.box} rounded-lg bg-gradient-to-br from-cyan-950 via-[#0d1627] to-blue-950 border border-cyan-500/40 shadow-sm shadow-cyan-950/40 text-cyan-400 ${className}`}
        title="ExynoX Code Intelligence"
      >
        <svg 
          viewBox="0 0 32 32" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-4/5 h-4/5"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="exynoxGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="exynoxGlow" x1="16" y1="8" x2="16" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          {/* Left code angle / bracket arm */}
          <path 
            d="M8 8L16 16L8 24" 
            stroke="url(#exynoxGrad)" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          {/* Right code angle / bracket arm */}
          <path 
            d="M24 8L16 16L24 24" 
            stroke="url(#exynoxGrad)" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          {/* Central AST nexus node */}
          <circle cx="16" cy="16" r="2.5" fill="#e0f2fe" />
          <circle cx="16" cy="16" r="4.5" stroke="url(#exynoxGlow)" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src="/exynox-logo.png"
      alt="ExynoX Logo"
      className={`${dim.box} object-contain transition-opacity ${className}`}
      onError={() => setImageError(true)}
    />
  );
}
