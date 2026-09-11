import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Particle {
  id: number;
  x: number; // random starting x offset
  y: number; // starting y offset
  targetX: number; // where it drifts to
  targetY: number; // fall depth
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'triangle' | 'streamer';
  delay: number;
  duration: number;
  rotateSpeed: number;
  twistSpeed: number;
}

interface CelebrateConfettiProps {
  active: boolean;
  onComplete: () => void;
}

// Moçambique themed colors & high contrast vibrant shades
const CONFETTI_COLORS = [
  '#009739', // Emblematic Moçambique Emerald Green
  '#fce100', // Neon Sun Yellow
  '#d21034', // Red Accent
  '#ffffff', // White
  '#22d3ee', // Ice Cyan
  '#d946ef', // Hot Pink
  '#3b82f6', // Vibrant Blue
  '#a855f7', // Mystic Purple
];

const SHAPES: ('circle' | 'square' | 'triangle' | 'streamer')[] = ['circle', 'square', 'triangle', 'streamer'];

export const CelebrateConfetti: React.FC<CelebrateConfettiProps> = ({ active, onComplete }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    // Generate 120 celebratory fluttering particles shooting from sides and center
    const newParticles: Particle[] = Array.from({ length: 120 }).map((_, idx) => {
      const isLeft = idx % 3 === 0;
      const isRight = idx % 3 === 1;

      // Starting positions (either bottom-left, bottom-right, or bottom-center)
      let startX = 50; // default middle percentage
      if (isLeft) startX = Math.random() * 15;
      else if (isRight) startX = 85 + Math.random() * 15;
      else startX = 30 + Math.random() * 40;

      // Trajectory dispersion
      const targetX = startX + (Math.random() * 40 - 20) + (isLeft ? 25 : isRight ? -25 : 0);
      const targetY = 110; // fall past bottom of viewport
      
      return {
        id: idx,
        x: startX,
        y: 105, // start slightly below the viewport
        targetX,
        targetY,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 10 + 6, // 6px to 16px
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        delay: Math.random() * 0.4, // micro-staggered birth times
        duration: Math.random() * 2.5 + 2.0, // 2 to 4.5 seconds fall time
        rotateSpeed: Math.random() * 360 * 3 + 360, // multiple complete spins
        twistSpeed: Math.random() * 360 * 2 + 180,
      };
    });

    setParticles(newParticles);

    // Auto-teardown after full cascade completes to free resources
    const timer = setTimeout(() => {
      onComplete();
    }, 5500);

    return () => clearTimeout(timer);
  }, [active, onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <AnimatePresence>
        {active && particles.map((p) => {
          // Render specific svg/element depending on shape
          const renderShape = () => {
            switch (p.shape) {
              case 'circle':
                return (
                  <div 
                    className="rounded-full w-full h-full" 
                    style={{ backgroundColor: p.color }}
                  />
                );
              case 'triangle':
                return (
                  <div 
                    className="w-0 h-0 border-l-transparent border-r-transparent" 
                    style={{
                      borderLeftWidth: `${p.size / 2}px`,
                      borderRightWidth: `${p.size / 2}px`,
                      borderBottomWidth: `${p.size}px`,
                      borderBottomColor: p.color,
                    }}
                  />
                );
              case 'streamer':
                return (
                  <div 
                    className="rounded" 
                    style={{ 
                      backgroundColor: p.color, 
                      width: `${p.size * 1.8}px`, 
                      height: `${p.size * 0.4}px` 
                    }}
                  />
                );
              case 'square':
              default:
                return (
                  <div 
                    style={{ 
                      backgroundColor: p.color, 
                      width: '100%', 
                      height: '100%' 
                    }}
                  />
                );
            }
          };

          return (
            <motion.div
              key={p.id}
              className="absolute pointer-events-none"
              initial={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                opacity: 0.9,
                scale: 0.4,
                rotateX: 0,
                rotateY: 0,
                rotateZ: 0,
              }}
              animate={{
                left: [`${p.x}%`, `${p.targetX}%`],
                top: ['105%', '-15%', `${p.targetY}%`], // shoots up then descends gracefully
                opacity: [0.9, 1, 1, 0.4, 0],
                scale: [0.5, 1.2, 1, 0.9, 0.5],
                rotateX: p.twistSpeed,
                rotateY: p.rotateSpeed,
                rotateZ: p.rotateSpeed * 1.5,
              }}
              transition={{
                duration: p.duration,
                ease: 'easeOut',
                delay: p.delay,
              }}
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
              }}
            >
              {renderShape()}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
