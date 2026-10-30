import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';

export type GlassStory = {
  number: string;
  label: string;
  title: string;
  english: string;
  copy: string;
  image: string;
  video: string;
};

type StoryGlassGalleryProps = {
  stories: GlassStory[];
  sectionRef: RefObject<HTMLDivElement | null>;
  finalCtaLabel: string;
  onFinalCta: () => void;
};

function StoryVideo({ story, active }: { story: GlassStory; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) void video.play().catch(() => undefined);
    else video.pause();
  }, [active]);
  return (
    <video ref={videoRef} muted loop playsInline preload={active ? 'auto' : 'metadata'} poster={story.image} aria-hidden="true">
      <source src={story.video} type="video/mp4" />
    </video>
  );
}

function GlassStoryCard({ story, index, total, progress, active, finalCtaLabel, onFinalCta }: {
  story: GlassStory;
  index: number;
  total: number;
  progress: MotionValue<number>;
  active: boolean;
  finalCtaLabel: string;
  onFinalCta: () => void;
}) {
  const offset = useTransform(progress, (value) => index - value * (total - 1));
  const x = useTransform(offset, (value) => value * Math.min(window.innerWidth * 0.42, 520));
  const z = useTransform(offset, (value) => -Math.abs(value) * 270);
  const rotateY = useTransform(offset, (value) => value * -43);
  const rotateZ = useTransform(offset, (value) => value * 1.8);
  const scale = useTransform(offset, (value) => 1 - Math.min(Math.abs(value) * 0.13, 0.32));
  const opacity = useTransform(offset, (value) => Math.max(0.12, 1 - Math.abs(value) * 0.35));
  const filter = useTransform(offset, (value) => `blur(${Math.min(8, Math.abs(value) * 2.6)}px)`);
  const zIndex = useTransform(offset, (value) => Math.max(1, 20 - Math.round(Math.abs(value) * 5)));

  return (
    <motion.article
      aria-hidden={!active}
      className={`glass-story-card ${active ? 'is-active' : ''}`}
      style={{ x, z, rotateY, rotateZ, scale, opacity, filter, zIndex }}
    >
      <div className="glass-story-card__media"><StoryVideo story={story} active={active} /></div>
      <div className="glass-story-card__shade" />
      <div className="glass-story-card__reflection" />
      <div className="glass-story-card__chrome">
        <span>{story.label}</span><span>{story.number} / {String(total).padStart(2, '0')}</span>
      </div>
      <div className="glass-story-card__copy">
        <p>{story.english}</p>
        <h3>{story.title}</h3>
        <div className="glass-story-card__detail">
          <span>{story.copy}</span>
          {index === total - 1 && (
            <button type="button" onClick={onFinalCta} tabIndex={active ? 0 : -1}>
              {finalCtaLabel}<ArrowRight />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function MobileGlassStory({ story, index, total, finalCtaLabel, onFinalCta }: {
  story: GlassStory;
  index: number;
  total: number;
  finalCtaLabel: string;
  onFinalCta: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.52 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  return (
    <article ref={cardRef} className="mobile-glass-story">
      <div className="mobile-glass-story__media"><StoryVideo story={story} active={active} /></div>
      <div className="mobile-glass-story__shade" />
      <div className="mobile-glass-story__content">
        <div><span>{story.label}</span><span>{story.number} / {String(total).padStart(2, '0')}</span></div>
        <p>{story.english}</p>
        <h3>{story.title}</h3>
        <strong>{story.copy}</strong>
        {index === total - 1 && <button type="button" onClick={onFinalCta}>{finalCtaLabel}<ArrowRight /></button>}
      </div>
    </article>
  );
}

export default function StoryGlassGallery({ stories, sectionRef, finalCtaLabel, onFinalCta }: StoryGlassGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 115, damping: 28, mass: 0.28 });
  useMotionValueEvent(smoothProgress, 'change', (value) => {
    setActiveIndex(Math.max(0, Math.min(stories.length - 1, Math.round(value * (stories.length - 1)))));
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (isMobile) {
    return (
      <section ref={sectionRef} className="mobile-glass-gallery">
        <header><span>YURAN STORIES</span><h2>滚动，进入悠然的四个片段。</h2></header>
        {stories.map((story, index) => (
          <MobileGlassStory key={story.number} story={story} index={index} total={stories.length}
            finalCtaLabel={finalCtaLabel} onFinalCta={onFinalCta} />
        ))}
      </section>
    );
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--glass-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty('--glass-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  };

  return (
    <section ref={sectionRef} className="glass-gallery" onPointerMove={handlePointerMove}>
      <div className="glass-gallery__sticky">
        <div className="glass-gallery__ambient" aria-hidden="true" />
        <header className="glass-gallery__header">
          <div><span>YURAN STORIES / SCROLL EXPERIENCE</span><h2>让滚动，成为一段慢下来的旅程。</h2></div>
          <p><b>{String(activeIndex + 1).padStart(2, '0')}</b> / {String(stories.length).padStart(2, '0')}</p>
        </header>
        <div className="glass-gallery__stage">
          {stories.map((story, index) => (
            <GlassStoryCard key={story.number} story={story} index={index} total={stories.length}
              progress={smoothProgress} active={index === activeIndex} finalCtaLabel={finalCtaLabel} onFinalCta={onFinalCta} />
          ))}
        </div>
        <div className="glass-gallery__footer">
          <span>SCROLL TO ROTATE</span>
          <div><motion.i style={{ scaleX: smoothProgress }} /></div>
          <strong>{stories[activeIndex].label}</strong>
        </div>
      </div>
    </section>
  );
}
