import React from 'react';

interface SoutoLogoProps {
  className?: string;
  variant?: 'full' | 'horizontal' | 'icon' | 'mark-only';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  lightMode?: boolean; // If true, optimized for dark backgrounds (white text)
}

export const SoutoLogo: React.FC<SoutoLogoProps> = ({
  className = '',
  variant = 'horizontal',
  size = 'md',
  lightMode = false,
}) => {
  // Dimension presets
  const iconSizes = {
    xs: 20,
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  };

  const currentIconSize = iconSizes[size] || iconSizes.md;

  // The stylized connected "SD" vector mark matching the attached image
  const MarkSvg = ({ size: s = currentIconSize }: { size?: number }) => (
    <svg
      width={s}
      height={s}
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-xs"
    >
      <defs>
        {/* Exact gradient from attached image: Electric Azure -> Royal Blue -> Midnight Navy */}
        <linearGradient id="soutoEmblemGrad" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#008fe2" />
          <stop offset="42%" stopColor="#1d4ed8" />
          <stop offset="85%" stopColor="#153268" />
          <stop offset="100%" stopColor="#0f224a" />
        </linearGradient>
        <linearGradient id="soutoTopCurve" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#00a3ff" />
          <stop offset="60%" stopColor="#008fe2" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="soutoBottomCurve" x1="0%" y1="50%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="70%" stopColor="#153268" />
          <stop offset="100%" stopColor="#0f224a" />
        </linearGradient>
        {/* Subtle shadow on the lower loop */}
        <filter id="sdShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f224a" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Outer D Ribbon Loop (Right Arc) */}
      <path
        d="M 52 20 
           L 78 20 
           C 96 20, 110 32, 110 50 
           C 110 68, 96 80, 78 80 
           L 58 80 
           L 68 66 
           L 76 66 
           C 87 66, 94 59, 94 50 
           C 94 41, 87 34, 76 34 
           L 62 34 
           Z"
        fill="url(#soutoEmblemGrad)"
        filter="url(#sdShadow)"
      />

      {/* S Ribbon Loop (Left swooping ribbon with inner fold and diagonal bevel) */}
      <path
        d="M 38 20 
           L 72 20 
           L 64 34 
           L 36 34 
           C 25 34, 20 40, 20 48 
           C 20 56, 26 62, 38 62 
           L 62 62 
           L 52 76 
           L 18 76 
           L 30 62 
           C 14 60, 6 49, 6 38 
           C 6 26, 19 20, 38 20 
           Z"
        fill="url(#soutoTopCurve)"
      />

      {/* S Lower Foot (Angled parallel block) */}
      <path
        d="M 30 62 
           L 66 62 
           C 58 74, 52 78, 42 78 
           L 10 78 
           L 24 62 
           Z"
        fill="url(#soutoBottomCurve)"
      />
    </svg>
  );

  if (variant === 'icon' || variant === 'mark-only') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <MarkSvg />
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <MarkSvg size={currentIconSize} />
        <div className="flex flex-col text-left">
          <span
            className={`font-black leading-none tracking-tight ${
              lightMode ? 'text-white' : 'text-[#153268]'
            } ${
              size === 'xs'
                ? 'text-xs'
                : size === 'sm'
                ? 'text-sm'
                : size === 'md'
                ? 'text-base'
                : size === 'lg'
                ? 'text-xl'
                : 'text-2xl'
            }`}
          >
            souto
          </span>
          <span
            className={`font-bold uppercase leading-none tracking-widest ${
              lightMode ? 'text-sky-300' : 'text-[#0f224a]'
            } ${
              size === 'xs'
                ? 'text-[5px]'
                : size === 'sm'
                ? 'text-[6px]'
                : size === 'md'
                ? 'text-[7.5px]'
                : size === 'lg'
                ? 'text-[9px]'
                : 'text-[11px]'
            }`}
          >
            DIGITAL SERVIÇOS
          </span>
        </div>
      </div>
    );
  }

  // Full Stacked Logo (Centered or Drawer Hero)
  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      <MarkSvg size={currentIconSize * 1.5} />
      <span
        className={`font-black tracking-tight mt-1 leading-none ${
          lightMode ? 'text-white' : 'text-[#153268]'
        } ${
          size === 'xs'
            ? 'text-sm'
            : size === 'sm'
            ? 'text-lg'
            : size === 'md'
            ? 'text-2xl'
            : size === 'lg'
            ? 'text-3xl'
            : 'text-4xl'
        }`}
      >
        souto
      </span>
      <span
        className={`font-bold uppercase tracking-widest mt-0.5 leading-none ${
          lightMode ? 'text-sky-300' : 'text-[#0f224a]'
        } ${
          size === 'xs'
            ? 'text-[6px]'
            : size === 'sm'
            ? 'text-[8px]'
            : size === 'md'
            ? 'text-[10px]'
            : size === 'lg'
            ? 'text-[12px]'
            : 'text-[14px]'
        }`}
      >
        DIGITAL SERVIÇOS
      </span>
    </div>
  );
};
