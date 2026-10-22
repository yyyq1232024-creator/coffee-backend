import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight, Coffee, LayoutDashboard, LogOut, Menu, UserRound, X } from 'lucide-react';
import { User as UserType } from '../types';
import CoffeeCursor from './CoffeeCursor';
import CoffeeParticles from './CoffeeParticles';

type HomeTab = 'home' | 'menu' | 'builder' | 'wishlist' | 'about' | 'contact' | 'printer';

interface CoffeeHomeProps {
  user: UserType | null;
  onNavigate: (tab: HomeTab) => void;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToAdmin?: () => void;
  onLogout?: () => void;
}

const HERO_SLIDES = [
  {
    eyebrow: 'FIRST CUP / 01',
    title: ['PURE', 'RITUAL'],
    copy: '油脂、温度与烘焙香气在原速镜头里自然展开，一杯咖啡从清晰的细节开始。',
    video: '/media/hero-coffee-cup-4k.mp4',
    mobileVideo: '/media/hero-coffee-cup-4k-mobile.mp4',
    image: '/media/hero-coffee-cup-4k.webp',
    tone: 'COFFEE / ROAST / REAL TIME',
  },
  {
    eyebrow: 'COASTLINE / 02',
    title: ['OCEAN', 'RHYTHM'],
    copy: '海浪按照自己的频率抵达岸边，清晰、自然，也无需被催促。',
    video: '/media/hero-waves-4k.mp4',
    mobileVideo: '/media/hero-waves-4k-mobile.mp4',
    image: '/media/hero-waves-4k.webp',
    tone: 'WATER / AIR / REAL TIME',
  },
  {
    eyebrow: 'STILL WATERS / 03',
    title: ['STILL', 'WATERS'],
    copy: '湖岸保持平静，时间自然流动，风味也在此刻慢慢展开。',
    video: '/media/hero-lake-4k.mp4',
    mobileVideo: '/media/hero-lake-4k-mobile.mp4',
    image: '/media/hero-lake-4k.webp',
    tone: 'WATER / HILLS / SILENCE',
  },
  {
    eyebrow: 'THE JOURNEY / 04',
    title: ['TAKE', 'YOUR TIME'],
    copy: '沿着山路自然前行，不抢时间，也不遗漏沿途的风景。',
    video: '/media/hero-road-4k.mp4',
    mobileVideo: '/media/hero-road-4k-mobile.mp4',
    image: '/media/hero-road-4k.webp',
    tone: 'THE SCENIC ROUTE',
  },
  {
    eyebrow: 'QUIET COMPANY / 05',
    title: ['QUIET', 'COMPANY'],
    copy: '水面上的相遇无需喧哗，松弛本身就是一种陪伴。',
    video: '/media/hero-swans-4k.mp4',
    mobileVideo: '/media/hero-swans-4k-mobile.mp4',
    image: '/media/hero-swans-4k.webp',
    tone: 'NATURE IN REAL TIME',
  },
  {
    eyebrow: 'BREWING RITUAL / 06',
    title: ['POUR', 'SLOWLY'],
    copy: '一杯咖啡的完成不必仓促，让水流、香气与温度自然发生。',
    video: '/media/hero-pour-4k.mp4',
    mobileVideo: '/media/hero-pour-4k-mobile.mp4',
    image: '/media/hero-pour-4k.webp',
    tone: 'COFFEE / CRAFT / DETAIL',
  },
  {
    eyebrow: 'URBAN LIGHT / 07',
    title: ['URBAN', 'LIGHT'],
    copy: '城市有自己的明暗层次，我们为其中留下一处从容的位置。',
    video: '/media/hero-buildings-4k.mp4',
    mobileVideo: '/media/hero-buildings-4k-mobile.mp4',
    image: '/media/hero-buildings-4k.webp',
    tone: 'FORM / SHADOW / RHYTHM',
  },
  {
    eyebrow: 'WINDOW STORIES / 08',
    title: ['WINDOW', 'STORIES'],
    copy: '窗外的景色持续向前，手中的这一杯让片刻留了下来。',
    video: '/media/hero-train-4k.mp4',
    mobileVideo: '/media/hero-train-4k-mobile.mp4',
    image: '/media/hero-train-4k.webp',
    tone: 'PASSING SCENES / LASTING TASTE',
  },
];

const PHILOSOPHY_LINES = [
  '咖啡不是匆忙生活的燃料，',
  '而是一段值得被认真对待',
  '的时间。',
];

