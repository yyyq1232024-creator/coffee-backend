import { useEffect, useRef } from 'react';

export default function CoffeeCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const glow = glowRef.current;
    const home = cursor?.closest<HTMLElement>('.coffee-home');
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!cursor || !dot || !ring || !glow || !home || !finePointer || reducedMotion) return;

    let targetX = -120;
    let targetY = -120;
    let ringX = targetX;
    let ringY = targetY;
    let glowX = targetX;
    let glowY = targetY;
    let frame = 0;

    const render = () => {
      ringX += (targetX - ringX) * 0.16;
      ringY += (targetY - ringY) * 0.16;
      glowX += (targetX - glowX) * 0.075;
      glowY += (targetY - glowY) * 0.075;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      glow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0)`;
      frame = window.requestAnimationFrame(render);
    };

    const handleMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      cursor.classList.add('is-visible');

      const target = event.target as Element | null;
      const isInteractive = Boolean(target?.closest('a, button, [data-cursor-active]'));
      ring.classList.toggle('is-active', isInteractive);
      glow.classList.toggle('is-active', isInteractive);
    };

    const handleLeave = () => cursor.classList.remove('is-visible');

    home.classList.add('coffee-cursor-enabled');
    home.addEventListener('pointermove', handleMove);
    home.addEventListener('pointerleave', handleLeave);
    frame = window.requestAnimationFrame(render);

    return () => {
      home.classList.remove('coffee-cursor-enabled');
      home.removeEventListener('pointermove', handleMove);
      home.removeEventListener('pointerleave', handleLeave);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={cursorRef} className="coffee-cursor" aria-hidden="true">
      <div ref={glowRef} className="coffee-cursor__glow" />
      <div ref={ringRef} className="coffee-cursor__ring" />
      <div ref={dotRef} className="coffee-cursor__dot" />
    </div>
  );
}
