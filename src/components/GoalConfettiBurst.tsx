import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface GoalConfettiBurstProps {
  active: boolean;
  targetCount: number;
}

interface ParticleSpec {
  id: number;
  dx: string;
  dy: string;
  rotate: string;
  color: string;
  shape: 'circle' | 'rect' | 'diamond';
}

const CONFETTI_PARTICLES: ParticleSpec[] = [
  { id: 1, dx: '-64px', dy: '-48px', rotate: '-140deg', color: '#059669', shape: 'rect' },
  { id: 2, dx: '-42px', dy: '-62px', rotate: '95deg', color: '#0284C7', shape: 'circle' },
  { id: 3, dx: '-18px', dy: '-68px', rotate: '180deg', color: '#D97706', shape: 'diamond' },
  { id: 4, dx: '14px', dy: '-64px', rotate: '-90deg', color: '#059669', shape: 'rect' },
  { id: 5, dx: '40px', dy: '-56px', rotate: '130deg', color: '#0EA5E9', shape: 'circle' },
  { id: 6, dx: '62px', dy: '-42px', rotate: '210deg', color: '#EAB308', shape: 'diamond' },
  { id: 7, dx: '-72px', dy: '-14px', rotate: '-75deg', color: '#0284C7', shape: 'circle' },
  { id: 8, dx: '74px', dy: '-12px', rotate: '115deg', color: '#059669', shape: 'rect' },
  { id: 9, dx: '-54px', dy: '28px', rotate: '160deg', color: '#EAB308', shape: 'diamond' },
  { id: 10, dx: '-26px', dy: '42px', rotate: '-120deg', color: '#059669', shape: 'circle' },
  { id: 11, dx: '28px', dy: '40px', rotate: '85deg', color: '#0284C7', shape: 'rect' },
  { id: 12, dx: '56px', dy: '26px', rotate: '-150deg', color: '#D97706', shape: 'circle' },
  { id: 13, dx: '-10px', dy: '-50px', rotate: '45deg', color: '#10B981', shape: 'rect' },
  { id: 14, dx: '32px', dy: '-38px', rotate: '-60deg', color: '#0284C7', shape: 'diamond' },
];

export const GoalConfettiBurst: React.FC<GoalConfettiBurstProps> = ({
  active,
  targetCount,
}) => {
  if (!active) return null;

  return (
    <>
      {/* 1. Local micro-confetti around the status bar circular gauge */}
      <div
        data-testid="goal-confetti-burst"
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible z-30"
      >
        {CONFETTI_PARTICLES.map((p) => (
          <span
            key={p.id}
            style={
              {
                backgroundColor: p.color,
                '--tx': p.dx,
                '--ty': p.dy,
                '--rot': p.rotate,
              } as React.CSSProperties
            }
            className={`absolute animate-confetti-particle ${
              p.shape === 'circle'
                ? 'w-2 h-2 rounded-full'
                : p.shape === 'diamond'
                ? 'w-2 h-2 rotate-45 rounded-[1px]'
                : 'w-2.5 h-1.5 rounded-[1px]'
            }`}
          />
        ))}
      </div>

      {/* 2. Fixed top-center viewport celebration pill & confetti burst */}
      <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center">
        {CONFETTI_PARTICLES.map((p) => (
          <span
            key={`fixed-${p.id}`}
            style={
              {
                backgroundColor: p.color,
                '--tx': p.dx,
                '--ty': p.dy,
                '--rot': p.rotate,
              } as React.CSSProperties
            }
            className={`absolute animate-confetti-particle ${
              p.shape === 'circle'
                ? 'w-2.5 h-2.5 rounded-full'
                : p.shape === 'diamond'
                ? 'w-2.5 h-2.5 rotate-45 rounded-[1px]'
                : 'w-3 h-2 rounded-[1px]'
            }`}
          />
        ))}
        <div className="animate-confetti-badge whitespace-nowrap bg-emerald-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>今日學習目標達成！已完成 {targetCount} 張 SRS 記憶卡</span>
        </div>
      </div>
    </>
  );
};
