import React, { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
  phase: number;
  depth: number;
};

export default function CoffeeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const mobileViewport = window.matchMedia('(max-width: 767px)').matches;
    if (!canvas || mobileViewport) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles: Particle[] = [];
    let animationFrame = 0;
    let scrollEnergy = 0;
    let scrollDirection = 1;
    let previousScrollY = window.scrollY;
    const pointer = { x: -1000, y: -1000, active: false };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const createParticles = () => {
      const count = Math.min(72, Math.floor(width / 22));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.45 + Math.random() * 1.35,
        vx: (Math.random() - 0.5) * 0.16,
        vy: -0.08 - Math.random() * 0.24,
        alpha: 0.16 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        depth: 0.35 + Math.random() * 1.15,
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      createParticles();
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    const addScrollEnergy = (delta: number) => {
      if (Math.abs(delta) < 1) return;
      scrollDirection = delta > 0 ? -1 : 1;
      scrollEnergy = Math.min(7, scrollEnergy + Math.abs(delta) * 0.018);
    };

    const handleWheel = (event: WheelEvent) => addScrollEnergy(event.deltaY);

    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      addScrollEnergy(nextScrollY - previousScrollY);
      previousScrollY = nextScrollY;
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';

      particles.forEach((particle) => {
        const drift = Math.sin(time * 0.00035 + particle.phase) * 0.12;
        const scrollDrift = reducedMotion ? 0 : scrollDirection * scrollEnergy * particle.depth;

        particle.x += particle.vx + drift;
        particle.y += particle.vy + scrollDrift;

        let pointerGlow = 0;
        if (pointer.active) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 170 && distance > 0) {
            const force = (170 - distance) / 170;
            particle.x += (dx / distance) * force * 1.4;
            particle.y += (dy / distance) * force * 1.4;
            pointerGlow = force;

            if (distance < 105) {
              context.beginPath();
              context.moveTo(particle.x, particle.y);
              context.lineTo(pointer.x, pointer.y);
              context.strokeStyle = `rgba(238, 187, 126, ${force * 0.07})`;
              context.lineWidth = 0.5;
              context.stroke();
            }
          }
        }

        if (particle.y < -24) particle.y = height + 24;
        if (particle.y > height + 24) particle.y = -24;
        if (particle.x < -24) particle.x = width + 24;
        if (particle.x > width + 24) particle.x = -24;

        const energyGlow = Math.min(0.36, scrollEnergy * 0.045);
        const alpha = Math.min(0.85, particle.alpha + energyGlow + pointerGlow * 0.22);
        const streak = Math.min(18, scrollEnergy * particle.depth * 2.8);

        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(particle.x, particle.y + scrollDirection * streak);
        context.strokeStyle = `rgba(238, 187, 126, ${alpha * 0.62})`;
        context.lineWidth = Math.max(0.6, particle.radius * 0.7);
        context.stroke();

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius + pointerGlow * 1.4, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 221, 178, ${alpha})`;
        context.fill();
      });

      scrollEnergy *= 0.92;
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[45] opacity-70"
    />
  );
}
