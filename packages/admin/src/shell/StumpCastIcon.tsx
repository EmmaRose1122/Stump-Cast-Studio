import React from 'react';

export const StumpCastIcon: React.FC<{ className?: string }> = ({ className = 'size-8' }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sc-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B1E45" />
          <stop offset="50%" stopColor="#081430" />
          <stop offset="100%" stopColor="#030814" />
        </linearGradient>
        <linearGradient id="sc-stump" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="40%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="sc-bail" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="sc-ball" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="60%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <filter id="sc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Modern squircle studio badge in Navy with Royal Blue border */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="url(#sc-bg)"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeOpacity="0.8"
      />

      {/* Broadcast radar arcs */}
      <path
        d="M 12 14 A 18 18 0 0 1 36 14"
        stroke="#60A5FA"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 3"
        opacity="0.7"
      />
      <path
        d="M 16 18 A 12 12 0 0 1 32 18"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Three cricket stumps (bold Royal Blue) */}
      <rect x="15" y="21" width="3.5" height="18" rx="1.5" fill="url(#sc-stump)" />
      <rect x="22.25" y="19" width="3.5" height="20" rx="1.5" fill="url(#sc-stump)" />
      <rect x="29.5" y="21" width="3.5" height="18" rx="1.5" fill="url(#sc-stump)" />

      {/* Cross bails atop the stumps (Pure White) */}
      <rect x="13.5" y="18.5" width="10" height="2" rx="1" fill="url(#sc-bail)" filter="url(#sc-glow)" />
      <rect x="24.5" y="18.5" width="10" height="2" rx="1" fill="url(#sc-bail)" filter="url(#sc-glow)" />

      {/* Glowing dynamic cricket ball with seam (Vivid Crimson Red) */}
      <circle cx="34" cy="14" r="4.5" fill="url(#sc-ball)" filter="url(#sc-glow)" />
      <path
        d="M 31.5 12.5 C 33 14, 35 14, 36.5 15.5"
        stroke="#FFFFFF"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <circle cx="35" cy="12.5" r="1" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
};
