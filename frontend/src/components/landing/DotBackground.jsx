import React, { useEffect, useRef, useCallback } from 'react';

/**
 * Interactive Particle Dot Matrix Canvas
 * 
 * - Clearly visible high-contrast dots on a grid
 * - Instant render on mount
 * - Subtle micro-shift physics on hover (gentle small displacement in all directions)
 * - Fluid spring return to grid coordinates
 * - Scaling & neon glow on hover interaction
 * - Hardware accelerated with Retina DPR support
 */
export default function DotBackground({
  variant = 'hero', // 'hero' | 'light' | 'dark' | 'cyan'
  className = '',
  children,
  showGlow = true,
  interactive = true,
  scatter = true,
  density = 'normal', // 'dense' (22px) | 'normal' (28px) | 'spacious' (36px)
  mask = 'radial', // 'radial' | 'linear-b' | 'none'
  repelRadius = 75, // Localized gentle radius in pixels (default: 75)
  repelStrength = 3.5 // Subtle micro-shift force (default: 3.5)
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999, isHovered: false });
  const animFrameRef = useRef(null);

  // Spacing based on density setting
  const getSpacing = useCallback(() => {
    if (density === 'dense') return 22;
    if (density === 'spacious') return 36;
    return 28; // normal
  }, [density]);

  // Color config based on theme variant
  const getColors = useCallback(() => {
    if (variant === 'dark') {
      return {
        base: 'rgba(226, 232, 240, 0.45)', // crisp light slate dots
        active: 'rgba(56, 189, 248, 1)', // bright cyan
        activeGlow: 'rgba(56, 189, 248, 0.8)',
        baseRadius: 1.65,
        activeRadius: 2.4
      };
    }
    if (variant === 'cyan') {
      return {
        base: 'rgba(6, 182, 212, 0.5)',
        active: 'rgba(14, 165, 233, 1)',
        activeGlow: 'rgba(6, 182, 212, 0.9)',
        baseRadius: 1.7,
        activeRadius: 2.5
      };
    }
    if (variant === 'hero') {
      return {
        base: 'rgba(99, 102, 241, 0.48)', // strong visible indigo
        active: 'rgba(129, 140, 248, 1)', // bright indigo/violet
        activeGlow: 'rgba(6, 182, 212, 0.85)', // cyan halo
        baseRadius: 1.75,
        activeRadius: 2.6
      };
    }
    // light / minimal
    return {
      base: 'rgba(99, 102, 241, 0.42)',
      active: 'rgba(67, 56, 202, 1)',
      activeGlow: 'rgba(99, 102, 241, 0.7)',
      baseRadius: 1.6,
      activeRadius: 2.3
    };
  }, [variant]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let isRunning = true;
    const colors = getColors();
    const spacing = getSpacing();

    // Resize and initialize particles
    const resizeCanvas = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Create regular grid
      const cols = Math.floor(width / spacing) + 2;
      const rows = Math.floor(height / spacing) + 2;
      const offsetX = (width - (cols - 1) * spacing) / 2;
      const offsetY = (height - (rows - 1) * spacing) / 2;

      const newParticles = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const originX = offsetX + c * spacing;
          const originY = offsetY + r * spacing;
          newParticles.push({
            originX,
            originY,
            x: originX,
            y: originY,
            vx: 0,
            vy: 0,
            baseRadius: colors.baseRadius,
            activeRadius: colors.activeRadius
          });
        }
      }
      particlesRef.current = newParticles;
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    // Micro-shift Physics Animation Loop
    const springStrength = 0.14; // snappy, smooth return
    const damping = 0.78; // clean settlement
    const maxDisplacement = 7; // Cap shift to maximum 7px in any direction

    const render = () => {
      if (!isRunning) return;

      const ctx = canvas.getContext('2d');
      const width = container.clientWidth;
      const height = container.clientHeight;

      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Gentle small shift physics on mouse hover
        if (scatter && mouse.isHovered) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          const rSq = repelRadius * repelRadius;

          if (distSq < rSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            // Subtle, smooth push curve
            const ratio = (repelRadius - dist) / repelRadius;
            const force = ratio * ratio * repelStrength;
            const angle = Math.atan2(dy, dx);

            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
          }
        }

        // Spring pulling back to natural origin
        const springX = (p.originX - p.x) * springStrength;
        const springY = (p.originY - p.y) * springStrength;

        p.vx = (p.vx + springX) * damping;
        p.vy = (p.vy + springY) * damping;

        p.x += p.vx;
        p.y += p.vy;

        // Clamp maximum displacement to ensure small subtle shift only
        const dispX = p.x - p.originX;
        const dispY = p.y - p.originY;
        const disp = Math.sqrt(dispX * dispX + dispY * dispY);
        if (disp > maxDisplacement) {
          const clampAngle = Math.atan2(dispY, dispX);
          p.x = p.originX + Math.cos(clampAngle) * maxDisplacement;
          p.y = p.originY + Math.sin(clampAngle) * maxDisplacement;
        }

        // Intensity for subtle radius & color highlight
        const intensity = Math.min(disp / maxDisplacement, 1);
        const radius = p.baseRadius + (p.activeRadius - p.baseRadius) * intensity;

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

        if (intensity > 0.15) {
          ctx.fillStyle = colors.active;
          ctx.shadowColor = colors.activeGlow;
          ctx.shadowBlur = 6 * intensity;
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        } else {
          ctx.fillStyle = colors.base;
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [variant, density, repelRadius, repelStrength, scatter, getColors, getSpacing]);

  // Event handlers
  const handleMouseMove = (e) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      isHovered: true
    };
  };

  const handleMouseEnter = (e) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      isHovered: true
    };
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    mouseRef.current.isHovered = false;
    mouseRef.current.x = -9999;
    mouseRef.current.y = -9999;
  };

  const handleTouchMove = (e) => {
    if (!interactive || !containerRef.current || !e.touches[0]) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top,
      isHovered: true
    };
  };

  const handleTouchEnd = () => {
    mouseRef.current.isHovered = false;
    mouseRef.current.x = -9999;
    mouseRef.current.y = -9999;
  };

  const getMaskStyle = () => {
    if (mask === 'radial') {
      return {
        maskImage: 'radial-gradient(ellipse 90% 80% at 50% 35%, black 60%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 35%, black 60%, transparent 100%)'
      };
    }
    if (mask === 'linear-b') {
      return {
        maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
      };
    }
    return {};
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-hidden ${className}`}
    >
      {/* ── Ambient Glowing Colored Orbs Behind Dots ── */}
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

      {/* ── Interactive HTML5 Particle Canvas ── */}
      <canvas
        ref={canvasRef}
        style={getMaskStyle()}
        className="pointer-events-none absolute inset-0 z-0 block w-full h-full"
      />

      {/* ── Content Layer ── */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
