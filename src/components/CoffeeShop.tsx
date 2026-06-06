import React, { useState, useEffect } from 'react';
import { 
  Coffee, Heart, Trash2, Plus, Sparkles, Check, 
  MapPin, Phone, Mail, FileText, Send, Share2, Printer, X, ChevronDown
} from 'lucide-react';
import { User as UserType } from '../types';

interface CoffeeShopProps {
  user: UserType | null;
  token: string | null;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onLogout?: () => void;
}

export interface WishlistItem {
  wishId: string;
  itemId?: number; // exists if from menu
  name: string;
  price: number;
  category: string;
  img: string;
  sugar: string;
  milk: string;
  temp: string;
  size: string; // "Medium" | "Large" | "Venti"
  notes: string;
  addedAt: string;
}

export default function CoffeeShop({ user, token, onNavigateToLogin, onNavigateToRegister, onLogout }: CoffeeShopProps) {
  // Navigation tabs: 'home' | 'menu' | 'builder' | 'wishlist' | 'about' | 'contact'
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'builder' | 'wishlist' | 'about' | 'contact'>('home');
  const [menuFilter, setMenuFilter] = useState<'all' | 'coffee' | 'tea' | 'dessert'>('all');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [addedAnimationId, setAddedAnimationId] = useState<number | null>(null);
  
  // Custom Receipt Overlay state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptType, setReceiptType] = useState<'dine-in' | 'take-away'>('dine-in');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (wishlist.length === 0) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          items: wishlist.map((itm) => ({
            id: itm.wishId,
            name: itm.name,
            price: itm.price,
            size: itm.size,
            sugar: itm.sugar,
            milk: itm.milk,
            temp: itm.temp,
            notes: itm.notes,
            img: itm.img
          })),
          totalPrice: totalWishlistPrice,
          buyerName: user ? user.name : "自助常旅客",
          buyerUsername: user ? user.username : "guest",
          type: receiptType
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '结算失败');
      }

      alert(data.message || '🎉 下单支付成功！大堂工匠已接到您的实时订单。');
      saveWishlist([]);
      setShowReceipt(false);
    } catch (e: any) {
      alert(`下单支付出错: ${e.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Inline Quick Customization State for menu items
  const [quickCustomizeItemId, setQuickCustomizeItemId] = useState<number | null>(null);
  const [quickSize, setQuickSize] = useState('大杯的大口满足 (Large)');
  const [quickSugar, setQuickSugar] = useState('半糖 (微甜恰到好处)');
  const [quickMilk, setQuickMilk] = useState('燕麦奶 (浓郁谷香)');
  const [quickTemp, setQuickTemp] = useState('少冰 (清凉解暑)');
  const [quickNotes, setQuickNotes] = useState('');

  // Custom cup builder state
  const [builderBase, setBuilderBase] = useState('手冲耶加雪菲');
  const [builderBasePrice, setBuilderBasePrice] = useState(32);
  const [builderMilk, setBuilderMilk] = useState('香浓冰鲜牛奶');
  const [builderMilkPrice, setBuilderMilkPrice] = useState(3);
  const [builderSugar, setBuilderSugar] = useState('半糖 (微甜恰到好处)');
  const [builderTemp, setBuilderTemp] = useState('少冰 (清凉解暑)');
  const [builderSize, setBuilderSize] = useState('大杯的大口满足 (Large)');
  const [builderExtras, setBuilderExtras] = useState<string[]>([]);
  const [customCupName, setCustomCupName] = useState('午后治愈专属特调');

  const extraOptions = [
    { name: '法式香草冰淇淋球', price: 6 },
    { name: '喜马拉雅玫瑰盐芝士奶盖', price: 5 },
    { name: '咸焦糖浆香拉花', price: 3 },
    { name: '奥利奥脆脆多重奏', price: 3 },
  ];

  const totalBuilderPrice = builderBasePrice + builderMilkPrice + (builderSize === '中杯的轻盈体验 (Medium)' ? 0 : builderSize === '大杯的大口满足 (Large)' ? 3 : 5) + builderExtras.reduce((sum, name) => {
    const opt = extraOptions.find(o => o.name === name);
    return sum + (opt ? opt.price : 0);
  }, 0);

  // Community reviews for cozy visual rhythm
  const initialReviews = [
    { text: "咖啡香气极其沉醉！耶加雪菲的柑橘果酸溢满口腔，配上焦糖曲奇绝了。☕", name: "微风过境", stars: "★★★★★", lane: 0, speed: 18 },
    { text: "生椰拿铁和重乳酪下午茶味道极好，环境超级温暖，古典唱机超级治愈。🎧", name: "不加糖的日常", stars: "★★★★★", lane: 1, speed: 22 },
    { text: "拉花太精细了，咖啡师陈师傅专门给我手工绘制了一枚复古树叶！🎨", name: "莫奈的调色盘", stars: "★★★★★", lane: 2, speed: 20 },
    { text: "极简温暖的人文原木气息，配上淡淡的轻爵士乐，极度解压的避风港。💻", name: "独立开发者小陈", stars: "★★★★★", lane: 0, speed: 15 },
    { text: "冰燕麦拿铁醇厚自然，冷萃的风味饱满透亮。以后这里就是我的专属据点啦！🍵", name: "绿野仙踪", stars: "★★★★★", lane: 1, speed: 19 },
    { text: "推荐大家尝尝手作抹茶慕斯，口感丝滑，茶香浓郁不苦涩，绝对是招牌！💚", name: "抹茶控阿雅", stars: "★★★★★", lane: 2, speed: 17 },
    { text: "悠然咖啡客永远有惊喜，这次推出的私人特调房创意十足，简直停不下来！✨", name: "特调狂热饭", stars: "★★★★★", lane: 0, speed: 24 },
    { text: "周五下午同友人在大堂闲谈，喝着暖烘烘的手冲瑰夏，太幸福了。", name: "浮生一日闲", stars: "★★★★★", lane: 1, speed: 21 }
  ];

  const [liveReviews, setLiveReviews] = useState(() => {
    const local = localStorage.getItem('coffee_danmakus');
    if (local) {
      try {
        return [...initialReviews, ...JSON.parse(local)];
      } catch (e) {
        return initialReviews;
      }
    }
    return initialReviews;
  });

  const [danmakuInputText, setDanmakuInputText] = useState('');
  const [danmakuInputNick, setDanmakuInputNick] = useState('');
  const [danmakuStars, setDanmakuStars] = useState('★★★★★');

  const addDanmaku = (text: string, rawNick: string, stars: string) => {
    const nick = rawNick.trim() || (user ? user.name : "自在探索家");
    const newDanmaku = {
      text,
      name: nick,
      stars,
      lane: Math.floor(Math.random() * 3),
      speed: Math.floor(Math.random() * 8) + 16 // between 16 and 24 seconds duration
    };
    const updated = [newDanmaku, ...liveReviews];
    setLiveReviews(updated);
    
    // Save to user storage
    const customOnly = updated.filter(r => !initialReviews.some(i => i.text === r.text));
    localStorage.setItem('coffee_danmakus', JSON.stringify(customOnly));
  };

  // Load wishlist from localStorage based on user session context
  const storageKey = user ? `coffee_wishlist_${user.username}` : `coffee_wishlist_guest`;
  
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setWishlist(JSON.parse(stored));
      } catch (e) {
        setWishlist([]);
      }
    } else {
      setWishlist([]);
    }
  }, [storageKey]);

  // Save changes to state and LocalStorage
  const saveWishlist = (newWishlist: WishlistItem[]) => {
    setWishlist(newWishlist);
    localStorage.setItem(storageKey, JSON.stringify(newWishlist));
  };

  // Menu Items Definition
  const menuItems = [
    { id: 1, name: '温暖经典卡布奇诺', price: 30, category: 'coffee', img: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500', desc: '传统意式拼配现磨，绵密细腻的厚奶泡交融黄金油脂，附上古典肉桂微香。' },
    { id: 2, name: '衣索比亚耶加雪菲手冲', price: 34, category: 'coffee', img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500', desc: '庄园浅烘。优雅茉莉花香、澄亮柠檬柑橘风味、酸质纯净，回甘细腻温柔。' },
    { id: 3, name: '京都宇治抹茶拿铁', price: 28, category: 'tea', img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500', desc: '日本顶级宇治抹茶现刷，清润的绿意茶香交融温润醇厚新西兰牛乳。' },
    { id: 4, name: '皇家庄园伯爵红茶', price: 25, category: 'tea', img: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500', desc: '手选皇家伯爵红茶拼配，浸润清新佛手柑精油，口感澄澈爽快，散发优雅英伦气息。' },
    { id: 5, name: '拿破仑生椰厚乳特调', price: 32, category: 'coffee', img: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500', desc: '冷感厚醇生椰厚乳，注入饱满双份火山拼配浓缩，醇甜芳香在口腔回旋绽放。' },
    { id: 6, name: '纽约传统香草重乳酪蛋糕', price: 36, category: 'dessert', img: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=500', desc: '主慢火温水烘制。芝士层浓醇幼滑、入口即化，伴随淡淡马达加斯加香草籽香气。' },
    { id: 7, name: '意式传统手作正宗提拉米苏', price: 38, category: 'dessert', img: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=500', desc: '原浆马斯卡彭慕斯，微苦法芙娜可可粉、浸透咖啡酒指形饼，苦甜交感，风味无双。' },
    { id: 8, name: '英式红熟蔓越莓软司康', price: 18, category: 'dessert', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500', desc: '外皮金黄酥脆，麦香温和。融入精选红提蔓越莓干，每一口都酸甜香酥。' }
  ];

  // Switch display and select customize state in accordion
  const toggleQuickCustomize = (itemId: number) => {
    if (quickCustomizeItemId === itemId) {
      setQuickCustomizeItemId(null);
    } else {
      setQuickCustomizeItemId(itemId);
      // Reset defaults
      setQuickSize('大杯的大口满足 (Large)');
      setQuickSugar('半糖 (微甜恰到好处)');
      setQuickMilk('香浓冰鲜牛奶');
      setQuickTemp('少冰 (清凉解暑)');
      setQuickNotes('');
    }
  };

  // Add customized menu item to wishlist
  const handleAddCustomToWishlist = (item: typeof menuItems[0]) => {
    const wishId = 'wish-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    
    // Calculate custom price
    const hasSizeUp = quickSize.includes('Large') ? 3 : quickSize.includes('Venti') ? 5 : 0;
    const finalPrice = item.price + hasSizeUp;

    const newItem: WishlistItem = {
      wishId,
      itemId: item.id,
      name: item.name + ` (${quickSize.substring(0, 2)})`,
      price: finalPrice,
      category: item.category,
      img: item.img,
      sugar: quickSugar,
      milk: item.category === 'dessert' ? '甜点免额外乳底' : quickMilk,
      temp: item.category === 'dessert' ? '冷藏常温最佳' : quickTemp,
      size: quickSize,
      notes: quickNotes,
      addedAt: new Date().toISOString()
    };

    saveWishlist([newItem, ...wishlist]);
    setAddedAnimationId(item.id);
    setQuickCustomizeItemId(null); // fold panel
    
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1200);
  };

  // Quick default add back-up
  const handleAddToWishlistDefault = (item: typeof menuItems[0]) => {
    const wishId = 'wish-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newItem: WishlistItem = {
      wishId,
      itemId: item.id,
      name: item.name + ' (大杯)',
      price: item.price + 3, // Defaults to Large
      category: item.category,
      img: item.img,
      sugar: '半糖 (微甜恰到好处)',
      milk: item.category === 'dessert' ? '常温冷藏佳' : '香浓冰鲜牛奶',
      temp: item.category === 'dessert' ? '经典常温' : '少冰 (料足纯正)',
      size: '大杯的大口满足 (Large)',
      notes: '默认标准出杯',
      addedAt: new Date().toISOString()
    };
    saveWishlist([newItem, ...wishlist]);
    setAddedAnimationId(item.id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1200);
  };

  // Add custom builders to Wishlist
  const handleAddCustomCupToWishlist = () => {
    if (!customCupName.trim()) {
      alert('请为您的心意特调定义一个灵动学名吧！');
      return;
    }

    const wishId = 'custom-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const notesDetail = builderExtras.length > 0 ? `手作顶料: ${builderExtras.join(', ')}` : '独家匠心特配';

    const newItem: WishlistItem = {
      wishId,
      name: `★独家手作★ ` + customCupName,
      price: totalBuilderPrice,
      category: 'coffee',
      img: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=500',
      sugar: builderSugar,
      milk: builderMilk,
      temp: builderTemp,
      size: builderSize,
      notes: notesDetail,
      addedAt: new Date().toISOString()
    };

    saveWishlist([newItem, ...wishlist]);
    alert(`滴！已将您的专享温情特调「${customCupName}」完美写入您的心愿单卡片集合中。`);
    
    // Redirect
    setActiveTab('wishlist');
    setCustomCupName('午后治愈专属特调');
    setBuilderExtras([]);
  };

  // Delete single wishlist card
  const handleDeleteWishItem = (wishId: string) => {
    saveWishlist(wishlist.filter(item => item.wishId !== wishId));
  };

  // Inline update handler inside wishlist view
  const handleUpdateWishProps = (wishId: string, propName: 'sugar' | 'milk' | 'temp' | 'size' | 'notes', val: string) => {
    const updated = wishlist.map(item => {
      if (item.wishId === wishId) {
        // Adjust price dynamically if size changes
        let priceAdjust = item.price;
        if (propName === 'size') {
          const basePrice = item.price - (item.size.includes('Large') ? 3 : item.size.includes('Venti') ? 5 : 0);
          const newSizeUp = val.includes('Large') ? 3 : val.includes('Venti') ? 5 : 0;
          priceAdjust = basePrice + newSizeUp;
        }
        return { ...item, [propName]: val, price: priceAdjust };
      }
      return item;
    });
    saveWishlist(updated);
  };

  // Simulated ticket output
  const handleGenerateTicket = () => {
    const ticketId = 'LRS-' + Math.floor(1000 + Math.random() * 9000) + '-' + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    setReceiptNumber(ticketId);
    setShowReceipt(true);
  };

  // Support card
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSuccess(true);
    setTimeout(() => {
      setContactSuccess(false);
      (e.target as HTMLFormElement).reset();
    }, 4000);
  };

  const totalWishlistPrice = wishlist.reduce((sum, item) => sum + item.price, 0);

  return (
    <div id="coffee-shop-container" className="w-full">
      
      {/* ⛲ SCREEN A HERO - RENDERED FULL WIDTH AT THE TOP IF ON HOME TAB */}
      {activeTab === 'home' && (
        <div 
          id="visual-landing-hero"
          className="relative text-[#FAF9F5] min-h-[calc(100vh-80px)] w-full flex flex-col justify-center items-center text-center shadow-2xl p-6 md:p-12 border-none bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "linear-gradient(to bottom, rgba(15, 8, 4, 0.78), rgba(45, 26, 18, 0.92)), url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600')",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(#8B5A2B_1px,transparent_1.5px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

          <div className="relative z-10 max-w-4xl space-y-6 px-4">
            {/* Welcome text (small) */}
            <span className="text-[#C49A6C] text-xs font-bold tracking-[0.35em] uppercase block font-serif">
              ★ 𝔏𝔢𝔦𝔰𝔲𝔯𝔢𝔩𝔶 𝔖𝔭𝔞𝔠𝔢 𝔒𝔣 𝔖𝔬𝔲𝔩 ★
            </span>
            
            {/* Main title (large) */}
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-[#FAF9F5] font-serif tracking-tight border-b border-[#C49A6C]/30 pb-6 max-w-2xl mx-auto">
              慢煮光阴 · 手作纯真一杯
            </h1>
            
            {/* Subtitle */}
            <p className="text-stone-300 text-xs md:text-sm leading-relaxed max-w-2xl font-light mx-auto">
              在这里，没有冰冷的工业化量产，亦没有低质香精。我们选用极受推崇的耶加雪菲瑰夏原原豆，历经高级拼配，将温度与手作质感完整交还于您的指尖。
            </p>

            {/* Two CTA Buttons */}
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <button 
                onClick={() => setActiveTab('menu')}
                className="px-6 py-3 bg-[#8B5A2B] hover:bg-amber-800 text-[#FAF9F5] font-bold text-xs rounded-xl shadow-lg transition duration-200 border-none cursor-pointer font-serif"
              >
                🛎️ 特色手作茶点单
              </button>
              <button 
                onClick={() => setActiveTab('builder')}
                className="px-6 py-3 bg-[#FAF9F5] hover:bg-stone-100 text-[#5C3A21] font-bold text-xs rounded-xl shadow-md transition duration-200 border-none cursor-pointer font-serif"
              >
                🎨 去特调创意定制
              </button>
            </div>
          </div>

          {/* Scroll Down Indicator Arrow */}
          <div 
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 animate-bounce text-[#C49A6C] opacity-80 hover:opacity-100 transition cursor-pointer select-none"
            onClick={() => {
              const target = document.getElementById('cozy-announcement-header');
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            <span className="text-[9px] tracking-[0.25em] uppercase font-mono font-bold text-[#A88C74]">SCROLL DOWN</span>
            <ChevronDown className="w-5 h-5 text-[#C49A6C]" />
          </div>
        </div>
      )}

      {/* Main Grid Centered Content Wrapper (Rest of the application) */}
      <div className="max-w-6xl mx-auto px-4 py-12 w-full space-y-12">
        
        {/* Editorial Announcement Badge Bar */}
        <div id="cozy-announcement-header" className="flex flex-col md:flex-row items-center justify-between bg-[#EADECE]/40 border-y border-[#A88C74]/20 py-4 px-6 rounded-2xl mb-10 gap-4">
          <div className="flex items-center gap-2.5 text-xs text-[#5C3A21] tracking-wide font-medium">
            <span className="flex h-2 w-2 rounded-full bg-amber-700 animate-pulse shrink-0" />
            {user ? (
              <span className="flex items-center gap-2 flex-wrap">
                欢迎常驻尊贵会员 <strong className="font-extrabold">{user.name}</strong> (@{user.username})！您的专属特权已激活，当前心愿特配卡片已同步至云端数据库映射。
                {onLogout && (
                  <button 
                    onClick={onLogout} 
                    className="ml-2 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold border border-rose-200/50 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    🚪 安全注销退出
                  </button>
                )}
              </span>
            ) : (
              <span>
                您当前以 <span className="font-semibold italic">“自在游客身份”</span> 品鉴大堂。推荐极速 <button onClick={onNavigateToLogin} className="text-amber-900 underline font-black bg-transparent border-none p-0 cursor-pointer text-xs hover:text-amber-950 transition">会员登录</button> 获取您的终身特配心愿特快权限卡！
              </span>
            )}
          </div>
          
          {user ? (
            <span className="text-[10px] tracking-widest font-extrabold bg-[#5C3A21] text-[#FAF9F5] px-3.5 py-1 rounded-full uppercase shadow-xs">
              🏆 MEMBER CONNECTED
            </span>
          ) : (
            <span className="text-[10px] tracking-widest font-extrabold bg-[#A88C74]/20 text-[#5C3A21] px-3.5 py-1 rounded-full">
              ☕ COZY ROOM GUEST
            </span>
          )}
        </div>

        {/* vintage-style HTML Coffee Menu Nav */}
        <div id="cozy-serif-tabs" className="flex flex-wrap justify-center border-b border-[#A88C74]/30 mb-12 bg-transparent py-2 gap-1 sm:gap-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold tracking-wider transition-all border-b-2 bg-transparent cursor-pointer font-serif ${
              activeTab === 'home' 
                ? 'text-[#8B5A2B] border-[#8B5A2B] font-extrabold' 
                : 'text-stone-500 hover:text-[#5C3A21] border-transparent hover:border-[#A88C74]/30'
            }`}
          >
             Fountain ⛲ 悠然堂舍
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold tracking-wider transition-all border-b-2 bg-transparent cursor-pointer font-serif ${
              activeTab === 'menu' 
                ? 'text-[#8B5A2B] border-[#8B5A2B] font-extrabold' 
                : 'text-stone-500 hover:text-[#5C3A21] border-transparent hover:border-[#A88C74]/30'
            }`}
          >
            📖 手作茶点
          </button>
          <button 
            onClick={() => setActiveTab('builder')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold tracking-wider transition-all border-b-2 bg-transparent cursor-pointer font-serif ${
              activeTab === 'builder' 
                ? 'text-[#8B5A2B] border-[#8B5A2B] font-extrabold' 
                : 'text-stone-500 hover:text-[#5C3A21] border-transparent hover:border-[#A88C74]/30'
            }`}
          >
            🎨 私人特调房
          </button>
          <button 
            onClick={() => setActiveTab('wishlist')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold tracking-wider transition-all border-b-2 bg-transparent cursor-pointer relative font-serif ${
              activeTab === 'wishlist' 
                ? 'text-[#8B5A2B] border-[#8B5A2B] font-extrabold' 
                : 'text-stone-500 hover:text-[#5C3A21] border-transparent hover:border-[#A88C74]/30'
            }`}
          >
            ❤️ 心愿特配簿
            {wishlist.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold ring-2 ring-white animate-pulse">
                {wishlist.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('about')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold tracking-wider transition-all border-b-2 bg-transparent cursor-pointer font-serif ${
              activeTab === 'about' 
                ? 'text-[#8B5A2B] border-[#8B5A2B] font-extrabold' 
                : 'text-stone-500 hover:text-[#5C3A21] border-transparent hover:border-[#A88C74]/30'
            }`}
          >
            📜 匠人手记
          </button>
          <button 
            onClick={() => setActiveTab('contact')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold tracking-wider transition-all border-b-2 bg-transparent cursor-pointer font-serif ${
              activeTab === 'contact' 
                ? 'text-[#8B5A2B] border-[#8B5A2B] font-extrabold' 
                : 'text-stone-500 hover:text-[#5C3A21] border-transparent hover:border-[#A88C74]/30'
            }`}
          >
            📍 店铺联络
          </button>
        </div>

        {/* ==================== SCREEN A: COZY HOME ==================== */}
        {activeTab === 'home' && (
          <div id="cozy-home-screen" className="space-y-16 animate-fadeIn">

            {/* Core Philosophy Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#FAF9F5] border border-[#A88C74]/30 p-8 rounded-3xl shadow-xs text-center relative group">
              <div className="absolute top-2 right-4 text-[42px] font-serif text-[#C49A6C]/10 select-none">Ⅰ</div>
              <div className="w-16 h-16 bg-[#5C3A21]/5 text-[#5C3A21] rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl font-serif">
                🫘
              </div>
              <h3 className="text-base font-bold text-[#5C3A21] font-serif mb-2">甄选单源原产庄园</h3>
              <p className="text-xs text-stone-500 leading-relaxed font-light">
                每一粒生豆皆源自于海拔1800米以上遮阴山峦微气候，在黄金产区原罐直航锁水，锁闭更完整花果调。
              </p>
            </div>

            <div className="bg-[#FAF9F5] border border-[#A88C74]/30 p-8 rounded-3xl shadow-xs text-center relative group">
              <div className="absolute top-2 right-4 text-[42px] font-serif text-[#C49A6C]/10 select-none">Ⅱ</div>
              <div className="w-16 h-16 bg-[#5C3A21]/5 text-[#5C3A21] rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl font-serif">
                🎯
              </div>
              <h3 className="text-base font-bold text-[#5C3A21] font-serif mb-2">手磨温控匠气冲泡</h3>
              <p className="text-xs text-stone-500 leading-relaxed font-light">
                资深星级咖啡品鉴师亲手执壶，根据庄园气压与当日水分指标精挑萃取区间，拒绝敷衍的自动化量产。
              </p>
            </div>

            <div className="bg-[#FAF9F5] border border-[#A88C74]/30 p-8 rounded-3xl shadow-xs text-center relative group">
              <div className="absolute top-2 right-4 text-[42px] font-serif text-[#C49A6C]/10 select-none">Ⅲ</div>
              <div className="w-16 h-16 bg-[#5C3A21]/5 text-[#5C3A21] rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl font-serif">
                🎻
              </div>
              <h3 className="text-base font-bold text-[#5C3A21] font-serif mb-2">无压流速声学沙龙</h3>
              <p className="text-xs text-stone-500 leading-relaxed font-light">
                古典木构架、淡雅茶香及温柔轻快的黑胶爵士，在这里筑起不被打扰的清幽绿洲。
              </p>
            </div>
          </div>

          {/* Immersive Bullet Screen (Danmaku) Board & Client Form */}
          <div id="immersive-danmaku-board" className="bg-[#EADECE]/30 border border-[#A88C74]/30 rounded-3xl p-6 md:p-8 max-w-5xl mx-auto space-y-6 shadow-xs">
            
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-[#A88C74]/20 pb-4 gap-4">
              <div className="space-y-1">
                <span className="text-[#8B5A2B] font-bold text-[10px] tracking-wider uppercase font-serif block">★ GUEST ROOM BOARD ★</span>
                <h3 className="text-xl font-bold text-[#5C3A21] font-serif flex items-center gap-2">
                  <span>💬 悠然漫煮 · 实时回廊私语板</span>
                </h3>
                <p className="text-xs text-stone-500">来自全国各地的咖啡品鉴者在此留下的温暖心境弹幕（可在其上悬停鼠标暂停滚动）</p>
              </div>
              <div className="bg-[#8B5A2B]/10 rounded-xl px-3 py-1.5 border border-[#8B5A2B]/30 flex items-center gap-1.5 text-xs text-[#5C3A21] shrink-0 font-medium font-serif">
                <span>💭 当前累计私语:</span>
                <strong className="text-[#8B5A2B] font-bold font-mono">{liveReviews.length}</strong>
                <span>条</span>
              </div>
            </div>

            {/* Immersive Danmaku Scrolling Arena */}
            <div className="relative h-64 bg-stone-900 border border-[#8B5A2B]/25 rounded-2xl w-full select-none overflow-hidden shadow-inner flex flex-col justify-around py-4">
              {/* Decorative Background grid lines */}
              <div className="absolute inset-0 bg-[radial-gradient(#C49A6C_1px,transparent_1.5px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
              
              {/* Lane 0 */}
              <div className="relative w-full h-12 flex items-center overflow-hidden">
                <div className="absolute left-0 right-0 whitespace-nowrap flex gap-6">
                  {liveReviews.filter((_, i) => i % 3 === 0).map((item, index) => (
                    <div 
                      key={`lane0-${index}`}
                      className="inline-flex items-center gap-2.5 px-4.5 py-2.5 rounded-2xl whitespace-nowrap bg-[#FAF9F5]/95 hover:bg-white hover:scale-105 hover:border-[#8B5A2B] hover:shadow-lg hover:-translate-y-0.5 text-stone-950 border border-[#A88C74]/30 shadow-sm backdrop-blur-md cursor-pointer text-xs font-semibold animate-danmaku select-none transition-all duration-200"
                      style={{
                        animationDuration: `${item.speed || 24}s`,
                        animationDelay: `${index * 3.5}s`,
                      }}
                    >
                      <span className="text-[#8B5A2B] font-bold shrink-0 font-serif">☕ @{item.name}</span>
                      <span className="text-stone-700">{item.text}</span>
                      <span className="text-amber-500 font-bold tracking-tight shrink-0 text-[10px]">{item.stars}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lane 1 */}
              <div className="relative w-full h-12 flex items-center overflow-hidden border-y border-[#A88C74]/10 bg-[#5C3A21]/15">
                <div className="absolute left-0 right-0 whitespace-nowrap flex gap-6">
                  {liveReviews.filter((_, i) => i % 3 === 1).map((item, index) => (
                    <div 
                      key={`lane1-${index}`}
                      className="inline-flex items-center gap-2.5 px-4.5 py-2.5 rounded-2xl whitespace-nowrap bg-stone-800 hover:bg-stone-750 text-stone-50 hover:scale-105 hover:border-[#C49A6C] hover:shadow-lg hover:-translate-y-0.5 border border-stone-600 shadow-md backdrop-blur-md cursor-pointer text-xs font-semibold animate-danmaku select-none transition-all duration-200"
                      style={{
                        animationDuration: `${item.speed || 28}s`,
                        animationDelay: `${index * 4.2}s`,
                      }}
                    >
                      <span className="text-[#C49A6C] font-bold shrink-0 font-serif">🎨 @{item.name}</span>
                      <span className="text-stone-250">{item.text}</span>
                      <span className="text-[#C49A6C] font-bold tracking-tight shrink-0 text-[10px]">{item.stars}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lane 2 */}
              <div className="relative w-full h-12 flex items-center overflow-hidden">
                <div className="absolute left-0 right-0 whitespace-nowrap flex gap-6">
                  {liveReviews.filter((_, i) => i % 3 === 2).map((item, index) => (
                    <div 
                      key={`lane2-${index}`}
                      className="inline-flex items-center gap-2.5 px-4.5 py-2.5 rounded-2xl whitespace-nowrap bg-[#FAF9F5]/95 hover:bg-white hover:scale-105 hover:border-[#8B5A2B] hover:shadow-lg hover:-translate-y-0.5 text-stone-950 border border-[#A88C74]/30 shadow-sm backdrop-blur-md cursor-pointer text-xs font-semibold animate-danmaku select-none transition-all duration-200"
                      style={{
                        animationDuration: `${item.speed || 22}s`,
                        animationDelay: `${index * 5.1}s`,
                      }}
                    >
                      <span className="text-[#8B5A2B] font-bold shrink-0 font-serif">🌸 @{item.name}</span>
                      <span className="text-stone-700">{item.text}</span>
                      <span className="text-amber-500 font-bold tracking-tight shrink-0 text-[10px]">{item.stars}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Submit Form below bullet wall */}
            <div className="bg-white border border-[#A88C74]/15 rounded-2xl p-5 shadow-xs">
              <h4 className="text-xs font-extrabold text-[#5C3A21] mb-3 flex items-center gap-2 font-serif">
                <span>🏮 快留下一条属于您的“心境私语弹幕”：</span>
              </h4>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!danmakuInputText.trim()) return;
                  addDanmaku(danmakuInputText, danmakuInputNick, danmakuStars);
                  setDanmakuInputText('');
                }}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                {/* Nickname input */}
                <div className="md:col-span-3 text-xs">
                  <label className="block text-[10px] text-stone-500 font-bold mb-1">您的尊雅称呼 (Name)</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 bg-[#FAF9F5] border border-stone-200 rounded-xl focus:outline-none focus:border-[#5C3A21] focus:bg-white text-xs text-stone-800 font-medium"
                    placeholder={user ? `${user.name} (已连结)` : "如“浮生旅客”，默认匿名"}
                    disabled={!!user}
                    value={user ? user.name : danmakuInputNick}
                    onChange={(e) => setDanmakuInputNick(e.target.value)}
                  />
                </div>

                {/* Stars select */}
                <div className="md:col-span-2 text-xs">
                  <label className="block text-[10px] text-stone-500 font-bold mb-1">美味评级 (Star)</label>
                  <select 
                    value={danmakuStars}
                    onChange={(e) => setDanmakuStars(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF9F5] border border-stone-200 rounded-xl focus:outline-none focus:border-[#5C3A21] focus:bg-white text-xs text-stone-800"
                  >
                    <option value="★★★★★">★★★★★ 臻品推荐</option>
                    <option value="★★★★☆">★★★★☆ 醇正可口</option>
                    <option value="★★★☆☆">★★★☆☆ 风味普通</option>
                  </select>
                </div>

                {/* Sentence text */}
                <div className="md:col-span-5 text-xs">
                  <label className="block text-[10px] text-stone-500 font-bold mb-1">写点暖心说辞吧 (Message) *</label>
                  <input 
                    required
                    type="text" 
                    maxLength={60}
                    className="w-full p-2.5 bg-[#FAF9F5] border border-stone-200 rounded-xl focus:outline-none focus:border-[#5C3A21] focus:bg-white text-xs text-[#5C3A21] font-semibold"
                    placeholder="手冲瑰夏原香馥郁，让人忘却周遭喧喧扰扰... ☕"
                    value={danmakuInputText}
                    onChange={(e) => setDanmakuInputText(e.target.value)}
                  />
                </div>

                {/* Button */}
                <div className="md:col-span-2">
                  <button 
                    type="submit" 
                    className="w-full py-2.5 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold rounded-xl transition-all font-serif text-xs border-none cursor-pointer shadow-sm active:scale-95"
                  >
                    🚀 发送弹幕私语
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Member persistent lock block */}
          <div className="bg-gradient-to-r from-[#8B5A2B]/10 to-transparent border border-[#8B5A2B]/20 p-8 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-[#8B5A2B] text-white inline-block">会员心愿互通卡</span>
              <h3 className="text-sm font-bold text-[#5C3A21] font-serif">开启全数据同步，保存专属高定秘方</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                普通访客记录重新加载可能遗失。一键登录标准管理账号（帐号: <strong className="font-mono">admin</strong> / 密码: <strong className="font-mono">adminpassword</strong>）可立即读取底层系统数据库。
              </p>
            </div>
            <button 
              onClick={user ? () => setActiveTab('wishlist') : onNavigateToLogin}
              className="px-5 py-3 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold text-xs rounded-xl shadow transition duration-200 border-none cursor-pointer font-serif shrink-0 animate-bounce"
            >
              {user ? '📓 查看我的特调簿' : '🔓 授权登录'}
            </button>
          </div>

        </div>
      )}

      {/* ==================== SCREEN B: SPECIAL MENU ==================== */}
      {activeTab === 'menu' && (
        <div id="cozy-menu-screen" className="space-y-10 animate-fadeIn">
          
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-[#5C3A21] font-serif">
              📖 拾光手作茶点清单
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              我们仅使用新西兰全脂冰牛奶与燕麦植物奶，决绝一切低劣植脂末。全脂糖浆可选择更温和天然的木糖甜素。
            </p>
          </div>

          {/* Category selection */}
          <div className="flex justify-center gap-2 flex-wrap pb-4">
            {(['all', 'coffee', 'tea', 'dessert'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setMenuFilter(cat)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition border-none cursor-pointer font-serif ${
                  menuFilter === cat 
                    ? 'bg-[#5C3A21] text-white shadow-md' 
                    : 'bg-[#FAF9F5] hover:bg-[#EADECE]/20 text-[#5C3A21] border border-[#A88C74]/40'
                }`}
              >
                {cat === 'all' ? '全部手作 (All) 🍵' : cat === 'coffee' ? '手磨咖啡拼配' : cat === 'tea' ? '庄园原叶古茶' : '意式精烤甜点'}
              </button>
            ))}
          </div>

          {/* Menu list with inline specs accordion! */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {menuItems
              .filter(item => menuFilter === 'all' || item.category === menuFilter)
              .map(item => {
                const isQuickCustomOpen = quickCustomizeItemId === item.id;
                const matchesSavedCount = wishlist.filter(w => w.itemId === item.id).length;

                return (
                  <div key={item.id} className="bg-white border border-[#A88C74]/20 rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition duration-300 flex flex-col h-full transform hover:-translate-y-1">
                    
                    {/* Upper cover row */}
                    <div className="flex flex-col sm:flex-row">
                      <div className="w-full sm:w-44 h-48 sm:h-auto relative bg-[#FAF9F5] overflow-hidden shrink-0">
                        <img 
                          src={item.img} 
                          alt={item.name} 
                          referrerPolicy="no-referrer" 
                          className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" 
                        />
                        <span className="absolute top-3 left-3 bg-[#5C3A21] text-white px-3 py-1 text-xs font-bold font-serif rounded-lg">
                          ¥ {item.price}
                        </span>
                      </div>

                      <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-bold text-[#5C3A21] font-serif">
                              {item.name}
                            </h4>
                            <span className="text-[9px] uppercase font-mono tracking-widest bg-[#EADECE]/40 text-[#5C3A21] px-2.5 py-0.5 rounded font-bold">
                              {item.category}
                            </span>
                          </div>
                          
                          <p className="text-xs text-stone-500 leading-relaxed font-light">
                            {item.desc}
                          </p>
                        </div>

                        {/* Control toggles */}
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => toggleQuickCustomize(item.id)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-serif transition border-none cursor-pointer ${
                              isQuickCustomOpen 
                                ? 'bg-amber-800 text-white' 
                                : 'bg-[#EADECE]/30 hover:bg-[#5C3A21]/10 text-[#5C3A21]'
                            }`}
                          >
                            {isQuickCustomOpen ? '⚙️ 折叠参数配方' : '🎯 制定高定制参'}
                          </button>

                          <button 
                            type="button"
                            onClick={() => handleAddToWishlistDefault(item)}
                            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition border-none cursor-pointer flex items-center justify-center gap-1"
                            title="默认加入心愿单"
                          >
                            <Heart className={`w-4 h-4 ${addedAnimationId === item.id ? 'fill-rose-600 text-rose-600 animate-ping' : 'text-rose-500'}`} />
                            {matchesSavedCount > 0 && (
                              <span className="text-[10px] font-bold font-mono">({matchesSavedCount})</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Quick SPEC customization tray! */}
                    {isQuickCustomOpen && (
                      <div className="border-t-2 border-dashed border-[#A88C74]/20 bg-[#FAF9F5] p-5 space-y-4 animate-fadeIn">
                        <div className="text-[11px] font-bold text-[#5C3A21]/90 flex items-center gap-1 border-b border-[#A88C74]/10 pb-2">
                          <span>⚙️</span>
                          <span>自定义「{item.name}」风味参数，完成后添加至心愿卡</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {/* Size Selection */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-stone-400">选择杯型规格(Size)</label>
                            <select 
                              value={quickSize}
                              onChange={(e) => setQuickSize(e.target.value)}
                              className="w-full text-[11px] p-2 rounded-lg bg-white border border-stone-200 focus:outline-[#5C3A21]"
                            >
                              <option>中杯的轻盈体验 (Medium)</option>
                              <option>大杯的大口满足 (Large) (+¥3)</option>
                              <option>超大杯的饱满爽口 (Venti) (+¥5)</option>
                            </select>
                          </div>

                          {/* Sweetness */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-stone-400">加糖配料比例(Sugar)</label>
                            <select 
                              value={quickSugar}
                              onChange={(e) => setQuickSugar(e.target.value)}
                              className="w-full text-[11px] p-2 rounded-lg bg-white border border-stone-200 focus:outline-[#5C3A21]"
                            >
                              <option>天然零蔗木糖纯素 (Sugar-free)</option>
                              <option>三分糖 (微甜微醇)</option>
                              <option>半糖 (微甜恰到好处)</option>
                              <option>标准全糖糖浆喷花</option>
                            </select>
                          </div>

                          {/* Milk base */}
                          {item.category !== 'dessert' && (
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-bold text-stone-400">选择乳底配方(Milk)</label>
                              <select 
                                value={quickMilk}
                                onChange={(e) => setQuickMilk(e.target.value)}
                                className="w-full text-[11px] p-2 rounded-lg bg-white border border-stone-200 focus:outline-[#5C3A21]"
                              >
                                <option>香浓冰鲜牛奶</option>
                                <option>燕麦奶 (浓郁谷香) (+¥3)</option>
                                <option>生椰厚乳特调 (+¥4)</option>
                                <option>经典黑美式出杯 (不含乳成分)</option>
                              </select>
                            </div>
                          )}

                          {/* Temp */}
                          {item.category !== 'dessert' && (
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-bold text-stone-400">选择适饮温度(Temp)</label>
                              <select 
                                value={quickTemp}
                                onChange={(e) => setQuickTemp(e.target.value)}
                                className="w-full text-[11px] p-2 rounded-lg bg-white border border-stone-200 focus:outline-[#5C3A21]"
                              >
                                <option>标准热饮 (最醇厚香气)</option>
                                <option>常温不额外加冰</option>
                                <option>少冰 (清凉解暑)</option>
                                <option>极低多冰极速锁鲜 (Extra Ice)</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Private note text input */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-stone-400">特殊配送与杯身备注 (Notes)</label>
                          <input 
                            type="text"
                            value={quickNotes}
                            onChange={(e) => setQuickNotes(e.target.value)}
                            placeholder="如：微量可可、需要附吸管、极速打包出餐"
                            className="w-full text-[11px] p-2.5 rounded-lg bg-white border border-stone-100 placeholder:text-stone-300 focus:outline-[#5C3A21]"
                          />
                        </div>

                        {/* Submit */}
                        <button
                          type="button"
                          onClick={() => handleAddCustomToWishlist(item)}
                          className="w-full py-2.5 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold rounded-xl text-xs font-serif transition border-none cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          保存风味参数并写入心愿本
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
          </div>

        </div>
      )}

      {/* ==================== SCREEN C: CUSTOM CUP BUILDER ==================== */}
      {activeTab === 'builder' && (
        <div id="cozy-builder-screen" className="space-y-10 animate-fadeIn max-w-5xl mx-auto">
          
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-[#8B5A2B] font-bold text-[10px] tracking-widest uppercase font-serif block">
              𝔗𝔥𝔢 ℭ𝔲𝔰𝔱𝔬𝔪𝔦𝔷𝔢𝔯
            </span>
            <h2 className="text-2xl font-bold text-[#5C3A21] font-serif">
              🎨 悠然私人特制调茶研制室
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              根据您的内心灵感调协独属单杯。您可以自由定制各种气调基底、特殊温控、加糖和顶级配料，我们会生成独一无二的纪念单杯！
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Options Panel */}
            <div className="lg:col-span-7 bg-[#FAF9F5] p-6 md:p-8 rounded-3xl border border-[#A88C74]/30 space-y-6">
              
              {/* Step 1: Base */}
              <div className="space-y-3.5">
                <label className="text-xs font-bold text-[#5C3A21] flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#5C3A21]/10 text-[#5C3A21] rounded-full text-[10px] font-bold flex items-center justify-center font-mono">1</span>
                  选择专属饮品茶点基底 *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: '手冲耶加雪菲', price: 32, desc: '中浅焙。明亮柑橘、花香四溢' },
                    { name: '埃塞瑰夏庄园顶选手冲', price: 38, desc: '极品高海拔。桃香丰沛饱满、超强回甘' },
                    { name: '炭焙深烘意式浓缩底', price: 26, desc: '黑巧克力拼配烟熏焦涩韵，油脂极其丰沛' },
                    { name: '英德红熟正山小种茶底', price: 24, desc: '名茶拼配。高雅温热正山松香，韵致沉稳' }
                  ].map(b => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => { setBuilderBase(b.name); setBuilderBasePrice(b.price); }}
                      className={`p-3.5 text-left rounded-xl transition-all border text-xs flex flex-col justify-between ${
                        builderBase === b.name 
                          ? 'border-[#5C3A21] bg-[#FAF7F2] ring-1 ring-[#5C3A21]' 
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <span className="font-bold text-[#5C3A21] font-serif">{b.name}</span>
                      <span className="text-[10px] text-stone-400 mt-1 leading-normal">{b.desc}</span>
                      <span className="text-[10px] text-[#8B5A2B] font-bold mt-2">基准值: ¥{b.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Milk */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#5C3A21] flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#5C3A21]/10 text-[#5C3A21] rounded-full text-[10px] font-bold flex items-center justify-center font-mono">2</span>
                  选择乳制品基底调和 *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: '香浓冰鲜牛奶', price: 3 },
                    { name: '生椰厚醇乳', price: 5 },
                    { name: '特级黑燕麦奶', price: 4 },
                    { name: '单纯清淡美式 (无奶/茶)', price: 0 }
                  ].map(m => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => { setBuilderMilk(m.name); setBuilderMilkPrice(m.price); }}
                      className={`p-3 text-center rounded-xl text-xs transition border flex flex-col items-center justify-center gap-1 ${
                        builderMilk === m.name 
                          ? 'border-[#5C3A21] bg-[#FAF7F2] font-bold text-[#5C3A21]' 
                          : 'border-stone-100 bg-white hover:bg-stone-50 text-stone-600'
                      }`}
                    >
                      <span className="text-[11px] font-medium leading-tight">{m.name.split(' ')[0]}</span>
                      <span className="text-[10px] text-[#8B5A2B] font-mono leading-none">+{m.price === 0 ? '免费' : `¥${m.price}`}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Size & Spec */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#5C3A21]">选择出水规格</label>
                  <select 
                    value={builderSize}
                    onChange={(e) => setBuilderSize(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-[#5C3A21]"
                  >
                    <option>中杯的轻盈体验 (Medium)</option>
                    <option>大杯的大口满足 (Large) (+¥3)</option>
                    <option>超大杯的饱满爽口 (Venti) (+¥5)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#5C3A21]">温差控制</label>
                  <select 
                    value={builderTemp}
                    onChange={(e) => setBuilderTemp(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-[#5C3A21]"
                  >
                    <option>标准热饮 (最醇厚香气)</option>
                    <option>常温不额外加冰</option>
                    <option>少冰 (清凉解暑)</option>
                    <option>多冰 (Full Ice)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#5C3A21]">选用糖分</label>
                  <select 
                    value={builderSugar}
                    onChange={(e) => setBuilderSugar(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-white border border-stone-200 focus:outline-[#5C3A21]"
                  >
                    <option>天然零蔗木糖纯素 (0%)</option>
                    <option>三分糖 (微甜微醇)</option>
                    <option>半糖 (微甜恰到合适)</option>
                    <option>标准糖分 (100%)</option>
                  </select>
                </div>
              </div>

              {/* Extras Toppings */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#5C3A21] flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#5C3A21]/10 text-[#5C3A21] rounded-full text-[10px] font-bold flex items-center justify-center font-mono">3</span>
                  添加奢享顶料高定加料 (支持复杂多选)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {extraOptions.map(opt => {
                    const isChecked = builderExtras.includes(opt.name);
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setBuilderExtras(builderExtras.filter(e => e !== opt.name));
                          } else {
                            setBuilderExtras([...builderExtras, opt.name]);
                          }
                        }}
                        className={`p-3 text-left rounded-xl text-xs border transition flex items-center justify-between ${
                          isChecked
                            ? 'border-[#5C3A21] bg-[#FAF7F2] font-semibold text-[#5C3A21]'
                            : 'border-stone-200 bg-white hover:bg-[#EADECE]/10 text-stone-600'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-4.5 h-4.5 rounded flex items-center justify-center text-[10px] border ${
                            isChecked ? 'bg-[#5C3A21] text-white border-[#5C3A21]' : 'border-stone-300'
                          }`}>
                            {isChecked && '✓'}
                          </span>
                          {opt.name}
                        </span>
                        <span className="font-bold text-[#8B5A2B] font-mono">+¥{opt.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cup Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#5C3A21]">为此杯研制成果冠上您的手笔灵动名称</label>
                <input 
                  type="text" 
                  value={customCupName}
                  onChange={(e) => setCustomCupName(e.target.value)}
                  placeholder="例：元气周一专属唤醒瑰夏、雨后森林抹茶风光"
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-[#5C3A21] font-semibold bg-white"
                />
              </div>

            </div>

            {/* Simulated Live Preview Card */}
            <div className="lg:col-span-5 bg-[#FAF9F5] p-6 md:p-8 rounded-3xl border border-[#A88C74]/30 flex flex-col justify-between h-full gap-8 sticky top-24">
              
              <div className="space-y-6">
                <h3 className="flex items-center gap-1.5 text-[#5C3A21] text-xs font-bold tracking-wider uppercase font-serif">
                  <Sparkles className="w-4 h-4 text-[#8B5A2B]" />
                  <span>实时研制成杯预览 · 𝔖𝔪𝔞𝔯𝔱 𝔓𝔯𝔢𝔳𝔦𝔢𝔴</span>
                </h3>

                {/* Simulated Vintage Cup Wrapper */}
                <div className="relative py-12 bg-white border border-stone-200 rounded-2xl flex flex-col items-center justify-center shadow-inner-sm overflow-hidden p-4">
                  <div className="absolute top-2 left-3 uppercase font-mono tracking-widest text-[8px] font-bold text-stone-350">
                    * BOTTLED AND PRESERVED BY LEISURELY *
                  </div>

                  {/* Glass layout */}
                  <div className="w-24 h-40 bg-stone-50 rounded-b-3xl rounded-t-lg relative border-4 border-stone-800 flex items-end overflow-hidden pb-4 shadow-md">
                    {/* Fill fluids dynamically */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 transition-all duration-300 bg-gradient-to-t"
                      style={{ 
                        height: builderMilk.includes('无奶') ? '80%' : '68%',
                        width: '100%',
                        backgroundImage: builderMilk.includes('无奶') 
                          ? 'linear-gradient(to top, #1A0D00, #3C1E08)' 
                          : 'linear-gradient(to top, #4E3420, #E4D5C5)' 
                      }} 
                    />
                    
                    {/* Extra Cream line */}
                    {builderExtras.includes('喜马拉雅玫瑰盐芝士奶盖') && (
                      <div className="absolute top-[32%] left-0 right-0 h-6 bg-amber-50 rounded-full text-[8px] text-amber-900 text-center font-bold tracking-tighter shadow-sm flex items-center justify-center">
                        🧀 CHESS COAT
                      </div>
                    )}

                    {/* Cold Ice particles */}
                    {builderTemp.includes('冰') && (
                      <div className="absolute top-[48%] left-1/4 right-1/4 flex justify-between animate-bounce">
                        <span className="w-2 h-2 bg-blue-100/40 rounded-xs" />
                        <span className="w-2 h-2 bg-blue-50/35 rounded-xs" />
                        <span className="w-2 h-2 bg-blue-200/50 rounded-xs" />
                      </div>
                    )}

                    <span className="w-full relative z-10 text-center font-serif text-[10px] text-white drop-shadow-md font-bold truncate px-1 block mb-2">
                      {customCupName}
                    </span>
                  </div>

                  <div className="mt-5 text-center space-y-1">
                    <h5 className="text-xs font-bold text-[#5C3A21] font-serif">{customCupName}</h5>
                    <p className="text-[10px] text-stone-400 font-mono">Formula: {builderBase}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs border-t border-dashed border-stone-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-stone-400">研制主基底:</span>
                    <span className="font-bold text-[#5C3A21]/90">{builderBase} (¥{builderBasePrice})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">气浸调和乳:</span>
                    <span className="font-bold text-[#5C3A21]/90">{builderMilk} (¥{builderMilkPrice})</span>
                  </div>
                  <div className="flex justify-between border-b border-stone-100 pb-2">
                    <span className="text-stone-400">规格/糖温:</span>
                    <span className="font-bold text-[#5C3A21]/90">{builderSize.substring(0, 2)} / {builderSugar.substring(0, 3)} / {builderTemp.substring(0, 2)}</span>
                  </div>
                  {builderExtras.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-stone-400">附奢加料:</span>
                      <span className="font-bold text-[#5C3A21] text-right text-[10px] max-w-[180px] truncate block">
                        {builderExtras.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-stone-200 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5C3A21]">合计折后价 (Estimated Price):</span>
                  <span className="text-xl font-bold font-serif text-rose-700">¥ {totalBuilderPrice}</span>
                </div>
                
                <button
                  type="button"
                  onClick={handleAddCustomCupToWishlist}
                  className="w-full py-3 bg-[#5C3A21] hover:bg-amber-950 text-white font-extrabold text-xs rounded-xl shadow transition duration-200 border-none cursor-pointer font-serif flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  保存调协配方并保存至心愿卡
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ==================== SCREEN D: ❤️ ENHANCED WISHLIST ==================== */}
      {activeTab === 'wishlist' && (
        <div id="cozy-wishlist-screen" className="space-y-8 animate-fadeIn">
          
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-[#5C3A21] font-serif">
              ❤️ 私人高定心愿风味特配簿
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              这里记录了您在悠然大堂心系过的每一杯温情。支持极度自由的独立风味修改，更能完美一键导出收银台扫码纪念提单！
            </p>
          </div>

          {wishlist.length === 0 ? (
            <div className="bg-[#FAF9F5] border-2 border-dashed border-[#A88C74]/30 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                ♥
              </div>
              <h3 className="text-base font-bold text-[#5C3A21] font-serif">您当前的手作心愿单为空色</h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
                快去游览我们的 “手作茶点清单” 或 “调茶研制室” 配置属于您的心系饮品，再把它们打包存进这里！
              </p>
              <div className="flex gap-2.5 justify-center pt-2">
                <button
                  onClick={() => setActiveTab('menu')}
                  className="px-5 py-2.5 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold text-xs rounded-xl border-none cursor-pointer shadow font-serif"
                >
                  🛎️ 挑选手作茶点
                </button>
                <button
                  onClick={() => setActiveTab('builder')}
                  className="px-5 py-2.5 bg-[#EADECE]/30 hover:bg-[#EADECE]/50 text-[#5C3A21] font-bold text-xs rounded-xl border-none cursor-pointer font-serif"
                >
                  🧪 创意研配
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-5xl mx-auto">
              
              {/* Filter controls / summary details */}
              <div className="bg-[#EADECE]/20 border border-[#A88C74]/20 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-[#5C3A21] leading-relaxed">
                  您目前一共收藏了 <strong className="font-extrabold font-serif text-lg text-[#8B5A2B]">{wishlist.length}</strong> 份温情茶点。
                  随时可一键生成印制提货风味卡单，展示给大堂咖啡师一键调和。
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-xs font-semibold text-[#5C3A21]">
                    累计预估总花费: <strong className="text-rose-700 font-serif text-lg">¥{totalWishlistPrice}</strong>
                  </div>
                  
                  <button 
                    onClick={() => { if (window.confirm('确认清空您珍藏的全部风味特配单吗？')) saveWishlist([]); }}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border-none cursor-pointer font-serif"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清空特配单
                  </button>
                </div>
              </div>

              {/* Action Buttons to print tickets */}
              <div className="flex justify-end gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateTicket}
                  className="px-6 py-3 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold rounded-xl text-xs font-serif transition border-none cursor-pointer flex items-center gap-2 shadow-lg"
                >
                  <FileText className="w-4 h-4" />
                  🧾 导出生成悠然堂食提货卡单
                </button>
              </div>

              {/* Wishlist grid items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {wishlist.map((item) => (
                  <div key={item.wishId} className="bg-white border border-[#A88C74]/20 p-5 rounded-3xl shadow-xs relative group hover:shadow-md transition-shadow space-y-4">
                    
                    {/* Delete item */}
                    <button 
                      onClick={() => handleDeleteWishItem(item.wishId)}
                      className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-rose-600 bg-stone-50 hover:bg-rose-50 rounded-lg transition border-none cursor-pointer"
                      title="删除此项"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* item description header inside list */}
                    <div className="flex gap-4 items-start pr-8">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                        <img src={item.img} alt={item.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                      
                      <div className="space-y-1 flex-1">
                        <span className="text-[9px] uppercase font-mono px-2 py-0.5 bg-[#FAF7F2] border border-[#A88C74]/30 rounded text-[#8B5A2B] font-bold inline-block leading-none">
                          {item.itemId ? '大堂精选' : '研调高定'}
                        </span>
                        <h4 className="text-xs font-bold text-[#5C3A21] font-serif pr-2 line-clamp-1">{item.name}</h4>
                        <p className="text-xs text-rose-700 font-bold font-mono">单价: ¥{item.price}</p>
                      </div>
                    </div>

                    {/* Highly Interactive spec updating controls directly within wishlist items ! */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px] bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#A88C74]/15">
                      
                      {/* Cup Size */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-stone-400 block">修改出水杯型</span>
                        <select 
                          value={item.size} 
                          onChange={(e) => handleUpdateWishProps(item.wishId, 'size', e.target.value)}
                          className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-bold text-stone-700 focus:outline-[#5C3A21]"
                        >
                          <option>中杯的轻盈体验 (Medium)</option>
                          <option>大杯的大口满足 (Large)</option>
                          <option>超大杯的饱满爽口 (Venti)</option>
                        </select>
                      </div>

                      {/* Sugar specification update */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-stone-400 block">修改微调甜度</span>
                        <select 
                          value={item.sugar} 
                          onChange={(e) => handleUpdateWishProps(item.wishId, 'sugar', e.target.value)}
                          className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-semibold text-stone-700 focus:outline-[#5C3A21]"
                        >
                          <option>天然零蔗木糖纯素 (0%)</option>
                          <option>三分糖 (微甜微醇)</option>
                          <option>半糖 (微甜恰到合适)</option>
                          <option>标准糖分 (100%)</option>
                        </select>
                      </div>

                      {/* Milk spec update */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-stone-400 block">修改乳制品</span>
                        <select 
                          value={item.milk} 
                          onChange={(e) => handleUpdateWishProps(item.wishId, 'milk', e.target.value)}
                          className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-semibold text-stone-700 focus:outline-[#5C3A21]"
                        >
                          <option>香浓冰鲜牛奶</option>
                          <option>低脂燕麦奶 (谷物浓郁)</option>
                          <option>生椰厚醇乳 (椰丝清香)</option>
                          <option>不含乳产品 (黑美式)</option>
                        </select>
                      </div>

                      {/* Temp spec update */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-stone-400 block">选用出水温度</span>
                        <select 
                          value={item.temp} 
                          onChange={(e) => handleUpdateWishProps(item.wishId, 'temp', e.target.value)}
                          className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-semibold text-stone-700 focus:outline-[#5C3A21]"
                        >
                          <option>标准热饮 (最醇厚香气)</option>
                          <option>少冰 (清凉爽口)</option>
                          <option>多冰 (降温冰冷)</option>
                          <option>常温状态</option>
                        </select>
                      </div>

                    </div>

                    {/* Note input update */}
                    <div className="space-y-1.5 text-[11px]">
                      <span className="text-[9px] font-bold text-stone-400">特配备注或现场招待交代备注</span>
                      <input 
                        type="text" 
                        value={item.notes}
                        onChange={(e) => handleUpdateWishProps(item.wishId, 'notes', e.target.value)}
                        placeholder="如：带打包架独立打包、另外附带杯托..."
                        className="w-full p-2.5 rounded-xl bg-[#FAF9F5] border border-stone-100 text-[10px] placeholder:text-stone-300 focus:outline-[#5C3A21] focus:bg-white"
                      />
                    </div>

                    {/* Footer bar for wishlist cards */}
                    <div className="flex items-center justify-between text-[10px] text-stone-400 border-t border-stone-100 pt-3.5 font-mono">
                      <span>单据ID: {item.wishId}</span>
                      <span>收录于: {new Date(item.addedAt).toLocaleDateString()}</span>
                    </div>

                  </div>
                ))}
              </div>

            </div>
          )}

        </div>
      )}

      {/* ==================== SCREEN E: COZY ABOUT STORIES ==================== */}
      {activeTab === 'about' && (
        <div id="cozy-about-screen" className="space-y-12 animate-fadeIn max-w-4xl mx-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white p-6 md:p-8 rounded-3xl border border-[#A88C74]/20 shadow-xs">
            <div className="rounded-2xl overflow-hidden h-72 border border-stone-200">
              <img src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800" alt="vintage interior" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </div>

            <div className="space-y-4">
              <span className="px-2 py-0.5 text-[9px] bg-[#EADECE]/40 text-[#5C3A21] font-bold rounded font-serif">
                📜 悠然人文手记
              </span>
              <h3 className="text-xl font-bold text-[#5C3A21] font-serif">
                从产地浆果到一杯纯透的漫漫修业
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed font-light">
                悠然后堂起源于几个誓要捍卫纯真手制风味的年轻品鉴主理。我们深感机器快速淬取将咖啡果肉里美妙、独特的焦糖及熟杏水果甜酸，扼杀成为干涸枯涩的咖啡苦因。
              </p>
              <p className="text-xs text-stone-500 leading-relaxed font-light">
                因此，我们奔走在安第斯山陡峭山梁，在阳光下翻晒耶加雪菲。我们深信手作温度能为生活平添一丝真实的舒朗。
              </p>

              <div className="grid grid-cols-3 gap-3 border-t border-stone-100 pt-4 text-center">
                <div>
                  <span className="block text-base font-bold text-amber-800 font-serif">1800m+</span>
                  <span className="text-[9px] text-stone-400">海拔遮阳庄园豆</span>
                </div>
                <div>
                  <span className="block text-base font-bold text-amber-800 font-serif">300s</span>
                  <span className="text-[9px] text-stone-400">黄金风速慢烘</span>
                </div>
                <div>
                  <span className="block text-base font-bold text-amber-800 font-serif">100%</span>
                  <span className="text-[9px] text-stone-400">无植物无反脂肪</span>
                </div>
              </div>
            </div>
          </div>

          {/* Core masters */}
          <div className="space-y-5">
            <h4 className="text-center text-xs font-bold tracking-widest text-[#5C3A21]/75 font-serif uppercase">
              ★ 悠然手作大师群谱 · THE CRAFTSMEN ★
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              
              <div className="bg-[#FAF9F5] border border-[#A88C74]/20 p-6 rounded-2xl shadow-xs text-center">
                <div className="w-20 h-20 bg-[#FAF9F5] rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden border border-[#A88C74]/30">
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200" alt="Master Zhang" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <h5 className="text-xs font-bold text-[#5C3A21] font-serif">张大国 · Master Roaster</h5>
                <p className="text-[9px] text-amber-800 font-bold mt-0.5">主理首席烘豆大师</p>
                <p className="text-[10px] text-stone-500 mt-2.5 leading-relaxed font-light">
                  SCA终身品鉴讲师。将深焙油脂调出焦香巧克力韵意，把控每一炉明澄果酸。
                </p>
              </div>

              <div className="bg-[#FAF9F5] border border-[#A88C74]/20 p-6 rounded-2xl shadow-xs text-center">
                <div className="w-20 h-20 bg-[#FAF9F5] rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden border border-[#A88C74]/30">
                  <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200" alt="Master Wu" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <h5 className="text-xs font-bold text-[#5C3A21] font-serif">吴娟娟 · Patisserie Expert</h5>
                <p className="text-[9px] text-amber-800 font-bold mt-0.5">首席西点研发总监</p>
                <p className="text-[10px] text-stone-500 mt-2.5 leading-relaxed font-light">
                  留法知名烘焙教授弟子。坚持手工低温打发马斯卡彭干酪层，重现古典甜品灵魂。
                </p>
              </div>

              <div className="bg-[#FAF9F5] border border-[#A88C74]/20 p-6 rounded-2xl shadow-xs text-center">
                <div className="w-20 h-20 bg-[#FAF9F5] rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden border border-[#A88C74]/30">
                  <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200" alt="Master Chen" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <h5 className="text-xs font-bold text-[#5C3A21] font-serif">陈晨 · Brewmaster</h5>
                <p className="text-[9px] text-amber-800 font-bold mt-0.5">拉花技术大堂监制</p>
                <p className="text-[10px] text-stone-500 mt-2.5 leading-relaxed font-light">
                  国内著名拉花公开赛金奖手。杯泡奶霜落定间，绘出让呼吸定格的树林花草印画。
                </p>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ==================== SCREEN F: CONTACT FORUM ==================== */}
      {activeTab === 'contact' && (
        <div id="cozy-contact-screen" className="space-y-12 animate-fadeIn max-w-4xl mx-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Form */}
            <div className="bg-white border border-[#A88C74]/20 rounded-3xl p-6 md:p-8 shadow-xs">
              <h3 className="text-sm font-bold text-[#5C3A21] mb-6 font-serif flex items-center gap-1.5">
                <span>📝</span> 悠闲后堂在线建言信箱
              </h3>
              
              {contactSuccess && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 text-[11px] rounded-xl flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">✓</span>
                  留言提交成功！后台数据库已牢靠记录。我们会第一时间处理。
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-stone-500 font-bold mb-1">您的贵姓名 *</label>
                  <input required type="text" className="w-full p-2.5 bg-[#FAF9F5] border border-stone-200 rounded-xl focus:outline-none focus:border-[#5C3A21] focus:bg-white text-xs" placeholder="请告知大堂如何客气称呼您呢" />
                </div>
                <div>
                  <label className="block text-stone-500 font-bold mb-1">电子联络信箱 *</label>
                  <input required type="email" className="w-full p-2.5 bg-[#FAF9F5] border border-stone-200 rounded-xl focus:outline-none focus:border-[#5C3A21] focus:bg-white text-xs" placeholder="例如: yourname@domain.com" />
                </div>
                <div>
                  <label className="block text-stone-500 font-bold mb-1">您的贵重建议/加盟合作详情 *</label>
                  <textarea required rows={4} className="w-full p-2.5 bg-[#FAF9F5] border border-stone-200 rounded-xl focus:outline-none focus:border-[#5C3A21] focus:bg-white resize-none text-xs" placeholder="欢迎写下对我们大堂特调、环境或管理的建议..." />
                </div>
                <button type="submit" className="w-full py-3 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold rounded-xl transition border-none cursor-pointer text-xs font-serif">
                  🚀 直发大堂信箱系统
                </button>
              </form>
            </div>

            {/* Offlines Infos */}
            <div className="space-y-4 flex flex-col justify-between h-full">
              
              <div className="bg-white p-5 rounded-2xl border border-[#A88C74]/15 shadow-xs flex gap-4">
                <span className="w-10 h-10 bg-[#FAF7F2] border border-[#A88C74]/20 rounded-xl flex items-center justify-center text-lg text-[#5C3A21] shrink-0">📍</span>
                <div>
                  <h4 className="text-xs font-bold text-[#5C3A21] font-serif">悠然大堂实体大本营</h4>
                  <p className="text-xs text-stone-500 mt-1 leading-normal">辽宁省大连市中山区五五路温尼霍书坊隔壁1层</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#A88C74]/15 shadow-xs flex gap-4">
                <span className="w-10 h-10 bg-[#FAF7F2] border border-[#A88C74]/20 rounded-xl flex items-center justify-center text-lg text-[#5C3A21] shrink-0">📞</span>
                <div>
                  <h4 className="text-xs font-bold text-[#5C3A21] font-serif font-sans">大堂特快订舱热线</h4>
                  <p className="text-xs text-stone-500 mt-1 font-mono">0411-8888-9999</p>
                  <p className="text-[9px] text-stone-400 mt-0.5">周一至周日 10:00 - 21:00 全天恭候服务建言</p>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#A88C74]/20 text-[10px] text-stone-500 leading-relaxed font-light">
                * 大堂所有用户反馈和注册信息都被云端稳妥集成、保存在服务器首层的 <strong className="font-mono text-[#8B5A2B]">users-db.json</strong> 数据库中。
                您可以一键登录管理员账号审核所有的表单和注册记录。
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ==================== POPUP: PRINTABLE VINTAGE RECEIPT ==================== */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 bg-[#2D1A12]/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FBFAF7] border-4 border-[#5C3A21] w-full max-w-sm rounded-3xl p-6 md:p-8 shadow-2xl relative animate-fadeIn text-[#2D1A12] font-mono select-text">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowReceipt(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 bg-stone-100 p-1.5 rounded-full transition border-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Receipt top */}
            <div className="text-center space-y-2 pb-5 border-b-2 border-dashed border-stone-300">
              <span className="text-[11px] border border-stone-800 px-3 py-0.5 rounded-full uppercase font-bold inline-block">
                ★ LEISURELY TICKET ★
              </span>
              <h3 className="text-lg font-bold font-serif text-[#5C3A21]">悠然咖啡大堂提单卡</h3>
              <p className="text-[10px] text-stone-500">大连中山区五五路概念店（服务直连）</p>
              
              <div className="text-[10px] bg-stone-100 py-1.5 rounded-md flex items-center justify-around font-bold mt-2 text-stone-700">
                <span>流水提单: {receiptNumber}</span>
                <span>出杯区: {receiptType === 'dine-in' ? '堂食 A区' : '外带 B区'}</span>
              </div>
            </div>

            {/* Delivery type selectors inside invoice popup! */}
            <div className="my-4 flex items-center justify-between text-xs border border-[#A88C74]/30 rounded-xl p-1 bg-white">
              <button 
                onClick={() => setReceiptType('dine-in')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border-none cursor-pointer font-serif ${receiptType === 'dine-in' ? 'bg-[#5C3A21] text-white' : 'text-stone-500 bg-transparent'}`}
              >
                🍽️ 堂食品尝 (Dine In)
              </button>
              <button 
                onClick={() => setReceiptType('take-away')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border-none cursor-pointer font-serif ${receiptType === 'take-away' ? 'bg-[#5C3A21] text-white' : 'text-stone-500 bg-transparent'}`}
              >
                🛍️ 外带打包 (Take Out)
              </button>
            </div>

            {/* List items on invoice */}
            <div className="py-4 space-y-3 max-h-56 overflow-y-auto pr-1">
              {wishlist.map((item, idx) => (
                <div key={item.wishId} className="text-[11px] border-b border-stone-150 pb-2 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{idx + 1}. {item.name.replace('★独家手作★', '').substring(0, 16)}</span>
                    <span>¥{item.price}</span>
                  </div>
                  <div className="text-[9px] text-stone-400 pl-3 leading-tight space-y-0.5">
                    <div>• 规格: {item.size.match(/\((.*?)\)/)?.[1] || item.size.substring(0, 3)}</div>
                    <div>• 比例/温度: {item.sugar.split(' ')[0]} / {item.temp.split(' ')[0]}</div>
                    {item.notes && <div>• 指令: {item.notes}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* calculations */}
            <div className="border-t-2 border-dashed border-stone-300 pt-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>品项共计:</span>
                <span>{wishlist.length} 杯/件</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>服务加水料费:</span>
                <span>¥0.00 (免费高定)</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>大堂席位费:</span>
                <span>¥0.00 (免服务费)</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#5C3A21] border-t border-stone-200 pt-2 font-serif">
                <span>实收总计:</span>
                <span>¥ {totalWishlistPrice}</span>
              </div>
            </div>

            {/* Simulated Barcode */}
            <div className="mt-6 pt-4 border-t border-stone-200 flex flex-col items-center space-y-2 text-center">
              {/* barcode visualization */}
              <div className="h-10 w-full bg-[linear-gradient(90deg,#000_2px,transparent_2px,#000_1px,transparent_5px,#000_4px,transparent_3px,#000_1px,transparent_2px,#000_3px,transparent_2px,#000_1px)] bg-[size:24px_100%] opacity-85" />
              <div className="text-[9px] text-stone-400 font-mono tracking-[0.2em]">{receiptNumber}-9F2DA</div>
              
              <p className="text-[9px] text-stone-400 leading-normal font-light max-w-xs mt-2">
                * 滴！请在大堂柜外侧二维码扫描器出示此电子单。咖啡工匠将立刻为您称量豆粉、配调冲滤。感谢支持悠然手作。
              </p>
            </div>

            {/* Action buttons inside overlay */}
            <div className="flex gap-2.5 mt-6 border-t border-stone-200 pt-4">
              <button
                onClick={() => { window.print(); }}
                className="flex-1 py-2 bg-stone-150 hover:bg-stone-200 text-stone-800 text-[10px] font-bold rounded-lg transition border-none cursor-pointer flex items-center justify-center gap-1 font-serif"
              >
                <Printer className="w-3.5 h-3.5" />
                打印风味单
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(wishlist, null, 2));
                  alert('配方代码已完美写入剪贴板，您可以一键分享给微信好友！');
                }}
                className="flex-1 py-2 bg-stone-150 hover:bg-stone-200 text-stone-850 text-[10px] font-bold rounded-lg transition border-none cursor-pointer flex items-center justify-center gap-1 font-serif"
              >
                <Share2 className="w-3.5 h-3.5" />
                复制配方码
              </button>
            </div>

            <div className="mt-3.5 pt-3.5 border-t border-stone-200">
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full py-3 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold text-xs rounded-xl shadow transition duration-200 border-none cursor-pointer flex items-center justify-center gap-1.5 font-serif active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutLoading ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    正在打单结算中...
                  </span>
                ) : (
                  <span>💳 立即结算下单并完成支付 (Pay Order)</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      </div>
    </div>
  );
}