const splitPhilosophyTokens = (line: string) => Array.from(line).reduce<string[]>((tokens, character) => {
  if ('，。！？；：'.includes(character) && tokens.length > 0) {
    tokens[tokens.length - 1] += character;
  } else {
    tokens.push(character);
  }
  return tokens;
}, []);

const philosophyLineVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.12,
      staggerChildren: 0.035,
    },
  },
};

const philosophyCharacterVariants = {
  hidden: { opacity: 0, y: '115%', rotate: 3 },
  visible: {
    opacity: 1,
    y: '0%',
    rotate: 0,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const STORIES = [
  {
    number: '01',
    label: 'ORIGIN / DIRECT TRADE',
    title: '风味，始于山野。',
    english: 'Born at altitude.',
    copy: '我们追随季节寻找高海拔优质产区，与认真对待土地的人合作。柑橘、红茶、花香与成熟浆果——风味不是被添加，而是被好好保留下来。',
    image: 'https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=2200&q=90',
  },
  {
    number: '02',
    label: 'BREW / CRAFT & PRECISION',
    title: '慢一点，才喝得到。',
    english: 'Time is an ingredient.',
    copy: '每天的温度与湿度都不同，所以冲煮从来不该只是重复。研磨、水温、闷蒸和流速，在咖啡师手里共同完成一杯当日限定。',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=2200&q=90',
  },
  {
    number: '03',
    label: 'SPACE / A QUIET RETREAT',
    title: '留一席，给自己。',
    english: 'Room to stay awhile.',
    copy: '木、石、微光和黑胶的低频组成一间安静的咖啡馆。这里不催促你离开，也不要求你忙碌，只提供一段可以慢下来的时间。',
    image: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=2200&q=90',
  },
  {
    number: '04',
    label: 'MEMORY / MADE PERSONAL',
    title: '你的配方，你的故事。',
    english: 'Made yours, kept close.',
    copy: '保存一杯专属特调，也保存那天的心情。登录会员即可收藏配方、同步订单，并把属于你的咖啡记忆打印成一张真正可以带走的小票。',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2200&q=90',
  },
];

export default function CoffeeHome({
  user,
  onNavigate,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToAdmin,
  onLogout,
}: CoffeeHomeProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);
  const philosophyRef = useRef<HTMLElement>(null);
  const nextVideoPreloadRef = useRef<HTMLVideoElement | null>(null);
  const { scrollYProgress: philosophyProgress } = useScroll({
    target: philosophyRef,
    offset: ['start end', 'end start'],
  });
  const philosophyCopyY = useTransform(philosophyProgress, [0, 0.48, 1], [72, 0, -36]);
  const philosophyBackdropY = useTransform(philosophyProgress, [0, 1], [90, -90]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    HERO_SLIDES.forEach((slide) => {
      const image = new Image();
      image.src = slide.image;
    });
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1024px)').matches) return;
    const nextSlide = HERO_SLIDES[(activeSlide + 1) % HERO_SLIDES.length];
    const preloadVideo = document.createElement('video');
    preloadVideo.preload = 'auto';
    preloadVideo.muted = true;
    preloadVideo.playsInline = true;
    preloadVideo.src = nextSlide.mobileVideo;
    preloadVideo.load();
    nextVideoPreloadRef.current = preloadVideo;
    return () => {
      preloadVideo.removeAttribute('src');
      preloadVideo.load();
      if (nextVideoPreloadRef.current === preloadVideo) nextVideoPreloadRef.current = null;
    };
  }, [activeSlide]);

  useEffect(() => {
    const updateNavigation = () => setIsScrolled(window.scrollY > 48);
    updateNavigation();
    window.addEventListener('scroll', updateNavigation, { passive: true });
    return () => window.removeEventListener('scroll', updateNavigation);
  }, []);

  const scrollToStories = () => {
    storyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePhilosophyPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    event.currentTarget.style.setProperty('--philosophy-x', `${x}%`);
    event.currentTarget.style.setProperty('--philosophy-y', `${y}%`);
  };

  return (
    <div className="coffee-home bg-[#100a07] text-white overflow-clip">
      <CoffeeCursor />
      <CoffeeParticles />
      <section className="relative min-h-[100svh] overflow-hidden bg-[#160d08]">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.7 } }}
            className="absolute inset-0"
          >
            <video
              key={HERO_SLIDES[activeSlide].video}
              className="h-full w-full object-cover"
              poster={HERO_SLIDES[activeSlide].image}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-label={HERO_SLIDES[activeSlide].copy}
            >
              <source media="(max-width: 1024px)" src={HERO_SLIDES[activeSlide].mobileVideo} type="video/mp4" />
              <source src={HERO_SLIDES[activeSlide].video} type="video/mp4" />
            </video>
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,5,2,.64)_0%,rgba(10,5,2,.08)_35%,rgba(10,5,2,.25)_62%,rgba(10,5,2,.82)_100%)]" />
        <div className="coffee-grain absolute inset-0 opacity-[0.12] mix-blend-soft-light pointer-events-none" />

        <header className={`fixed inset-x-0 top-0 z-[60] px-5 transition-all duration-500 md:px-10 ${
          isScrolled
            ? 'bg-[#120b08]/82 py-3 shadow-[0_16px_60px_rgba(0,0,0,.24)] backdrop-blur-xl'
            : 'bg-transparent py-5 md:py-7'
        }`}>
          <div className={`flex items-center justify-between gap-5 transition-all duration-500 ${
            isScrolled ? 'border-b border-white/10 pb-3' : 'border-b border-white/25 pb-5'
          }`}>
            <button
              onClick={() => onNavigate('home')}
              className="group flex items-center gap-3 bg-transparent text-white border-0 cursor-pointer"
              aria-label="返回首页"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/45 transition group-hover:bg-white group-hover:text-[#23130b]">
                <Coffee className="h-4 w-4" />
              </span>
              <span className="text-left">
                <strong className="block text-sm font-semibold tracking-[0.12em]">悠然咖啡客</strong>
                <span className="hidden text-[8px] tracking-[0.28em] text-white/60 sm:block">YURAN COFFEE HOUSE</span>
              </span>
            </button>

            <nav className="hidden items-center gap-7 text-[10px] font-semibold tracking-[0.18em] lg:flex">
              <button onClick={() => onNavigate('menu')} className="coffee-nav-link">菜单 MENU</button>
              <button onClick={() => onNavigate('builder')} className="coffee-nav-link">特调 LAB</button>
              <button onClick={() => onNavigate('about')} className="coffee-nav-link">故事 STORY</button>
              <button onClick={() => onNavigate('contact')} className="coffee-nav-link">联络 CONTACT</button>
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(current => !current)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-black/10 text-white backdrop-blur-md lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              {user ? (
                <>
                  {user.role === 'admin' && (
                    <button
                      onClick={onNavigateToAdmin}
                      className="hidden sm:flex items-center gap-2 rounded-full border border-white/35 bg-white px-3 py-2 text-[9px] font-semibold tracking-wider text-[#23130b] transition hover:bg-[#d8a66f] lg:px-4"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      管理后台
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate('wishlist')}
                    className="flex items-center gap-2 rounded-full border border-white/35 bg-black/10 px-3 py-2 text-[9px] font-semibold tracking-wider text-white backdrop-blur-md transition hover:bg-white hover:text-[#23130b] sm:px-4"
                  >
                    <UserRound className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{user.name}</span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-transparent text-white transition hover:bg-white hover:text-[#23130b]"
                    aria-label="退出登录"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={onNavigateToLogin} className="coffee-nav-link hidden sm:block">登录</button>
                  <button
                    onClick={onNavigateToRegister}
                    className="rounded-full border border-white/45 bg-white px-4 py-2 text-[9px] font-bold tracking-[0.16em] text-[#23130b] transition hover:bg-[#d8a66f] sm:px-5"
                  >
                    加入会员
                  </button>
                </>
              )}
            </div>
          </div>
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.nav
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/15 bg-[#120b08]/94 p-3 shadow-2xl backdrop-blur-xl lg:hidden"
                aria-label="移动端主要导航"
              >
                {[
                  ['menu', '菜单'],
                  ['builder', '私人特调'],
                  ['wishlist', '心愿单'],
                  ['printer', '吧台出单'],
                  ['about', '品牌故事'],
                  ['contact', '联系门店'],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); onNavigate(tab as HomeTab); }}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    {label}
                  </button>
                ))}
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); onNavigateToAdmin?.(); }}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#23130b]"
                  >
                    <LayoutDashboard className="h-4 w-4" />进入管理后台
                  </button>
                )}
                {!user && (
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); onNavigateToLogin(); }}
                    className="col-span-2 rounded-xl border border-[#d8a66f]/40 px-4 py-3 text-center text-xs text-[#e7c49e]"
                  >
                    会员登录
                  </button>
                )}
              </motion.nav>
            )}
          </AnimatePresence>
        </header>

        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-5 pb-20 pt-32 md:px-10 md:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide}
              initial={{ opacity: 0, y: 42 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              className="mb-auto mt-auto w-full"
            >
              <div className="mb-5 flex items-center gap-3 text-[9px] font-semibold tracking-[0.3em] text-white/75 md:text-[10px]">
                <span className="h-px w-10 bg-[#d6a36b]" />
                {HERO_SLIDES[activeSlide].eyebrow}
              </div>
              <h1 className="max-w-[1500px] text-[20vw] font-black uppercase leading-[0.75] tracking-[-0.075em] text-white sm:text-[18vw] lg:text-[12.8vw]">
                <span className="block">{HERO_SLIDES[activeSlide].title[0]}</span>
                <span className="block pl-[7vw]">{HERO_SLIDES[activeSlide].title[1]}</span>
              </h1>
            </motion.div>
          </AnimatePresence>

          <div className="grid items-end gap-6 border-t border-white/25 pt-5 md:grid-cols-[1fr_auto]">
            <div className="max-w-sm">
              <p className="text-sm font-medium leading-relaxed text-white/85 md:text-base">{HERO_SLIDES[activeSlide].copy}</p>
              <p className="mt-2 text-[9px] tracking-[0.24em] text-white/45">{HERO_SLIDES[activeSlide].tone}</p>
            </div>

            <button
              onClick={scrollToStories}
              className="group hidden flex-col items-center gap-2 bg-transparent text-white/70 md:flex"
              aria-label="向下探索"
            >
              <span className="text-[8px] tracking-[0.28em] [writing-mode:vertical-rl]">SCROLL</span>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 transition group-hover:bg-white group-hover:text-black">
                <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
              </span>
            </button>

          </div>
        </div>
      </section>

      <section
        ref={philosophyRef}
        onPointerMove={handlePhilosophyPointerMove}
        className="relative isolate min-h-[78svh] overflow-hidden bg-[#ede7dc] px-5 py-24 text-[#24140d] md:px-10 md:py-36"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-700"
          style={{
            background: 'radial-gradient(circle 300px at var(--philosophy-x, 68%) var(--philosophy-y, 42%), rgba(210, 164, 111, 0.42), transparent 72%)',
          }}
        />
        <motion.div
          aria-hidden="true"
          style={{ y: philosophyBackdropY }}
          className="pointer-events-none absolute -right-[3vw] top-1/2 -z-10 -translate-y-1/2 select-none font-serif text-[27vw] leading-none tracking-[-0.08em] text-[#24140d]/[0.035]"
        >
          SLOW
        </motion.div>

        <motion.div
          style={{ y: philosophyCopyY }}
          className="mx-auto grid max-w-7xl gap-14 md:grid-cols-[0.72fr_2fr] md:items-start"
        >
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.55 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 md:pt-3"
          >
            <motion.span
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="h-px w-10 origin-left bg-[#9b6a48]"
            />
            <p className="text-[10px] font-bold tracking-[0.28em] text-[#76523d]">OUR PHILOSOPHY / 悠然之道</p>
          </motion.div>

          <div>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.38 }}
              className="max-w-5xl font-serif text-[clamp(2.5rem,4.8vw,4.25rem)] leading-[1.08] tracking-[-0.04em]"
            >
              {PHILOSOPHY_LINES.map((line) => (
                <motion.span
                  key={line}
                  variants={philosophyLineVariants}
                  className="block overflow-hidden pb-[0.08em]"
                >
                  {splitPhilosophyTokens(line).map((character, index) => (
                    <motion.span
                      key={`${character}-${index}`}
                      variants={philosophyCharacterVariants}
                      className="inline-block will-change-transform"
                    >
                      {character}
                    </motion.span>
                  ))}
                </motion.span>
              ))}
            </motion.h2>

            <motion.button
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ x: 8 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: 0.7, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onNavigate('menu')}
              className="group mt-12 inline-flex items-center gap-4 border-b border-[#24140d]/30 bg-transparent pb-2 text-[10px] font-bold tracking-[0.22em] text-[#24140d] transition-colors hover:border-[#24140d]"
            >
              探索本季菜单
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[#24140d]/25 transition-colors group-hover:bg-[#24140d] group-hover:text-[#ede7dc]">
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          </div>
        </motion.div>
      </section>

      <section ref={storyRef} className="relative bg-[#100a07]">
        {STORIES.map((story, index) => {
          const isLight = index === 1 || index === 3;
          return (
            <article
              key={story.number}
              className={`grid min-h-[100svh] overflow-hidden border-t md:grid-cols-2 ${
                isLight
                  ? 'border-[#24140d]/10 bg-[#d3ab78] text-[#24140d]'
                  : 'border-white/10 bg-[#100a07] text-white'
              }`}
            >
              <motion.div
                initial={{ opacity: 0, x: index % 2 === 0 ? -70 : 70 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.18 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className={`relative min-h-[58svh] overflow-hidden md:min-h-screen ${index % 2 === 1 ? 'md:order-2' : ''}`}
              >
                <motion.img
                  initial={{ scale: 1.08 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: false, amount: 0.25 }}
                  transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                  src={story.image}
                  alt={story.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute inset-0 ${isLight ? 'bg-[#3b1e0b]/12' : 'bg-black/18'}`} />
                <span className="absolute left-6 top-6 border border-white/35 bg-black/15 px-3 py-2 font-mono text-[9px] tracking-[0.22em] text-white backdrop-blur-md md:left-10 md:top-28">
                  IMAGE / {story.number}
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 62 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.28 }}
                transition={{ duration: 0.85, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={`relative flex min-h-[70svh] flex-col justify-between px-7 py-16 md:min-h-screen md:px-14 md:pb-14 md:pt-32 lg:px-20 ${
                  index % 2 === 1 ? 'md:order-1' : ''
                }`}
              >
                <div className={`flex items-center justify-between border-b pb-5 text-[9px] font-semibold tracking-[0.26em] ${
                  isLight ? 'border-[#24140d]/20' : 'border-white/18'
                }`}>
                  <span>{story.label}</span>
                  <span>{story.number} / 04</span>
                </div>

                <div className="my-auto py-14">
                  <p className={`font-serif text-lg italic md:text-xl ${isLight ? 'text-[#24140d]/55' : 'text-white/48'}`}>{story.english}</p>
                  <h3 className="mt-4 max-w-xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl lg:text-7xl">{story.title}</h3>
                  <p className={`mt-8 max-w-xl text-sm leading-8 lg:text-base ${isLight ? 'text-[#24140d]/68' : 'text-white/62'}`}>{story.copy}</p>

                  {index === STORIES.length - 1 && (
                    <button
                      onClick={() => onNavigate(user ? 'wishlist' : 'builder')}
                      className={`mt-10 inline-flex items-center gap-3 border px-6 py-3 text-[10px] font-bold tracking-[0.18em] transition ${
                        isLight
                          ? 'border-[#24140d]/35 text-[#24140d] hover:bg-[#24140d] hover:text-[#d3ab78]'
                          : 'border-white/35 text-white hover:bg-white hover:text-black'
                      }`}
                    >
                      {user ? '查看我的专属配方' : '进入私人特调工坊'} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className={`flex items-center gap-4 border-t pt-5 text-[9px] tracking-[0.24em] ${
                  isLight ? 'border-[#24140d]/20 text-[#24140d]/55' : 'border-white/18 text-white/42'
                }`}>
                  <span className="h-px w-10 bg-current" />
                  {index < STORIES.length - 1 ? 'CONTINUE TO NEXT CHAPTER' : 'THE STORY CONTINUES'}
                </div>
              </motion.div>
            </article>
          );
        })}
      </section>

      <section className="bg-[#d9aa73] px-5 py-20 text-[#24140d] md:px-10 md:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] font-bold tracking-[0.28em]">READY FOR YOUR CUP?</p>
            <h2 className="mt-5 max-w-3xl font-serif text-5xl leading-none tracking-[-0.04em] md:text-7xl">今天，想喝点什么？</h2>
          </div>
          <button
            onClick={() => onNavigate('menu')}
            className="group flex h-24 w-24 items-center justify-center rounded-full border border-[#24140d]/50 bg-transparent transition hover:rotate-[-8deg] hover:bg-[#24140d] hover:text-[#d9aa73] md:h-32 md:w-32"
          >
            <span className="text-center text-[9px] font-bold leading-5 tracking-[0.16em]">查看菜单<br />ORDER NOW</span>
          </button>
        </div>
      </section>
    </div>
  );
}
