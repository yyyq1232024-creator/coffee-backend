import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Coffee, Database, Droplets, Flame, Leaf, MapPin, Mountain, Orbit, Route, Sprout, ThermometerSun, X } from 'lucide-react';
import { BeanBatch, MenuProduct } from '../types';
import OriginGlobe from './OriginGlobe';

type OriginEntry = { product: MenuProduct; batch: BeanBatch };

interface BeanOriginPageProps {
  initialBatchId?: string;
  embedded?: boolean;
  onClose?: () => void;
}

export default function BeanOriginPage({ initialBatchId = '', embedded = false, onClose }: BeanOriginPageProps) {
  const [entries, setEntries] = useState<OriginEntry[]>([]);
  const [selectedId, setSelectedId] = useState(initialBatchId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialBatchId) setSelectedId(initialBatchId);
  }, [initialBatchId]);

  useEffect(() => {
    if (!embedded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [embedded, onClose]);

  useEffect(() => {
    fetch('/api/products')
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) throw new Error(result.error || '豆源数据读取失败');
        const nextEntries = (result.data as MenuProduct[])
          .filter((product) => product.category === 'coffee' && product.beanBatch)
          .map((product) => ({ product, batch: product.beanBatch! }));
        setEntries(nextEntries);
        if (!nextEntries.some((entry) => entry.batch.id === selectedId)) {
          setSelectedId(nextEntries[0]?.batch.id || '');
        }
      })
      .catch((error) => console.error('Failed to load bean origins:', error))
      .finally(() => setLoading(false));
  }, []);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.batch.id === selectedId) || entries[0],
    [entries, selectedId]
  );

  const selectEntry = (entry: OriginEntry) => {
    setSelectedId(entry.batch.id);
  };

  const goBack = () => {
    if (onClose) onClose();
    else window.location.href = '/';
  };

  if (loading) {
    return <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-[#0E1110] text-stone-300 flex items-center justify-center text-sm tracking-widest`}>LOADING ORIGIN ARCHIVE…</div>;
  }
  if (!activeEntry) {
    return <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-[#0E1110] text-white flex items-center justify-center`}>暂时没有可查看的豆源批次。</div>;
  }

  const active = activeEntry.batch;

  return (
    <main className={`${embedded ? 'min-h-full' : 'min-h-screen'} bg-[#0E1110] text-[#F5EFE4] overflow-hidden selection:bg-amber-200 selection:text-stone-900`}>
      <div className="fixed inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_18%_15%,rgba(173,123,65,0.32),transparent_32%),radial-gradient(circle_at_85%_70%,rgba(51,91,70,0.34),transparent_30%)]" />

      <header className="relative z-20 max-w-7xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between border-b border-white/10">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-xs tracking-widest text-white/65 hover:text-white transition bg-transparent border-none cursor-pointer">
          {embedded ? <X className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {embedded ? '关闭豆源档案' : '返回悠然咖啡'}
        </button>
        <div className="text-right">
          <p className="text-[10px] tracking-[0.32em] text-[#D1AE79] uppercase">Yuran Origin Archive</p>
          <p className="text-[9px] text-white/35 mt-1">当前供应批次数据库</p>
        </div>
      </header>

      <section className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-12 lg:py-16 grid lg:grid-cols-[1.08fr_0.92fr] gap-12 items-center min-h-[680px]">
        <div className="relative flex items-center justify-center min-h-[500px]">
          <OriginGlobe
            entries={entries.map((entry) => ({ id: entry.batch.id, batch: entry.batch }))}
            active={active}
            onSelect={(id) => {
              const entry = entries.find((item) => item.batch.id === id);
              if (entry) selectEntry(entry);
            }}
          />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/35">Current Coordinates</p>
            <p className="font-mono text-xs text-[#D8BA8A] mt-1">{active.latitude.toFixed(2)}°, {active.longitude.toFixed(2)}°</p>
          </div>
        </div>

        <div key={active.id} className="space-y-8 origin-detail-enter">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#D1AE79]">Origin {String(entries.findIndex((entry) => entry.batch.id === active.id) + 1).padStart(2, '0')}</p>
            <h1 className="text-4xl sm:text-6xl font-serif font-bold mt-3 leading-tight">{active.country}</h1>
            <p className="text-xl sm:text-2xl font-serif text-white/60 mt-2">{active.region}</p>
            <p className="text-sm leading-7 text-white/55 mt-6 max-w-xl">{active.story}</p>
          </div>

          <div className="grid grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {[
              ['对应饮品', activeEntry.product.name],
              ['庄园 / 批次', active.farm],
              ['海拔', active.altitude],
              ['品种', active.variety],
              ['处理法', active.process],
              ['烘焙程度', active.roastLevel],
              ['采收月份', active.harvestSeason],
              ['批次编号', active.lotCode],
            ].map(([label, value]) => (
              <div key={label} className="bg-[#131816]/95 px-4 py-4 min-h-20">
                <p className="text-[9px] uppercase tracking-wider text-white/30">{label}</p>
                <p className="text-xs sm:text-sm mt-2 text-[#F0E6D6] leading-5">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[9px] tracking-[0.24em] uppercase text-white/30 mb-3">Cup Profile</p>
            <div className="flex flex-wrap gap-2">
              {active.flavorNotes.map((note) => <span key={note} className="px-4 py-2 border border-[#D1AE79]/35 rounded-full text-xs text-[#E3C99F]">{note}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section key={`${active.id}-profile`} className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pb-14 origin-detail-enter">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
          <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-7">
              <div>
                <p className="text-[9px] tracking-[0.28em] uppercase text-[#D1AE79]">Terroir Record</p>
                <h2 className="font-serif text-2xl mt-2">产区环境档案</h2>
              </div>
              <Sprout className="w-8 h-8 text-[#D1AE79]/70" />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                [MapPin, '微型产区', active.profile.microRegion],
                [Mountain, '地形环境', active.profile.terrain],
                [ThermometerSun, '年均温度', active.profile.temperature],
                [Droplets, '年均降雨', active.profile.rainfall],
                [Leaf, '土壤条件', active.profile.soil],
                [Sprout, '生产者', active.profile.producer],
              ].map(([Icon, label, value]) => {
                const DetailIcon = Icon as typeof MapPin;
                return (
                  <div key={String(label)} className="flex gap-3">
                    <DetailIcon className="w-4 h-4 mt-0.5 shrink-0 text-[#D1AE79]/70" />
                    <div><p className="text-[9px] tracking-wider text-white/30">{String(label)}</p><p className="text-xs leading-5 text-white/70 mt-1">{String(value)}</p></div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-7">
              <div>
                <p className="text-[9px] tracking-[0.28em] uppercase text-[#D1AE79]">Quality & Brewing</p>
                <h2 className="font-serif text-2xl mt-2">生豆质量与冲煮建议</h2>
              </div>
              <Coffee className="w-8 h-8 text-[#D1AE79]/70" />
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
              {[
                ['采摘方式', active.profile.harvestMethod],
                ['干燥方式', active.profile.drying],
                ['生豆含水率', active.profile.moisture],
                ['豆目规格', active.profile.screen],
                ['出口合作方', active.profile.exporter],
                ['入库时间', active.profile.arrival],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-white/[0.07] pb-3">
                  <span className="text-[10px] text-white/35">{label}</span><span className="text-xs text-right text-white/70">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-[#D1AE79]/10 border border-[#D1AE79]/20 px-5 py-4 flex gap-3">
              <Coffee className="w-4 h-4 mt-0.5 shrink-0 text-[#E3C99F]" />
              <div><p className="text-[9px] tracking-wider text-[#D1AE79]">RECOMMENDED BREW</p><p className="text-sm mt-1.5 text-[#F0E6D6]">{active.profile.recommendedBrew}</p></div>
            </div>
          </article>
        </div>

        <article className="mt-5 rounded-3xl border border-white/10 bg-[#111614] p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="md:w-64 shrink-0">
              <div className="flex items-center gap-2 text-[#D1AE79]"><Database className="w-4 h-4" /><span className="text-[9px] tracking-[0.25em] uppercase">Batch Trace</span></div>
              <h2 className="font-serif text-2xl mt-2">批次流转记录</h2>
              <p className="text-[10px] text-white/30 mt-2">批次号 {active.lotCode}</p>
            </div>
            <div className="flex-1 grid sm:grid-cols-5 gap-3">
              {active.profile.traceability.map((step, index) => (
                <div key={step} className="relative rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 min-h-24">
                  <div className="flex items-center justify-between"><span className="font-mono text-[9px] text-[#D1AE79]">0{index + 1}</span>{index === active.profile.traceability.length - 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300/70" /> : <Route className="w-3.5 h-3.5 text-white/25" />}</div>
                  <p className="text-xs leading-5 text-white/65 mt-4">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pb-16">
        <div className="flex items-center gap-2 mb-5 text-white/40 text-[10px] uppercase tracking-[0.25em]"><Orbit className="w-4 h-4" />切换当前豆源</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => {
            const selected = entry.batch.id === active.id;
            return (
              <button key={entry.batch.id} onClick={() => selectEntry(entry)} className={`text-left rounded-2xl overflow-hidden border transition-all ${selected ? 'border-[#D1AE79] bg-[#D1AE79]/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}>
                <div className="h-32 relative">
                  <img src={entry.batch.image} alt={entry.batch.region} className="w-full h-full object-cover opacity-75" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111512] to-transparent" />
                  <p className="absolute left-4 bottom-3 text-sm font-serif font-bold">{entry.batch.country} · {entry.batch.region}</p>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-xs text-white/65">{entry.product.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-white/35">
                    <span className="inline-flex items-center gap-1"><Mountain className="w-3 h-3" />{entry.batch.altitude}</span>
                    <span className="inline-flex items-center gap-1"><Leaf className="w-3 h-3" />{entry.batch.process}</span>
                    <span className="inline-flex items-center gap-1"><Flame className="w-3 h-3" />{entry.batch.roastLevel}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{entry.batch.harvestSeason}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] leading-5 text-white/25 mt-7 flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />页面展示的是系统中的门店批次档案。正式使用时应以供应商批次单和烘焙记录替换演示数据。</p>
      </section>
    </main>
  );
}
