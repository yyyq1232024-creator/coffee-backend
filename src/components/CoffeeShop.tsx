import React, { useState, useEffect } from 'react';
import { 
  Coffee, Heart, Trash2, Plus, Sparkles, Check, 
  MapPin, Phone, Mail, FileText, Send, Share2, Printer, X, ChevronDown, Globe2, Menu, UserRound, LogOut, LayoutDashboard, ShoppingCart
} from 'lucide-react';
import { User as UserType, WishlistItem, MenuProduct } from '../types';
import CoffeeHome from './CoffeeHome';
import CoffeeAssistant from './CoffeeAssistant';
import BeanOriginPage from './BeanOriginPage';

interface CoffeeShopProps {
  user: UserType | null;
  token: string | null;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onLogout?: () => void;
}

export default function CoffeeShop({ user, token, onNavigateToLogin, onNavigateToRegister, onNavigateToAdmin, onNavigateToProfile, onLogout }: CoffeeShopProps) {
  type ShopTab = 'home' | 'menu' | 'builder' | 'wishlist' | 'cart' | 'about' | 'contact' | 'printer';
  const [activeTab, setActiveTab] = useState<ShopTab>('home');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'order' | 'about' | 'member' | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [originBatchId, setOriginBatchId] = useState<string | null>(null);

  const handleTabClick = (tab: ShopTab) => {
    setOpenDropdown(null);
    setMobileNavOpen(false);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);
  const [menuFilter, setMenuFilter] = useState<'all' | 'coffee' | 'tea' | 'dessert'>('all');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [cartItems, setCartItems] = useState<WishlistItem[]>([]);
  const [wishlistReady, setWishlistReady] = useState(false);
  const [addedAnimationId, setAddedAnimationId] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<MenuProduct[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  const fetchMenuProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '菜单读取失败');
      setMenuItems(result.data);
    } catch (error) {
      console.error('Failed to load menu and inventory:', error);
    } finally {
      setMenuLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuProducts();
  }, []);
  
  // Custom Receipt Overlay state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptType, setReceiptType] = useState<'dine-in' | 'take-away'>('dine-in');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [receiptItems, setReceiptItems] = useState<WishlistItem[]>([]);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay' | 'member'>('wechat');
  const [lastPrintJobId, setLastPrintJobId] = useState<string | null>(null);
  const [submitToBarLoading, setSubmitToBarLoading] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (cartItems.length === 0) {
      alert('购物车还是空的，请先添加想购买的饮品。');
      return;
    }
    setCheckoutLoading(true);
    try {
      const jobId = "PRT-" + Math.floor(1000 + Math.random() * 9000) + "-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const snapshot = [...cartItems];
      const notesString = checkoutNotes.trim() ? `【客座座号/打包交代】${checkoutNotes.trim()}` : '';
      const checkoutRes = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          jobId,
          items: snapshot.map((itm) => ({
            id: itm.wishId,
            itemId: itm.itemId,
            name: itm.name,
            price: itm.price,
            size: itm.size,
            sugar: itm.sugar,
            milk: itm.milk,
            temp: itm.temp,
            notes: itm.notes ? `${itm.notes} ${notesString}` : notesString,
            img: itm.img
          })),
          totalPrice: totalCartPrice,
          type: receiptType
        })
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.success) {
        throw new Error(checkoutData.error || '订单提交失败');
      }
      const orderId = checkoutData.data?.id;

      saveCart([]);
      setReceiptItems([...snapshot]);
      setReceiptNumber(orderId);
      setLastPrintJobId(jobId);
      setShowReceipt(true);
      await fetchMenuProducts();
      alert('支付成功，库存已同步扣减。请在电子订单中确认提交制作。');
    } catch (e: any) {
      alert(`下单支付出错: ${e.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCreateAndPrintJob = async () => {
    if (!lastPrintJobId) return;
    setSubmitToBarLoading(true);
    try {
      const itemsToPrint = receiptItems;
      const notesString = checkoutNotes.trim() ? `【客座座号/打包交代】${checkoutNotes.trim()}` : '';
      const finalPrice = itemsToPrint.reduce((sum, item) => sum + item.price, 0);

      // Submit print job to the server
      const printJobsRes = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          jobId: lastPrintJobId,
          orderId: receiptNumber,
          items: itemsToPrint.map((itm) => ({
            name: itm.name,
            price: itm.price,
            size: itm.size,
            sugar: itm.sugar,
            milk: itm.milk,
            temp: itm.temp,
            notes: itm.notes ? (itm.notes.includes('【客座') ? itm.notes : `${itm.notes} ${notesString}`) : notesString
          })),
          totalPrice: finalPrice
        })
      });

      const printJobsData = await printJobsRes.json();
      if (!printJobsRes.ok || !printJobsData.success) {
        throw new Error(printJobsData.error || '创建中央打印机队列任务失败');
      }

      setPrintQueue(prev => {
        const filtered = prev.filter(j => j.id !== lastPrintJobId);
        return [printJobsData.data, ...filtered];
      });

      // The customer completes the flow here; the queue remains an admin workspace.
      setShowReceipt(false);
      setActiveTab('cart');
      setCheckoutNotes('');

      alert('订单已提交制作，吧台会按顺序为您准备。');

    } catch (e: any) {
      alert(`提交制作失败: ${e.message}`);
    } finally {
      setSubmitToBarLoading(false);
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
      speed: Math.floor(Math.random() * 10) + 26 // between 26 and 36 seconds duration
    };
    const updated = [newDanmaku, ...liveReviews];
    setLiveReviews(updated);
    
    // Save to user storage
    const customOnly = updated.filter(r => !initialReviews.some(i => i.text === r.text));
    localStorage.setItem('coffee_danmakus', JSON.stringify(customOnly));
  };

  // The local copy is only a recovery cache; authenticated users persist to the server database.
  const storageKey = user ? `coffee_wishlist_${user.username}` : `coffee_wishlist_guest`;
  
  useEffect(() => {
    let cancelled = false;
    setWishlistReady(false);
    if (!user || !token) {
      setWishlist([]);
      setWishlistReady(true);
      return () => { cancelled = true; };
    }

    const loadWishlist = async () => {
      let cached: WishlistItem[] = [];
      try {
        const stored = localStorage.getItem(storageKey);
        cached = stored ? JSON.parse(stored) : [];
      } catch {
        cached = [];
      }
      try {
        const response = await fetch('/api/wishlist', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || '收藏配方读取失败');
        let serverItems: WishlistItem[] = Array.isArray(result.data) ? result.data : [];
        if (serverItems.length === 0 && cached.length > 0) {
          const migration = await fetch('/api/wishlist', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ items: cached }),
          });
          if (migration.ok) serverItems = cached;
        }
        if (!cancelled) {
          setWishlist(serverItems);
          localStorage.setItem(storageKey, JSON.stringify(serverItems));
        }
      } catch (error) {
        console.error('Failed to load database wishlist, using recovery cache:', error);
        if (!cancelled) setWishlist(cached);
      } finally {
        if (!cancelled) setWishlistReady(true);
      }
    };
    loadWishlist();
    return () => { cancelled = true; };
  }, [storageKey, user?.id, token]);

  useEffect(() => {
    if (!wishlistReady || !user || !token) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/wishlist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ items: wishlist }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || '收藏配方保存失败');
        }
      } catch (error) {
        console.error('Failed to persist wishlist:', error);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [wishlist, wishlistReady, user?.id, token]);

  // Save changes to state and LocalStorage
  const saveWishlist = (newWishlist: WishlistItem[]) => {
    setWishlist(newWishlist);
    localStorage.setItem(storageKey, JSON.stringify(newWishlist));
  };

  // The cart is intentionally separate from favorites. It is short-lived purchase
  // intent, while favorites remain a persistent recipe collection in the database.
  const cartStorageKey = user ? `coffee_cart_${user.username}` : 'coffee_cart_guest';

  useEffect(() => {
    try {
      const savedForAccount = localStorage.getItem(cartStorageKey);
      const guestItems = user ? localStorage.getItem('coffee_cart_guest') : null;
      const accountItems: WishlistItem[] = savedForAccount ? JSON.parse(savedForAccount) : [];
      const migratedGuestItems: WishlistItem[] = guestItems ? JSON.parse(guestItems) : [];
      const nextItems = accountItems.length > 0 ? accountItems : migratedGuestItems;
      setCartItems(nextItems);
      if (user && migratedGuestItems.length > 0 && accountItems.length === 0) {
        localStorage.setItem(cartStorageKey, JSON.stringify(migratedGuestItems));
        localStorage.removeItem('coffee_cart_guest');
      }
    } catch {
      setCartItems([]);
    }
  }, [cartStorageKey, user?.id]);

  const saveCart = (nextItems: WishlistItem[]) => {
    setCartItems(nextItems);
    localStorage.setItem(cartStorageKey, JSON.stringify(nextItems));
  };

  const addToCart = (source: WishlistItem, switchToCart = false) => {
    const cartItem: WishlistItem = {
      ...source,
      wishId: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      addedAt: new Date().toISOString(),
    };
    saveCart([cartItem, ...cartItems]);
    if (switchToCart) handleTabClick('cart');
  };

  const removeCartItem = (cartItemId: string) => {
    saveCart(cartItems.filter(item => item.wishId !== cartItemId));
  };

  const duplicateCartItem = (source: WishlistItem) => {
    addToCart(source);
  };

  // ==================== Authenticated Counter Order Queue ====================
  const [printQueue, setPrintQueue] = useState<any[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [executingJobId, setExecutingJobId] = useState<string | null>(null);
  const filteredPrintQueue = printQueue;

  const fetchPrintQueue = async (silent = false) => {
    if (!token) {
      setPrintQueue([]);
      return;
    }
    if (!silent) setIsQueueLoading(true);
    try {
      const res = await fetch('/api/print/queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPrintQueue(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch counter order queue:", e);
    } finally {
      if (!silent) setIsQueueLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    fetchPrintQueue(true);

    // Dynamic Server Poll every 4 seconds to catch and sync orders placed by other concurrent users!
    const interval = setInterval(() => {
      fetchPrintQueue(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [token]);

  // Instantly re-sync print queue from server when user switches to 'printer' tab
  useEffect(() => {
    if (activeTab === 'printer') {
      fetchPrintQueue(false); // Show loading spinner for active user interaction
    }
  }, [activeTab, token]);

  const canManageJob = (_job?: any) => user?.role === 'admin';

  const handleExecutePrint = async (jobId: string) => {
    setExecutingJobId(jobId);
    try {
      const res = await fetch(`/api/print/${jobId}/execute`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "打单失败");
      }
      
      setPrintQueue(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed' } : j));
      setExecutingJobId(null);
      
    } catch (e: any) {
      alert(`打单指令下发失败: ${e.message}`);
      setExecutingJobId(null);
    }
  };

  const handleConfirmAndDeleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/print/${jobId}/delete`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "删除失败");
      }
      
      // Remove from printQueue immediately in UI
      setPrintQueue(prev => prev.filter(j => j.id !== jobId));
      if (lastPrintJobId === jobId) {
        setLastPrintJobId(null);
      }
      setShowReceipt(false);
    } catch (e: any) {
      alert(`销单失败: ${e.message}`);
    }
  };

  const handleClearPrintQueue = async () => {
    if (!confirm("确定要清空吧台的全部出单记录吗？")) return;
    try {
      const res = await fetch('/api/print/clear', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPrintQueue([]);
      } else {
        alert(data.error || "清空服务器打印队列失败");
      }
    } catch (e) {
      alert("清空服务器打印队列失败");
    }
  };

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

  // Customized products belong in the cart; the heart remains a pure favorite toggle.
  const handleAddCustomToCart = (item: typeof menuItems[0]) => {
    const wishId = 'cart-source-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    
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

    addToCart(newItem);
    setAddedAnimationId(item.id);
    setQuickCustomizeItemId(null); // fold panel
    
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1200);
  };

  const handleAddMenuItemToCart = (item: typeof menuItems[0]) => {
    const source: WishlistItem = {
      wishId: `cart-source-${item.id}`,
      itemId: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      img: item.img,
      sugar: item.category === 'dessert' ? '甜点标准配方' : '半糖 (微甜恰到好处)',
      milk: item.category === 'dessert' ? '甜点免额外乳底' : '香浓冰鲜牛奶',
      temp: item.category === 'dessert' ? '冷藏常温最佳' : '标准热饮 (最醇厚香气)',
      size: '中杯的轻盈体验 (Medium)',
      notes: '标准出品',
      addedAt: new Date().toISOString(),
    };
    addToCart(source);
    setAddedAnimationId(item.id);
    setTimeout(() => setAddedAnimationId(null), 1200);
  };

  // The heart is a true save toggle. Quantity belongs to checkout/customization,
  // so repeated heart clicks must never create duplicate cups.
  const handleToggleWishlistDefault = (item: typeof menuItems[0]) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    const isDefaultForProduct = (wish: WishlistItem) => wish.itemId === item.id && wish.notes === '默认标准出杯';
    if (wishlist.some(isDefaultForProduct)) {
      // Also clears duplicates created by the old add-only heart behavior.
      saveWishlist(wishlist.filter(wish => !isDefaultForProduct(wish)));
      setAddedAnimationId(null);
      return;
    }
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
    saveWishlist([newItem, ...wishlist.filter(wish => !isDefaultForProduct(wish))]);
    setAddedAnimationId(item.id);
    setTimeout(() => {
      setAddedAnimationId(null);
    }, 1200);
  };

  // Add custom builders to Wishlist
  const handleAddCustomCupToWishlist = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
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
    alert(`已保存专属特调「${customCupName}」，以后可以直接按此配方复购。`);
    
    // Redirect
    setActiveTab('wishlist');
    setCustomCupName('午后治愈专属特调');
    setBuilderExtras([]);
  };

  const handleAddCustomCupToCart = () => {
    if (!customCupName.trim()) {
      alert('请先为这杯特调取一个名字。');
      return;
    }
    const source: WishlistItem = {
      wishId: `cart-source-${Date.now()}`,
      name: `★独家手作★ ${customCupName}`,
      price: totalBuilderPrice,
      category: 'coffee',
      img: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=500',
      sugar: builderSugar,
      milk: builderMilk,
      temp: builderTemp,
      size: builderSize,
      notes: builderExtras.length > 0 ? `手作顶料: ${builderExtras.join(', ')}` : '独家匠心特配',
      addedAt: new Date().toISOString(),
    };
    addToCart(source, true);
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

  const totalCartPrice = cartItems.reduce((sum, item) => sum + item.price, 0);
  const primaryNavigation = [
    { tab: 'menu' as const, label: '菜单' },
    { tab: 'builder' as const, label: '私人特调' },
    { tab: 'wishlist' as const, label: '收藏夹', badge: wishlist.length },
    { tab: 'cart' as const, label: '购物车', badge: cartItems.length },
    ...(user?.role === 'admin' ? [{ tab: 'printer' as const, label: '吧台队列', badge: printQueue.filter(job => job.status === 'pending').length }] : []),
  ];

  return (
    <div id="coffee-shop-container" className="w-full">

      {originBatchId && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0E1110] animate-fadeIn" role="dialog" aria-modal="true" aria-label="咖啡豆源档案">
          <BeanOriginPage
            embedded
            initialBatchId={originBatchId}
            onClose={() => setOriginBatchId(null)}
          />
        </div>
      )}

      {activeTab !== 'home' && (
        <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#FCFBF8]/95 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => handleTabClick('home')}
              className="flex items-center gap-2.5 bg-transparent border-0 cursor-pointer text-left shrink-0"
              aria-label="返回首页"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#5C3A21] text-white"><Coffee className="w-4 h-4" /></span>
              <span>
                <strong className="block text-sm font-serif text-[#4A3020] leading-none">悠然咖啡客</strong>
                <small className="hidden sm:block mt-1 text-[8px] tracking-[0.2em] text-stone-400">YURAN COFFEE</small>
              </span>
            </button>

            <nav className="hidden lg:flex items-center gap-1" aria-label="主要导航">
              {primaryNavigation.map(item => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => handleTabClick(item.tab)}
                  className={`relative px-3 py-2 rounded-lg text-[12px] transition-colors cursor-pointer border-0 ${
                    activeTab === item.tab
                      ? 'bg-[#EEE7DF] text-[#4A3020] font-semibold'
                      : 'bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                  }`}
                >
                  {item.label}
                  {Boolean(item.badge) && (
                    <span className="ml-1.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-[#79543B] px-1 text-[9px] text-white">{item.badge}</span>
                  )}
                </button>
              ))}

              <div className="relative dropdown-container">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'about' ? null : 'about')}
                  className={`px-3 py-2 rounded-lg text-[12px] flex items-center gap-1 border-0 cursor-pointer transition-colors ${
                    ['about', 'contact'].includes(activeTab) ? 'bg-[#EEE7DF] text-[#4A3020] font-semibold' : 'bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                  }`}
                >
                  品牌与联系 <ChevronDown className={`w-3 h-3 transition-transform ${openDropdown === 'about' ? 'rotate-180' : ''}`} />
                </button>
                {openDropdown === 'about' && (
                  <div className="absolute left-0 top-full mt-2 w-40 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
                    <button onClick={() => handleTabClick('about')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-50">品牌故事</button>
                    <button onClick={() => handleTabClick('contact')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-50">联系门店</button>
                  </div>
                )}
              </div>
            </nav>

            <div className="hidden lg:flex items-center gap-2">
              {user ? (
                <>
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={onNavigateToAdmin}
                    className="flex items-center gap-2 rounded-full bg-[#5C3A21] px-4 py-2 text-xs font-medium text-white border-0 cursor-pointer hover:bg-[#442A1B] transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    管理后台
                  </button>
                )}
                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'member' ? null : 'member')}
                    className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-2 pr-3 text-xs text-stone-700 cursor-pointer"
                  >
                    <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-[#EEE7DF] text-[#5C3A21]">
                      {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <UserRound className="w-3.5 h-3.5" />}
                    </span>
                    <span className="max-w-20 truncate">{user.name}</span>
                    <ChevronDown className="w-3 h-3 text-stone-400" />
                  </button>
                  {openDropdown === 'member' && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
                      <div className="px-3 py-2 border-b border-stone-100 mb-1">
                        <p className="text-xs font-medium text-stone-700 truncate">{user.name}</p>
                        <p className="text-[10px] text-stone-400 truncate">@{user.username}</p>
                      </div>
                      {user.role === 'admin' && (
                        <button onClick={() => { setOpenDropdown(null); onNavigateToAdmin?.(); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-[#5C3A21] hover:bg-[#F5F0EA] flex items-center gap-2"><LayoutDashboard className="w-3.5 h-3.5" />管理后台</button>
                      )}
                      <button onClick={() => { setOpenDropdown(null); onNavigateToProfile?.(); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-50 flex items-center gap-2"><UserRound className="w-3.5 h-3.5" />个人中心</button>
                      <button onClick={() => handleTabClick('wishlist')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-50">我的收藏夹</button>
                      <button onClick={() => handleTabClick('cart')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-50 flex items-center justify-between"><span>购物车</span>{cartItems.length > 0 && <span className="text-[9px] text-[#79543B]">{cartItems.length}</span>}</button>
                      <button onClick={() => { setOpenDropdown(null); onLogout?.(); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"><LogOut className="w-3.5 h-3.5" />退出登录</button>
                    </div>
                  )}
                </div>
                </>
              ) : (
                <>
                  <button onClick={onNavigateToLogin} className="px-3 py-2 text-xs text-stone-600 bg-transparent border-0 cursor-pointer">登录</button>
                  <button onClick={onNavigateToRegister} className="px-4 py-2 rounded-full bg-[#5C3A21] text-white text-xs border-0 cursor-pointer">注册</button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen(current => !current)}
              className="lg:hidden grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white text-stone-700 cursor-pointer"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? '关闭导航菜单' : '打开导航菜单'}
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

          {mobileNavOpen && (
            <div className="lg:hidden border-t border-stone-200 bg-[#FCFBF8] px-4 py-4 shadow-lg">
              <nav className="max-w-6xl mx-auto grid grid-cols-2 gap-2" aria-label="移动端导航">
                {[...primaryNavigation, { tab: 'about' as const, label: '品牌故事' }, { tab: 'contact' as const, label: '联系门店' }].map(item => (
                  <button
                    key={item.tab}
                    onClick={() => handleTabClick(item.tab)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left text-xs ${activeTab === item.tab ? 'border-[#B89A83] bg-[#EEE7DF] text-[#4A3020] font-semibold' : 'border-stone-200 bg-white text-stone-600'}`}
                  >
                    {item.label}
                    {'badge' in item && Boolean(item.badge) && <span className="text-[9px] text-[#79543B]">{item.badge}</span>}
                  </button>
                ))}
              </nav>
              <div className="max-w-6xl mx-auto mt-3 pt-3 border-t border-stone-200 flex items-center justify-between">
                {user ? (
                  <div className="w-full flex items-center justify-between gap-3">
                    <span className="text-xs text-stone-500">已登录：{user.name}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setMobileNavOpen(false); onNavigateToProfile?.(); }} className="text-xs font-medium text-[#5C3A21] bg-transparent border-0 flex items-center gap-1"><UserRound className="w-3.5 h-3.5" />个人中心</button>
                      {user.role === 'admin' && <button onClick={() => { setMobileNavOpen(false); onNavigateToAdmin?.(); }} className="text-xs font-medium text-[#5C3A21] bg-transparent border-0 flex items-center gap-1"><LayoutDashboard className="w-3.5 h-3.5" />管理后台</button>}
                      <button onClick={() => { setMobileNavOpen(false); onLogout?.(); }} className="text-xs text-rose-600 bg-transparent border-0">退出登录</button>
                    </div>
                  </div>
                ) : (
                  <><button onClick={onNavigateToLogin} className="text-xs text-stone-600 bg-transparent border-0">登录</button><button onClick={onNavigateToRegister} className="rounded-full bg-[#5C3A21] px-4 py-2 text-xs text-white border-0">注册会员</button></>
                )}
              </div>
            </div>
          )}
        </header>
      )}

      {/* Premium Minimal Header with Dropdowns */}
      <div className="hidden">
        <div id="cozy-premium-header" className="flex flex-col sm:flex-row items-center justify-between border-b border-[#A88C74]/20 pb-6 mb-8 gap-4 relative">
          
          {/* Left Side: Editorial Brand Logo */}
          <div 
            onClick={() => handleTabClick('home')} 
            className="flex items-center gap-3 cursor-pointer select-none group transition"
          >
            <div className="w-10 h-10 bg-[#5C3A21] rounded-full flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-300">
              <Coffee className="w-5 h-5 text-stone-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-serif text-[#5C3A21] tracking-wide group-hover:text-[#8B5A2B] transition-colors">
                悠然咖啡客
              </h1>
              <p className="text-[9px] text-stone-500 font-mono tracking-widest uppercase">
                Yuran Coffee House
              </p>
            </div>
          </div>

          {/* Right Side: Three Dropdown Menus */}
          <div className="flex items-center gap-1 sm:gap-2.5 relative z-50 text-stone-300">
            
            {/* Dropdown 1: PRODUCTS */}
            <div className="relative dropdown-container flex items-center">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'order' ? null : 'order')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-widest transition-all flex items-center gap-1 bg-transparent cursor-pointer font-serif ${
                  ['menu', 'builder', 'printer'].includes(activeTab)
                    ? 'text-[#8B5A2B] font-extrabold bg-[#EADECE]/30' 
                    : 'text-stone-600 hover:text-[#5C3A21] hover:bg-stone-100/50'
                }`}
              >
                PRODUCTS
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'order' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'order' && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-[#A88C74]/25 rounded-2xl shadow-xl py-2.5 z-50 animate-fadeIn text-[#5C3A21]">
                  <button 
                    onClick={() => handleTabClick('menu')}
                    className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition flex items-center justify-between ${activeTab === 'menu' ? 'text-[#8B5A2B] bg-[#EADECE]/15' : ''}`}
                  >
                    <span className="whitespace-nowrap">极雅手作茶点</span>
                  </button>
                  <button 
                    onClick={() => handleTabClick('builder')}
                    className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition flex items-center justify-between ${activeTab === 'builder' ? 'text-[#8B5A2B] bg-[#EADECE]/15' : ''}`}
                  >
                    <span className="whitespace-nowrap">私人特调工坊</span>
                  </button>
                  <button 
                    onClick={() => handleTabClick('printer')}
                    className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition flex items-center justify-between ${activeTab === 'printer' ? 'text-[#8B5A2B] bg-[#EADECE]/15' : ''}`}
                  >
                    <span className="whitespace-nowrap">吧台出单</span>
                    {printQueue.filter(j => j.status === 'pending').length > 0 && (
                      <span className="bg-amber-700 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-2">
                        {printQueue.filter(j => j.status === 'pending').length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            <span className="text-stone-300/60 font-light select-none text-xs sm:text-sm">|</span>

            {/* Dropdown 2: SUPPORT */}
            <div className="relative dropdown-container flex items-center">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'about' ? null : 'about')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-widest transition-all flex items-center gap-1 bg-transparent cursor-pointer font-serif ${
                  ['home', 'about', 'contact'].includes(activeTab) && !['menu', 'builder', 'printer', 'wishlist'].includes(activeTab)
                    ? 'text-[#8B5A2B] font-extrabold bg-[#EADECE]/30' 
                    : 'text-stone-600 hover:text-[#5C3A21] hover:bg-stone-100/50'
                }`}
              >
                SUPPORT
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'about' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'about' && (
                <div className="absolute right-1/2 translate-x-1/2 sm:translate-x-0 sm:left-0 top-full mt-1.5 w-48 bg-white border border-[#A88C74]/25 rounded-2xl shadow-xl py-2.5 z-50 animate-fadeIn text-[#5C3A21]">
                  <button 
                    onClick={() => handleTabClick('home')}
                    className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition ${activeTab === 'home' ? 'text-[#8B5A2B] bg-[#EADECE]/15' : ''}`}
                  >
                    <span className="whitespace-nowrap">悠然大堂</span>
                  </button>
                  <button 
                    onClick={() => handleTabClick('about')}
                    className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition ${activeTab === 'about' ? 'text-[#8B5A2B] bg-[#EADECE]/15' : ''}`}
                  >
                    <span className="whitespace-nowrap">匠人灵感手记</span>
                  </button>
                  <button 
                    onClick={() => handleTabClick('contact')}
                    className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition ${activeTab === 'contact' ? 'text-[#8B5A2B] bg-[#EADECE]/15' : ''}`}
                  >
                    <span className="whitespace-nowrap">寻访店铺联络</span>
                  </button>
                </div>
              )}
            </div>

            <span className="text-stone-300/60 font-light select-none text-xs sm:text-sm">|</span>

            {/* Dropdown 3: SIGN IN */}
            <div className="relative dropdown-container flex items-center">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'member' ? null : 'member')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-widest transition-all flex items-center gap-1 bg-transparent cursor-pointer font-serif relative ${
                  activeTab === 'wishlist' || user 
                    ? 'text-[#8B5A2B] font-extrabold bg-[#EADECE]/30' 
                    : 'text-stone-600 hover:text-[#5C3A21] hover:bg-stone-100/50'
                }`}
              >
                {user ? `MEMBER: ${user.name}` : 'SIGN IN'}
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold ring-2 ring-white animate-pulse">
                    {wishlist.length}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === 'member' ? 'rotate-180' : ''}`} />
              </button>

              {openDropdown === 'member' && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-[#A88C74]/25 rounded-2xl shadow-xl py-2.5 z-50 animate-fadeIn text-[#5C3A21]">
                  {user ? (
                    <>
                      <div className="px-4 py-2 border-b border-stone-100 mb-1.5">
                        <p className="text-[10px] text-stone-400 font-mono">CONNECTED MEMBER</p>
                        <p className="text-xs font-serif font-black truncate text-[#5C3A21]">{user.name}</p>
                        <p className="text-[9px] text-[#A88C74] truncate">@{user.username}</p>
                      </div>
                      
                      <button 
                        onClick={() => handleTabClick('wishlist')}
                        className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition flex items-center justify-between ${activeTab === 'wishlist' ? 'text-[#8B5A2B] bg-[#EADECE]/15' : ''}`}
                      >
                        <span>我的收藏配方</span>
                        {wishlist.length > 0 && (
                          <span className="bg-red-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                            {wishlist.length}
                          </span>
                        )}
                      </button>

                      <div className="border-t border-stone-100 mt-1.5 pt-1.5">
                        <button 
                          onClick={() => {
                            setOpenDropdown(null);
                            if (onLogout) onLogout();
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-serif font-bold text-rose-700 hover:bg-rose-50 transition flex items-center gap-1.5"
                        >
                          安全注销退出
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b border-stone-100 mb-1.5">
                        <p className="text-[10px] text-stone-400 font-mono">GUEST ACCOUNT</p>
                        <p className="text-xs font-serif font-black text-amber-900">自在品鉴游客</p>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setOpenDropdown(null);
                          onNavigateToLogin();
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition flex items-center gap-1.5 text-[#8B5A2B]"
                      >
                        授权会员登录
                      </button>

                      <button 
                        onClick={() => {
                          setOpenDropdown(null);
                          onNavigateToRegister();
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition flex items-center gap-1.5"
                      >
                        极速注册新会员
                      </button>

                      <button 
                        onClick={() => handleTabClick('wishlist')}
                        className={`w-full text-left px-4 py-2 text-xs font-serif font-bold hover:bg-[#EADECE]/30 transition flex items-center justify-between ${activeTab === 'wishlist' ? 'text-[#8B5A2B]' : ''}`}
                      >
                        <span>我的收藏配方</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Conditional Active Tab Content rendering */}
      {activeTab === 'home' && (
        <CoffeeHome
          user={user}
          onNavigate={handleTabClick}
          onNavigateToLogin={onNavigateToLogin}
          onNavigateToRegister={onNavigateToRegister}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToProfile={onNavigateToProfile}
          onLogout={onLogout}
        />
      )}

      {activeTab !== 'home' && (
        <div className="max-w-6xl mx-auto px-4 pb-24 w-full space-y-12">

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
          {menuLoading && (
            <div className="text-center text-xs text-stone-400 py-10">正在同步今日菜单与库存…</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {menuItems
              .filter(item => menuFilter === 'all' || item.category === menuFilter)
              .map(item => {
                const isQuickCustomOpen = quickCustomizeItemId === item.id;
                const isDefaultSaved = wishlist.some(w => w.itemId === item.id && w.notes === '默认标准出杯');

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
                        <span className={`absolute bottom-3 left-3 px-2.5 py-1 text-[9px] font-bold rounded-lg backdrop-blur-md ${
                          item.stock === 0 ? 'bg-rose-700 text-white' : item.stock <= 5 ? 'bg-amber-100/95 text-amber-900' : 'bg-white/90 text-[#5C3A21]'
                        }`}>
                          {item.stock === 0 ? '今日售罄' : item.stock <= 5 ? `仅余 ${item.stock} 份` : `今日可售 ${item.stock} 份`}
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
                          {item.beanBatch && item.category === 'coffee' && (
                            <button
                              type="button"
                              onClick={() => setOriginBatchId(item.beanBatch!.id)}
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-800 hover:text-[#5C3A21] bg-transparent border-none p-0 cursor-pointer"
                            >
                              <Globe2 className="w-3.5 h-3.5" />
                              查看豆源信息
                            </button>
                          )}
                        </div>

                        {/* Control toggles */}
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => toggleQuickCustomize(item.id)}
                            disabled={item.stock === 0}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-serif transition border-none cursor-pointer ${
                              item.stock === 0
                                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                : isQuickCustomOpen
                                ? 'bg-amber-800 text-white' 
                                : 'bg-[#EADECE]/30 hover:bg-[#5C3A21]/10 text-[#5C3A21]'
                            }`}
                          >
                            {item.stock === 0 ? '今日已售罄' : isQuickCustomOpen ? '⚙️ 折叠参数配方' : '🎯 制定高定制参'}
                          </button>

                          <button 
                            type="button"
                            onClick={() => handleToggleWishlistDefault(item)}
                            disabled={item.stock === 0 && !isDefaultSaved}
                            aria-pressed={isDefaultSaved}
                            className={`min-w-[92px] px-3.5 py-2.5 rounded-xl transition border cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-medium ${
                              isDefaultSaved
                                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-white'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-rose-200 hover:text-rose-600'
                            }`}
                            title={isDefaultSaved ? '取消收藏' : '收藏此配方'}
                          >
                            <Heart className={`w-4 h-4 ${isDefaultSaved ? 'fill-rose-600 text-rose-600' : 'text-current'} ${addedAnimationId === item.id ? 'scale-110' : ''}`} />
                            <span>{isDefaultSaved ? '已收藏' : '收藏'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddMenuItemToCart(item)}
                            disabled={item.stock === 0}
                            className="grid min-w-11 place-items-center rounded-xl border border-[#5C3A21] bg-[#5C3A21] text-white transition hover:bg-[#442A1B] disabled:cursor-not-allowed disabled:opacity-35"
                            title="加入购物车"
                            aria-label={`将${item.name}加入购物车`}
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Quick SPEC customization tray! */}
                    {isQuickCustomOpen && (
                      <div className="border-t-2 border-dashed border-[#A88C74]/20 bg-[#FAF9F5] p-5 space-y-4 animate-fadeIn">
                        <div className="text-[11px] font-bold text-[#5C3A21]/90 flex items-center gap-1 border-b border-[#A88C74]/10 pb-2">
                          <span>⚙️</span>
                          <span>自定义「{item.name}」风味参数，完成后加入购物车</span>
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
                          onClick={() => handleAddCustomToCart(item)}
                          className="w-full py-2.5 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold rounded-xl text-xs font-serif transition border-none cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          加入购物车
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
                
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleAddCustomCupToWishlist}
                    className="w-full py-3 bg-[#F2ECE5] hover:bg-[#E8DDD2] text-[#5C3A21] font-extrabold text-xs rounded-xl transition duration-200 border border-[#A88C74]/25 cursor-pointer font-serif flex items-center justify-center gap-2"
                  >
                    <Heart className="w-4 h-4" />
                    保存到收藏夹
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomCupToCart}
                    className="w-full py-3 bg-[#5C3A21] hover:bg-amber-950 text-white font-extrabold text-xs rounded-xl shadow transition duration-200 border-none cursor-pointer font-serif flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    加入购物车
                  </button>
                </div>
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
              我的收藏配方
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              保存常喝口味和私人特调，下次回来可以直接选择配方再次下单。收藏不会在结账后消失。
            </p>
          </div>

          {wishlist.length === 0 ? (
            <div className="bg-[#FAF9F5] border-2 border-dashed border-[#A88C74]/30 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                ♥
              </div>
              <h3 className="text-base font-bold text-[#5C3A21] font-serif">还没有收藏配方</h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
                在菜单收藏常喝饮品，或在私人特调中保存自己的口味；之后可随时一键复购。
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
            <div className="max-w-4xl mx-auto">
              
              {/* Left Column: Custom Beverage Wishlist (lg:col-span-7) */}
              <div className="space-y-6">
                
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-[#A88C74]/20 pb-4">
                  <h3 className="text-sm font-bold text-[#5C3A21] font-serif flex items-center gap-1.5">
                    <span>☕</span> 已保存配方 ({wishlist.length})
                  </h3>
                  <button 
                    onClick={() => { if (window.confirm('确认删除全部收藏配方吗？')) saveWishlist([]); }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border-none cursor-pointer font-serif"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清空收藏
                  </button>
                </div>

                {/* Wishlist grid items */}
                <div className="space-y-6">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#A88C74]/15">
                        
                        {/* Cup Size */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-stone-400 block">修改出水杯型</span>
                          <select 
                            value={item.size} 
                            onChange={(e) => handleUpdateWishProps(item.wishId, 'size', e.target.value)}
                            className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-bold text-stone-700 focus:outline-[#5C3A21] cursor-pointer"
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
                            className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-semibold text-stone-700 focus:outline-[#5C3A21] cursor-pointer"
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
                            className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-semibold text-stone-700 focus:outline-[#5C3A21] cursor-pointer"
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
                            className="w-full py-1 px-1.5 rounded bg-white border border-stone-200 text-[10px] font-semibold text-stone-700 focus:outline-[#5C3A21] cursor-pointer"
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
                      <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-3.5">
                        <span className="text-[10px] text-stone-400 font-mono">收藏于 {new Date(item.addedAt).toLocaleDateString()}</span>
                        <button
                          type="button"
                          onClick={() => addToCart(item, true)}
                          className="rounded-xl border border-[#5C3A21] bg-[#5C3A21] px-3 py-2 text-[10px] font-bold text-white cursor-pointer transition hover:bg-[#442A1B] flex items-center gap-1.5"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          加入购物车
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

              </div>

              {/* Right Column: Premium Cashier Checkout Payment Card (lg:col-span-5) */}
              <div className="hidden">
                
                {/* Header of Cashier */}
                <div className="text-center border-b border-dashed border-stone-200 pb-4 space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-widest bg-[#C49A6C] text-white px-2.5 py-0.5 rounded-full font-bold">
                    ☕ LEISURELY LOBBY CASHIER
                  </span>
                  <h3 className="text-base font-bold text-[#5C3A21] font-serif">本次订单</h3>
                  <p className="text-[10px] text-stone-400 font-sans">从左侧收藏中选择本次要购买的配方</p>
                </div>

                {/* Pricing summary */}
                <div className="space-y-2.5 text-xs text-stone-600 bg-white p-4 rounded-2xl border border-[#A88C74]/10 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">商品件数 (Total Items):</span>
                    <span className="font-mono font-bold text-[#5C3A21]">{cartItems.length} 杯/件</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">定制调配费 (Extras):</span>
                    <span className="text-stone-400 font-mono">¥0.00 (尊享免费)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">大堂服务保障费:</span>
                    <span className="text-stone-400 font-mono">¥0.00 (免费承保)</span>
                  </div>
                  <div className="border-t border-dashed border-stone-100 pt-2.5 flex justify-between items-center">
                    <span className="font-bold text-[#5C3A21]">应付总计 (Grand Total):</span>
                    <span className="text-rose-700 font-bold font-serif text-lg">¥ {totalCartPrice}</span>
                  </div>
                </div>

                {/* Checkout custom fields */}
                <div className="space-y-4">
                  {/* Dining Options */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#5C3A21] block">🍽️ 配送就餐形式</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200">
                      <button
                        type="button"
                        onClick={() => setReceiptType('dine-in')}
                        className={`py-2 rounded-lg text-xs font-bold transition duration-250 border-none cursor-pointer flex items-center justify-center gap-1.5 ${receiptType === 'dine-in' ? 'bg-[#5C3A21] text-[#FAF9F5] shadow' : 'text-stone-500 bg-transparent'}`}
                      >
                        <span>🍽️ 堂食现调 (Dine In)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptType('take-away')}
                        className={`py-2 rounded-lg text-xs font-bold transition duration-250 border-none cursor-pointer flex items-center justify-center gap-1.5 ${receiptType === 'take-away' ? 'bg-[#5C3A21] text-[#FAF9F5] shadow' : 'text-stone-500 bg-transparent'}`}
                      >
                        <span>🛍️ 外带打包 (Take Away)</span>
                      </button>
                    </div>
                  </div>

                  {/* Desk / Special notes */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#5C3A21] block">🛋️ 客座桌号 / 打包特别交代</label>
                    <input
                      type="text"
                      value={checkoutNotes}
                      onChange={(e) => setCheckoutNotes(e.target.value)}
                      placeholder={receiptType === 'dine-in' ? "如：大堂3号桌、吧台最左侧座、临窗C1卡座..." : "如：带双杯打包托、约15分钟后取、无需吸管..."}
                      className="w-full p-2.5 text-xs rounded-xl bg-white border border-stone-200 focus:outline-[#5C3A21] font-semibold text-stone-800"
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#5C3A21] block">💳 选用结算支付账户 / 渠道</label>
                    <div className="space-y-2">
                      {/* WeChat Pay */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('wechat')}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${paymentMethod === 'wechat' ? 'bg-emerald-50/75 border-emerald-500 text-emerald-900' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base text-emerald-500">🟢</span>
                          <div className="text-left">
                            <div className="text-xs font-bold">微信支付 · WeChat Pay</div>
                            <div className="text-[9px] text-stone-400">支持零钱/储蓄卡/信用卡支付</div>
                          </div>
                        </div>
                        {paymentMethod === 'wechat' && <span className="text-emerald-600 text-xs font-bold font-serif">✓</span>}
                      </button>

                      {/* Alipay */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('alipay')}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${paymentMethod === 'alipay' ? 'bg-blue-50/75 border-blue-500 text-blue-900' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base text-blue-500">🔵</span>
                          <div className="text-left">
                            <div className="text-xs font-bold">支付宝 · Alipay</div>
                            <div className="text-[9px] text-stone-400">支持花呗/余额宝/安全通道付款</div>
                          </div>
                        </div>
                        {paymentMethod === 'alipay' && <span className="text-blue-600 text-xs font-bold font-serif">✓</span>}
                      </button>

                      {/* Cozy Member Card Balance */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('member')}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${paymentMethod === 'member' ? 'bg-amber-50/75 border-[#5C3A21] text-amber-900' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base text-[#5C3A21]">🤎</span>
                          <div className="text-left">
                            <div className="text-xs font-bold">悠然会员卡余额 · Member Balance</div>
                            <div className="text-[9px] text-stone-400">当前余额: ¥150.00 (尊享会员折抵)</div>
                          </div>
                        </div>
                        {paymentMethod === 'member' && <span className="text-amber-800 text-xs font-bold font-serif">✓</span>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit payment button */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={checkoutLoading || cartItems.length === 0}
                    className="w-full py-3.5 bg-[#5C3A21] hover:bg-amber-950 text-[#FAF9F5] font-black text-xs rounded-2xl shadow-md hover:shadow-lg transition duration-250 border-none cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                  >
                    {checkoutLoading ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>风味调制交融中，请稍候...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>{cartItems.length === 0 ? '购物车为空' : `确认支付并提交订单 (¥${totalCartPrice})`}</span>
                      </span>
                    )}
                  </button>
                  <p className="text-[9px] text-stone-400 text-center leading-normal">
                    * 支付成功后会生成电子提单；提交到吧台后，店员可统一处理并更新状态。
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ==================== SCREEN E: SHOPPING CART ==================== */}
      {activeTab === 'cart' && (
        <div id="cozy-cart-screen" className="space-y-8 animate-fadeIn max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] text-[#8B5A2B] uppercase">
              <ShoppingCart className="h-3.5 w-3.5" /> Order Cart
            </span>
            <h2 className="text-2xl font-bold text-[#5C3A21] font-serif">购物车</h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              这里仅放本次准备购买的商品。收藏夹中的喜欢不会因结账而消失。
            </p>
          </div>

          {cartItems.length === 0 ? (
            <div className="bg-[#FAF9F5] border-2 border-dashed border-[#A88C74]/30 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 bg-[#EEE7DF] text-[#5C3A21] rounded-full flex items-center justify-center mx-auto">
                <ShoppingCart className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-[#5C3A21] font-serif">购物车还是空的</h3>
              <p className="text-xs text-stone-400 leading-relaxed">从菜单直接加入商品，或者把收藏夹里的常用配方放进来。</p>
              <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                <button onClick={() => setActiveTab('menu')} className="px-5 py-2.5 bg-[#5C3A21] text-white font-bold text-xs rounded-xl border-none cursor-pointer">浏览菜单</button>
                <button onClick={() => setActiveTab('wishlist')} className="px-5 py-2.5 bg-white text-[#5C3A21] font-bold text-xs rounded-xl border border-stone-200 cursor-pointer">打开收藏夹</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <section className="lg:col-span-7 space-y-4" aria-label="购物车商品">
                <div className="flex items-center justify-between border-b border-[#A88C74]/20 pb-4">
                  <h3 className="text-sm font-bold text-[#5C3A21] font-serif">本次商品 · {cartItems.length} 杯/件</h3>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm('确认清空购物车吗？')) saveCart([]); }}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-rose-50 text-stone-500 hover:text-rose-700 rounded-lg text-[10px] font-bold border-none cursor-pointer"
                  >
                    清空购物车
                  </button>
                </div>

                {cartItems.map((item, index) => (
                  <article key={item.wishId} className="flex gap-4 rounded-2xl border border-[#A88C74]/20 bg-white p-4 shadow-xs sm:p-5">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:h-24 sm:w-24">
                      <img src={item.img} alt={item.name} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[9px] font-mono text-stone-400">ITEM {String(index + 1).padStart(2, '0')}</span>
                          <h4 className="truncate text-sm font-bold text-[#5C3A21] font-serif">{item.name}</h4>
                        </div>
                        <strong className="shrink-0 text-sm text-rose-700 font-serif">¥{item.price}</strong>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-stone-500">
                        {item.size} · {item.sugar} · {item.temp}{item.notes ? ` · ${item.notes}` : ''}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => duplicateCartItem(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#5C3A21] cursor-pointer hover:border-[#B89A83]"
                        >
                          <Plus className="h-3 w-3" /> 再加一杯
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.wishId)}
                          className="inline-flex items-center gap-1 rounded-lg border-0 bg-transparent px-2 py-1.5 text-[10px] text-stone-400 cursor-pointer hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" /> 移除
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <aside className="lg:col-span-5 lg:sticky lg:top-24 rounded-3xl border border-[#5C3A21]/15 bg-[#FAF9F5] p-5 shadow-lg sm:p-6 space-y-5" aria-label="订单结算">
                <div className="border-b border-dashed border-stone-200 pb-4">
                  <span className="text-[9px] font-bold tracking-[0.18em] text-[#8B5A2B]">CHECKOUT</span>
                  <h3 className="mt-1 text-lg font-bold text-[#5C3A21] font-serif">确认订单</h3>
                  <p className="mt-1 text-[10px] text-stone-400">支付完成后，再确认一次即可提交吧台制作。</p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
                  <button type="button" onClick={() => setReceiptType('dine-in')} className={`rounded-lg border-0 py-2.5 text-xs font-bold cursor-pointer ${receiptType === 'dine-in' ? 'bg-[#5C3A21] text-white shadow' : 'bg-transparent text-stone-500'}`}>堂食</button>
                  <button type="button" onClick={() => setReceiptType('take-away')} className={`rounded-lg border-0 py-2.5 text-xs font-bold cursor-pointer ${receiptType === 'take-away' ? 'bg-[#5C3A21] text-white shadow' : 'bg-transparent text-stone-500'}`}>外带</button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#5C3A21]">桌号 / 取单备注</label>
                  <input
                    type="text"
                    value={checkoutNotes}
                    onChange={(event) => setCheckoutNotes(event.target.value)}
                    placeholder={receiptType === 'dine-in' ? '例如：大堂 3 号桌' : '例如：15 分钟后到店取'}
                    className="w-full rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-700 outline-none focus:border-[#8B5A2B]"
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-[11px] font-bold text-[#5C3A21]">支付方式</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['wechat', '微信'],
                      ['alipay', '支付宝'],
                      ['member', '会员卡'],
                    ] as const).map(([method, label]) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`rounded-xl border px-2 py-2.5 text-[10px] font-bold cursor-pointer ${paymentMethod === method ? 'border-[#5C3A21] bg-white text-[#5C3A21] shadow-xs' : 'border-stone-200 bg-transparent text-stone-500'}`}
                      >
                        {label}{paymentMethod === method ? ' ✓' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#A88C74]/10 bg-white p-4 text-xs">
                  <div className="flex justify-between text-stone-500"><span>商品数量</span><span>{cartItems.length} 杯/件</span></div>
                  <div className="mt-3 flex items-end justify-between border-t border-dashed border-stone-200 pt-3">
                    <strong className="text-[#5C3A21]">应付总计</strong>
                    <strong className="text-xl text-rose-700 font-serif">¥{totalCartPrice}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="w-full rounded-2xl border-0 bg-[#5C3A21] py-3.5 text-xs font-black text-white shadow-md cursor-pointer transition hover:bg-[#442A1B] disabled:cursor-wait disabled:opacity-60"
                >
                  {checkoutLoading ? '正在确认库存与支付…' : `确认支付 ¥${totalCartPrice}`}
                </button>
                {!user && <p className="text-center text-[9px] text-stone-400">结算前需要登录，以便保存订单和取单信息。</p>}
              </aside>
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

      {/* ==================== SCREEN G: CENTRAL SERVER PRINTER ==================== */}
      {activeTab === 'printer' && (
        <div id="cozy-printer-screen" className="space-y-8 animate-fadeIn max-w-4xl mx-auto text-xs">
          
          {/* Header Architecture Info Block */}
          <div className="bg-gradient-to-r from-[#5C3A21] to-[#2D1A12] text-[#FAF9F5] rounded-3xl p-6 md:p-8 shadow-md relative overflow-hidden border-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <span className="text-[10px] bg-[#C49A6C] text-[#FAF9F5] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">
                🧾 悠然取单 (ORDER PICKUP)
              </span>
              <h2 className="text-xl md:text-2xl font-bold font-serif">{user?.role === 'admin' ? '今日吧台订单' : '我的取单进度'}</h2>
              <p className="text-stone-300 text-xs leading-relaxed max-w-2xl font-light">
                点单完成后，您的风味清单会同步至吧台。咖啡师将按顺序制作，每一次进度更新都会在这里呈现；看到“已完成”后，凭订单号前往吧台取单即可。
              </p>
              <div className="flex flex-wrap gap-4 pt-2 text-[10px] text-stone-300 font-mono">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" /> 通信状态: 在线联机 (Connected)</span>
                <span className="flex items-center gap-1">● 传输协议: REST / HTTPS</span>
                <span className="flex items-center gap-1">● 终端反馈: 实时风味数据流</span>
              </div>
            </div>
          </div>

          {/* Interactive Printer Machine Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Visual Thermal Printer Mockup (Left Column) */}
            <div className="md:col-span-5 bg-stone-100 border border-stone-250 rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#8B5A2B_1px,transparent_1.5px)] [background-size:24px_24px] opacity-5 pointer-events-none" />
              
              <h3 className="text-[10px] font-black text-stone-700 tracking-wider font-serif uppercase">★ 从研磨到出杯 ★</h3>
              
              {/* The physical printer container */}
              <div className="w-48 h-36 bg-stone-800 rounded-t-3xl border-4 border-stone-700 shadow-md relative flex flex-col justify-end">
                {/* Status LED */}
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-[8px] text-stone-300">
                  <span className={`w-1.5 h-1.5 rounded-full ${executingJobId ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span>{executingJobId ? 'BUSY' : 'READY'}</span>
                </div>
                
                {/* Printer Feed Slit */}
                <div className="w-full h-4 bg-stone-950 border-b-2 border-stone-800 flex items-center justify-center relative">
                  <div className="w-[90%] h-1 bg-stone-900 rounded-full" />
                </div>

                {/* Animated Thermal Paper coming out */}
                {(() => {
                  const activePrintJob = filteredPrintQueue.find(j => j.id === executingJobId) || filteredPrintQueue[0];
                  return (
                    <div 
                      className={`w-[84%] bg-[#FAF9F5] border-x border-stone-300 shadow-sm mx-auto transition-all duration-1000 origin-top overflow-hidden text-[7px] text-stone-600 p-2 font-mono leading-tight space-y-1`}
                      style={{
                        height: executingJobId ? '95px' : '20px',
                        opacity: filteredPrintQueue.length > 0 ? 1 : 0,
                        boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div className="text-center border-b border-dashed border-stone-300 pb-1 font-bold">
                        *** LEISURELY PRINT ***
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>单号:</span>
                        <span className="truncate max-w-[50px]">{activePrintJob?.id || 'PRT-MOCK'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>顾客:</span>
                        <span>{activePrintJob?.buyerName || '爱丽丝'}</span>
                      </div>
                      <div className="text-center text-[6px] text-stone-400 pt-1.5 animate-pulse">
                        {executingJobId ? '▲ 正在进纸中...' : '▼ 纸卷已就绪'}
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Printer stand block */}
              <div className="w-56 h-4 bg-stone-700 rounded-full shadow-md animate-pulse" />

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-stone-700">悠然堂舍一号机 (Bar Printer #1)</p>
                <p className="text-[10px] text-stone-500 max-w-[200px] mx-auto leading-normal">
                  从称量、研磨到萃取与出杯，每一道工序都由咖啡师依单完成。您可以在右侧查看进度，慢慢期待这一杯抵达手中。
                </p>
              </div>

              {/* Reset/Clear Buttons */}
              <div className="flex gap-2 w-full pt-2">
                <button 
                  onClick={() => fetchPrintQueue()} 
                  className={`${user?.role === 'admin' ? 'flex-1' : 'w-full'} py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded-xl transition font-bold cursor-pointer`}
                >
                  🔄 刷新队列
                </button>
                {user?.role === 'admin' && (
                  <button 
                    onClick={handleClearPrintQueue} 
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl transition font-bold cursor-pointer text-xs"
                  >
                    🗑 清空队列
                  </button>
                )}
              </div>
            </div>

            {/* Central Printer Queue List (Right Column) */}
            <div className="md:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 p-4 rounded-2xl">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#5C3A21] font-serif flex items-center gap-1.5 m-0">
                    <span>🗂️</span> {user?.role === 'admin' ? "今日制作清单" : "我的取单清单"} ({filteredPrintQueue.length} 笔订单)
                  </h3>
                  <p className="text-[10px] text-stone-500 m-0">
                    {user?.role === 'admin' ? "订单依提交时间排列，请按制作进度及时更新状态" : "订单完成后，请凭单号前往吧台取单"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-amber-50 text-[#8B5A2B] border border-amber-200 px-2 py-1 rounded-full font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    实时同步
                  </span>
                </div>
              </div>

              {isQueueLoading ? (
                <div className="p-12 text-center text-stone-400 bg-white border border-stone-200 rounded-3xl">
                  正在同步吧台出单状态...
                </div>
              ) : filteredPrintQueue.length === 0 ? (
                <div className="p-12 text-center text-stone-400 bg-white border border-stone-200 rounded-3xl space-y-3">
                  <p className="text-sm font-bold">当前没有待处理的出单任务</p>
                  <p className="text-xs leading-normal max-w-sm mx-auto text-stone-500">
                    已支付订单会在顾客确认提交制作后进入这里，由吧台按顺序处理。
                  </p>
                  <div className="pt-2">
                    <button 
                      onClick={() => setActiveTab('menu')}
                      className="px-4 py-2.5 bg-[#5C3A21] hover:bg-amber-950 text-white font-bold rounded-xl text-xs transition cursor-pointer border-none font-serif"
                    >
                      返回菜单 →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">
                  {filteredPrintQueue.map((job) => (
                    <div 
                      key={job.id} 
                      className={`bg-white border transition rounded-3xl p-5 shadow-xs flex flex-col md:flex-row justify-between gap-4 ${
                        job.status === 'printing' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-stone-200'
                      }`}
                    >
                      <div className="space-y-3 flex-1">
                        {/* Header metadata */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="font-mono font-black text-[#5C3A21] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px]">
                            {job.id}
                          </span>
                          <span className="text-stone-300">|</span>
                          <span className="font-bold text-stone-700">顾客: {job.buyerName} (@{job.buyerUsername})</span>
                          <span className="text-stone-300">|</span>
                          <span className="text-stone-400 font-mono">{new Date(job.timestamp).toLocaleTimeString()}</span>
                          {job.status === 'pending' && (
                            <span className="font-mono px-2 py-0.5 rounded-full font-bold text-[9px] bg-amber-50 text-amber-700 border border-amber-200">
                              等待吧台处理
                            </span>
                          )}
                        </div>

                        {/* Items listed */}
                        <div className="space-y-1 bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#A88C74]/10 font-mono text-[11px] text-stone-600">
                          {job.items.map((itm: any, idx: number) => (
                            <div key={idx} className="flex justify-between">
                              <span className="font-bold text-stone-700 truncate max-w-[200px]">
                                {itm.name}
                              </span>
                              <span className="text-stone-500 text-[10px]">
                                {itm.size?.includes('Large') ? '大' : itm.size?.includes('Venti') ? '超大' : '中'} / {itm.sugar?.substring(0, 3)} / {itm.temp?.substring(0, 2)}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-dashed border-stone-200 pt-1.5 mt-1.5 flex justify-between font-bold text-stone-800">
                            <span>应付结算总计</span>
                            <span>￥{job.totalPrice}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons on the right */}
                      <div className="flex flex-row md:flex-col justify-center items-stretch gap-2 shrink-0 min-w-[130px]">
                        {job.status === 'pending' && (
                          canManageJob(job) ? (
                            <button
                              onClick={() => handleExecutePrint(job.id)}
                              disabled={executingJobId !== null}
                              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-[#FAF9F5] rounded-xl transition font-black cursor-pointer text-xs border-none flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>确认出单完成</span>
                            </button>
                          ) : (
                            <div className="w-full py-2.5 bg-stone-100 text-stone-500 rounded-xl text-center font-bold text-xs border border-stone-200 select-none flex items-center justify-center gap-1">
                              <span>等待吧台处理</span>
                            </div>
                          )
                        )}
                        {job.status === 'printing' && (
                          <div className="w-full py-2.5 bg-amber-50 text-amber-800 rounded-xl text-center font-bold flex items-center justify-center gap-1.5 border border-amber-200">
                            <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                            <span className="text-xs">吧台处理中...</span>
                          </div>
                        )}
                        {job.status === 'completed' && (
                          <div className="space-y-1 w-full">
                            <div className="w-full py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-center font-bold flex items-center justify-center gap-1 border border-emerald-200 text-[11px]">
                              <span>✓ 已完成，可取单</span>
                            </div>
                            {canManageJob(job) && (
                              <button
                                onClick={() => handleConfirmAndDeleteJob(job.id)}
                                className="w-full py-2 bg-[#5C3A21] hover:bg-red-800 text-[#FAF9F5] rounded-xl transition font-black cursor-pointer text-xs border-none flex items-center justify-center gap-1 active:scale-95"
                              >
                                <span>管理员归档</span>
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Browser preview option */}
                        {canManageJob(job) && (
                          <button
                            onClick={() => {
                              setReceiptNumber(job.id);
                              setLastPrintJobId(job.id);
                              setReceiptType('dine-in');
                              setShowReceipt(true);
                            }}
                            className="w-full py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-600 rounded-xl transition text-[10px] cursor-pointer border border-stone-200 flex items-center justify-center gap-1"
                          >
                            <span>查看订单</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <div className="my-4 p-2.5 bg-amber-50/40 border border-[#A88C74]/20 rounded-xl text-center">
              <div className="text-[10px] font-bold text-amber-900 uppercase tracking-widest flex items-center justify-center gap-1">
                <span>★</span>
                <span>已成功支付 (Paid via {paymentMethod === 'wechat' ? '微信支付' : paymentMethod === 'alipay' ? '支付宝' : '会员卡余额'})</span>
                <span>★</span>
              </div>
              <div className="text-xs font-serif font-black text-[#5C3A21] mt-1">
                就餐形式: {receiptType === 'dine-in' ? '🍽️ 堂食现调 (Dine In)' : '🛍️ 外带打包 (Take Out)'}
              </div>
            </div>

            {/* List items on invoice */}
            <div className="py-4 space-y-3 max-h-56 overflow-y-auto pr-1">
              {receiptItems.map((item, idx) => (
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
                <span>{receiptItems.length} 杯/件</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>服务加水料费:</span>
                <span>¥0.00 (免费高定)</span>
              </div>
              <div className="flex justify-between text-[#5C3A21] font-bold">
                <span>支付方式:</span>
                <span>{paymentMethod === 'wechat' ? '🟢 微信支付' : paymentMethod === 'alipay' ? '🔵 支付宝' : '🤎 会员卡支付'}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#5C3A21] border-t border-stone-200 pt-2 font-serif">
                <span>实收总计:</span>
                <span>¥ {receiptItems.reduce((sum, item) => sum + item.price, 0)}</span>
              </div>
            </div>

            {/* Simulated Barcode */}
            <div className="mt-6 pt-4 border-t border-stone-200 flex flex-col items-center space-y-2 text-center">
              {/* barcode visualization */}
              <div className="h-10 w-full bg-[linear-gradient(90deg,#000_2px,transparent_2px,#000_1px,transparent_5px,#000_4px,transparent_3px,#000_1px,transparent_2px,#000_3px,transparent_2px,#000_1px)] bg-[size:24px_100%] opacity-85" />
              <div className="text-[9px] text-stone-400 font-mono tracking-[0.2em]">{receiptNumber}-9F2DA</div>
              
              <p className="text-[9px] text-stone-400 leading-normal font-light max-w-xs mt-2">
                 * 支付已完成。点击下方按钮后，订单将进入吧台制作队列，请留意取单号。
              </p>
            </div>

            {/* Action buttons inside overlay */}
            <div className="flex gap-2.5 mt-6 border-t border-stone-200 pt-4">
              <button
                onClick={handleCreateAndPrintJob}
                disabled={submitToBarLoading}
                className="flex-1 py-2 bg-[#5C3A21] hover:bg-[#452b19] text-white text-[10px] font-bold rounded-lg transition border-none cursor-pointer flex items-center justify-center gap-1 font-serif active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                {submitToBarLoading ? '正在提交…' : '确认提交制作'}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(receiptItems, null, 2));
                  alert('配方代码已完美写入剪贴板，您可以一键分享给微信好友！');
                }}
                className="flex-1 py-2 bg-stone-150 hover:bg-stone-200 text-stone-850 text-[10px] font-bold rounded-lg transition border-none cursor-pointer flex items-center justify-center gap-1 font-serif"
              >
                <Share2 className="w-3.5 h-3.5" />
                复制配方代码
              </button>
            </div>

            {(() => {
              const lastJob = printQueue.find(j => j.id === lastPrintJobId);
              return (
                <div className="mt-3.5 pt-3.5 border-t border-stone-200 space-y-2">
                  {lastJob?.status === 'completed' && user?.role === 'admin' && (
                    <button
                      onClick={() => handleConfirmAndDeleteJob(lastPrintJobId!)}
                      className="w-full py-2.5 bg-red-800 hover:bg-red-950 text-white font-extrabold text-xs rounded-xl shadow transition duration-200 border-none cursor-pointer flex items-center justify-center gap-1.5 font-serif active:scale-95 mb-1"
                    >
                      <span>管理员归档此单</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowReceipt(false)}
                    className="w-full py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-extrabold text-xs rounded-xl shadow transition duration-200 border-none cursor-pointer flex items-center justify-center gap-1.5 font-serif"
                  >
                    <span>关闭</span>
                  </button>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* Premium Member Login Trigger Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#FAF9F5] rounded-3xl border border-[#A88C74]/30 shadow-2xl p-8 relative overflow-hidden text-[#5C3A21] animate-slideUp">
            {/* Visual top accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-[#8B5A2B]" />
            
            {/* Close button */}
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition cursor-pointer p-1 bg-transparent border-none"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-6 mt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#EADECE]/50 rounded-full text-3xl select-none">
                🔒
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-serif font-bold text-[#5C3A21] tracking-wide">
                  开启您的会员品鉴之旅
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed font-light">
                  您当前正以 <span className="font-semibold italic">“自在游客”</span> 身份鉴赏大堂。立即登录/注册会员，即可开启专享高定茶点、私人特调工坊以及大堂云端同步等全功能特快权限！
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    onNavigateToLogin();
                  }}
                  className="w-full py-3 bg-[#8B5A2B] hover:bg-[#5C3A21] text-white rounded-xl text-[11px] font-bold tracking-wider uppercase transition cursor-pointer active:scale-95 shadow-md shadow-amber-900/10 border-none"
                >
                  🔓 授权会员登录
                </button>
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    onNavigateToRegister();
                  }}
                  className="w-full py-3 bg-white hover:bg-stone-50 text-[#8B5A2B] border border-[#8B5A2B]/40 rounded-xl text-[11px] font-bold tracking-wider uppercase transition cursor-pointer active:scale-95"
                >
                  ✍️ 注册新会员
                </button>
              </div>
              
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-stone-400 hover:text-[#8B5A2B] text-xs font-medium tracking-wide transition underline decoration-dotted bg-transparent border-none cursor-pointer"
              >
                继续以游客身份浏览大堂
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      )}
      <CoffeeAssistant />
    </div>
  );
}
