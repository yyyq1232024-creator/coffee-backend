import { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; radius: number; vx: number; vy: number; alpha: number; phase: number; depth: number };
type TrailPoint = { x: number; y: number; life: number };

const SLIDE_PALETTES = [
  [238, 187, 126], [157, 205, 210], [174, 202, 180], [218, 174, 121],
  [194, 211, 201], [231, 179, 112], [199, 193, 205], [210, 177, 139],
] as const;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const smoothstep = (start: number, end: number, value: number) => {
  const progress = clamp((value - start) / (end - start), 0, 1);
  return progress * progress * (3 - 2 * progress);
};

export default function CoffeeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const mobileViewport = window.matchMedia('(max-width: 767px)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canvas || mobileViewport || reducedMotion) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles: Particle[] = [];
    let trail: TrailPoint[] = [];
    let animationFrame = 0;
    let lastFrameTime = 0;
    let scrollEnergy = 0;
    let scrollDirection = 1;
    let previousScrollY = window.scrollY;
    let running = true;
    let currentColor = [...SLIDE_PALETTES[0]] as [number, number, number];
    let previousGather = 0;
    const pointer = { x: -1000, y: -1000, previousX: -1000, previousY: -1000, speed: 0, active: false };

    const createParticles = () => {
      const count = Math.min(74, Math.max(44, Math.floor(width / 23)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        radius: 0.45 + Math.random() * 1.35,
        vx: (Math.random() - 0.5) * 0.14, vy: -0.07 - Math.random() * 0.2,
        alpha: 0.15 + Math.random() * 0.45, phase: Math.random() * Math.PI * 2,
        depth: 0.35 + Math.random() * 1.1,
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
      pointer.previousX = pointer.x; pointer.previousY = pointer.y;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true;
      if (pointer.previousX > -500) {
        pointer.speed = Math.hypot(pointer.x - pointer.previousX, pointer.y - pointer.previousY);
        if (pointer.speed > 3.2) {
          trail.push({ x: pointer.x, y: pointer.y, life: 1 });
          if (trail.length > 14) trail.shift();
        }
      }
    };
    const handlePointerLeave = () => { pointer.active = false; pointer.speed = 0; };
    const addScrollEnergy = (delta: number) => {
      if (Math.abs(delta) < 1) return;
      scrollDirection = delta > 0 ? -1 : 1;
      scrollEnergy = Math.min(6, scrollEnergy + Math.abs(delta) * 0.015);
    };
    const handleWheel = (event: WheelEvent) => addScrollEnergy(event.deltaY);
    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      addScrollEnergy(nextScrollY - previousScrollY);
      previousScrollY = nextScrollY;
    };

    const getCupTarget = (index: number, total: number, centerY: number) => {
      const ratio = index / total;
      const centerX = width * 0.5;
      const scale = clamp(width / 1400, 0.75, 1.08);
      if (ratio < 0.64) {
        const angle = (ratio / 0.64) * Math.PI * 2;
        return { x: centerX + Math.cos(angle) * 118 * scale, y: centerY + Math.sin(angle) * 54 * scale };
      }
      if (ratio < 0.78) {
        const angle = -Math.PI * 0.48 + ((ratio - 0.64) / 0.14) * Math.PI * 0.96;
        return { x: centerX + 116 * scale + Math.cos(angle) * 36 * scale, y: centerY + Math.sin(angle) * 34 * scale };
      }
      const steamRatio = (ratio - 0.78) / 0.22;
      const lane = index % 3;
      return {
        x: centerX + (lane - 1) * 38 * scale + Math.sin(steamRatio * Math.PI * 2 + lane) * 9,
        y: centerY - 76 * scale - steamRatio * 92 * scale,
      };
    };

    const updateTransition = () => {
      const anchor = document.querySelector<HTMLElement>('[data-philosophy-anchor]');
      if (!anchor) return { gather: 0, centerY: height * 0.52 };
      const bounds = anchor.getBoundingClientRect();
      const progress = clamp((height * 1.02 - bounds.top) / (height * 0.84), 0, 1);
      const gather = smoothstep(0.05, 0.5, progress) * (1 - smoothstep(0.66, 1, progress));
      anchor.style.setProperty('--aroma-gather', gather.toFixed(3));
      anchor.style.setProperty('--aroma-progress', progress.toFixed(3));
      return { gather, centerY: clamp(bounds.top + bounds.height * 0.3, height * 0.34, height * 0.63) };
    };

    const drawTrail = (red: number, green: number, blue: number) => {
      if (trail.length >= 2) {
        context.beginPath(); context.moveTo(trail[0].x, trail[0].y);
        trail.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${Math.min(0.24, pointer.speed * 0.008)})`;
        context.lineWidth = 1.1; context.stroke();
      }
      trail = trail.map((point) => ({ ...point, life: point.life - 0.075 })).filter((point) => point.life > 0);
    };

    const draw = (time: number) => {
      if (!running) return;
      animationFrame = window.requestAnimationFrame(draw);
      if (time - lastFrameTime < 22) return;
      lastFrameTime = time;
      const home = canvas.closest<HTMLElement>('.coffee-home');
      const slideIndex = Number(home?.dataset.heroSlide || 0) % SLIDE_PALETTES.length;
      const targetColor = SLIDE_PALETTES[slideIndex] || SLIDE_PALETTES[0];
      currentColor = currentColor.map((channel, index) => channel + (targetColor[index] - channel) * 0.035) as [number, number, number];
      const [red, green, blue] = currentColor.map(Math.round);
      const { gather, centerY } = updateTransition();
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      drawTrail(red, green, blue);

      particles.forEach((particle, index) => {
        const drift = Math.sin(time * 0.0003 + particle.phase) * 0.1;
        particle.x += particle.vx + drift;
        particle.y += particle.vy + scrollDirection * scrollEnergy * particle.depth;
        let pointerGlow = 0;
        if (pointer.active && gather < 0.6) {
          const dx = particle.x - pointer.x, dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 190 && distance > 0) {
            const force = (190 - distance) / 190;
            const direction = distance < 34 ? 0.38 : -0.58;
            particle.x += (dx / distance) * force * direction + (-dy / distance) * force * 0.1;
            particle.y += (dy / distance) * force * direction + (dx / distance) * force * 0.1;
            pointerGlow = force;
            if (distance < 112) {
              context.beginPath(); context.moveTo(particle.x, particle.y); context.lineTo(pointer.x, pointer.y);
              context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${force * 0.06})`;
              context.lineWidth = 0.5; context.stroke();
            }
          }
        }
        if (gather > 0.01) {
          const target = getCupTarget(index, particles.length, centerY);
          const attraction = 0.018 + gather * 0.085;
          particle.x += (target.x - particle.x) * attraction;
          particle.y += (target.y - particle.y) * attraction;
        } else if (previousGather > 0.08) {
          particle.vx += (Math.random() - 0.5) * 0.08;
          particle.vy -= Math.random() * 0.05;
        }
        if (particle.y < -24) particle.y = height + 24;
        if (particle.y > height + 24) particle.y = -24;
        if (particle.x < -24) particle.x = width + 24;
        if (particle.x > width + 24) particle.x = -24;
        particle.vx *= 0.998;
        const alpha = Math.min(0.82, particle.alpha + Math.min(0.3, scrollEnergy * 0.04) + pointerGlow * 0.18 + gather * 0.16);
        const streak = Math.min(16, scrollEnergy * particle.depth * 2.5);
        context.beginPath(); context.moveTo(particle.x, particle.y); context.lineTo(particle.x, particle.y + scrollDirection * streak);
        context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha * 0.58})`;
        context.lineWidth = Math.max(0.55, particle.radius * 0.68); context.stroke();
        context.beginPath(); context.arc(particle.x, particle.y, particle.radius + pointerGlow * 1.25 + gather * 0.3, 0, Math.PI * 2);
        context.fillStyle = `rgba(${Math.min(255, red + 20)}, ${Math.min(255, green + 20)}, ${Math.min(255, blue + 20)}, ${alpha})`;
        context.fill();
      });
      previousGather = gather; pointer.speed *= 0.82; scrollEnergy *= 0.9;
    };

    const handleVisibility = () => {
      running = !document.hidden;
      if (running) animationFrame = window.requestAnimationFrame(draw);
      else window.cancelAnimationFrame(animationFrame);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.querySelector<HTMLElement>('[data-philosophy-anchor]')?.style.removeProperty('--aroma-gather');
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[45] opacity-70" />;
}
