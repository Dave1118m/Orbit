import React from 'react';

/**
 * Ambient Glow Background Section Container
 * 
 * Provides clean backdrop styling, glow lighting effects, and structure
 * without background dot matrix noise.
 */
export default function DotBackground({
  variant = 'hero', // 'hero' | 'light' | 'dark' | 'cyan'
  className = '',
  children,
  showGlow = true
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* ── Ambient Glowing Colored Orbs ── */}
      {showGlow && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          {variant === 'hero' && (
            <>
              {/* Primary Top Center Violet/Indigo Orb */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[450px] bg-gradient-to-r from-violet-400/25 via-indigo-400/25 to-cyan-300/25 blur-3xl rounded-full animate-glow-drift" />
              {/* Top Left Indigo Orb */}
              <div className="absolute top-10 -left-20 w-[420px] h-[420px] bg-gradient-to-tr from-indigo-500/20 to-purple-400/20 blur-3xl rounded-full" />
              {/* Top Right Cyan Orb */}
              <div className="absolute top-16 -right-20 w-[460px] h-[460px] bg-gradient-to-bl from-cyan-400/25 to-blue-500/20 blur-3xl rounded-full" />
            </>
          )}

          {variant === 'dark' && (
            <>
              {/* Neon Cyan & Indigo Glows */}
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-violet-600/25 blur-3xl rounded-full animate-pulse-slow" />
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/20 blur-3xl rounded-full animate-pulse-slow" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/10 blur-3xl rounded-full" />
            </>
          )}

          {variant === 'cyan' && (
            <>
              <div className="absolute -top-20 left-1/3 w-[500px] h-[300px] bg-cyan-500/20 blur-3xl rounded-full" />
              <div className="absolute -bottom-20 right-1/4 w-[450px] h-[300px] bg-teal-400/15 blur-3xl rounded-full" />
            </>
          )}

          {variant === 'light' && (
            <>
              <div className="absolute top-0 right-1/4 w-[450px] h-[350px] bg-indigo-100/70 blur-3xl rounded-full" />
              <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-cyan-100/60 blur-3xl rounded-full" />
            </>
          )}
        </div>
      )}

      {/* ── Content Layer ── */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
