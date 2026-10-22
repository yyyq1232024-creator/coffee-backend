import React, { useState, useEffect } from 'react';
import { 
  Users, Search, UserPlus, RefreshCw, Eye, Edit, Trash2, 
  ChevronLeft, AlertCircle, Check, X, Shield, ShieldCheck, Mail, Calendar, 
  Lock, ArrowUpDown, Power, UserCheck, MessageSquare, ShieldAlert,
  TrendingUp, ShoppingBag, DollarSign, BarChart2, Clock, Coffee, Sparkles, Tag, Boxes
} from 'lucide-react';
import { User, UserRole, UserStatus, Order, OrderItem, MenuProduct } from '../types';

interface AdminPanelProps {
  token: string;
  currentUser: User;
}

export default function AdminPanel({ token, currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Multi-view states: 'list' | 'details' | 'edit' | 'add'
  const [view, setView] = useState<'list' | 'details' | 'edit' | 'add'>('list');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states for ADD / EDIT
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'user' as UserRole,
    status: 'active' as UserStatus,
    bio: ''
  });

  // Fetch users list
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || '获取用户列表失败');
      }
      setUsers(result.data);
    } catch (err: any) {
      setError(err.message || '网络通讯异常，无法抓取数据');
    } finally {
      setLoading(false);
    }
  };

  // Sales & Orders Sub-tab System
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'sales_dashboard' | 'transactions' | 'inventory'>('sales_dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [inventorySavingId, setInventorySavingId] = useState<number | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '获取库存失败');
      setProducts(result.data);
    } catch (err: any) {
      setError(err.message || '库存读取失败');
    }
  };

  const saveInventory = async (product: MenuProduct) => {
    setInventorySavingId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/inventory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ stock: product.stock, active: product.active }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '库存保存失败');
      setProducts((current) => current.map((item) => item.id === product.id ? result.data : item));
      setSuccessMsg(`${product.name}的库存已更新`);
    } catch (err: any) {
      setError(err.message || '库存保存失败');
    } finally {
      setInventorySavingId(null);
    }
  };

  // Search & Filters for Sold Products (Transactions tab)
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'dine-in' | 'take-away'>('all');
  const [selectedChartBarIdx, setSelectedChartBarIdx] = useState<number | null>(null);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [topSellerFilter, setTopSellerFilter] = useState<'count' | 'rev'>('count');

  // Fetch orders from API
  const fetchOrders = async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch('/api/admin/sales', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || '获取销售数据和产品明细失败');
      }
      setOrders(result.data);
    } catch (err: any) {
      setOrdersError(err.message || '网络连接异常，无法刷新销售数据');
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrders();
    fetchProducts();
  }, [token]);

  // Clean success alert after delay
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Handler: view details
  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setView('details');
  };

  // Handler: enter edit mode
  const handleEnterEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '', // blank initially, override only if input changed
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      bio: user.bio || ''
    });
    setView('edit');
    setError(null);
  };

  // Handler: enter add mode
  const handleEnterAdd = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      role: 'user',
      status: 'active',
      bio: ''
    });
    setView('add');
    setError(null);
  };

  // Handler: Delete User
  const handleDeleteUser = async (userId: string, username: string) => {
    if (userId === currentUser.id) {
      setError('您无法删除自己当前的管理员账号');
      return;
    }
    if (!window.confirm(`确定要彻底删除用户 "${username}" 吗？此操作不可撤销`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || '删除失败');
      }

      setSuccessMsg(`账户 "${username}" 已成功清空删除`);
      fetchUsers();
      if (view === 'details' && selectedUser?.id === userId) {
        setView('list');
      }
    } catch (err: any) {
      setError(err.message || '网络异常，未完成删除');
    }
  };

  // Handler: Toggle Status easily from the dashboard table
  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser.id) {
      setError('您无法禁用您本身的管理员账号');
      return;
    }

    const nextStatus: UserStatus = user.status === 'active' ? 'suspended' : 'active';
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          role: user.role,
          status: nextStatus,
          bio: user.bio || ''
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || '状态更改失败');
      }

      setSuccessMsg(`用户 "${user.username}" 账号已被${nextStatus === 'suspended' ? '封禁禁用' : '解封激活'}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '网络出错');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Submit ADD
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim() || !formData.name.trim() || !formData.email.trim()) {
      setError('必填字段请完整填写（用户名、显示密码、昵称、邮箱）');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || '添加新用户失败');
      }

      setSuccessMsg(`新用户 "${formData.username}" 添加成功！`);
      setView('list');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '网络连接失败');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Submit EDIT
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!formData.name.trim() || !formData.email.trim()) {
      setError('关键字段（邮箱和显示昵称）不准为空');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          status: formData.status,
          bio: formData.bio.trim(),
          password: formData.password ? formData.password : undefined
        })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || '修改失败');
      }

      setSuccessMsg(`修改成功，已应用至 "${selectedUser.username}"！`);
      setView('list');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '网络通信异常，请检查后端');
    } finally {
      setLoading(false);
    }
  };

  // Inline dynamic list filters
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.name.toLowerCase().includes(query);
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Let's compute some stats for sales_dashboard
  const totalRev = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalOrdersCount = orders.length;
  const avgOrderVal = totalOrdersCount > 0 ? (totalRev / totalOrdersCount).toFixed(1) : '0';

  // Count items sold
  const productSalesMap: { [name: string]: { count: number; rev: number; img?: string } } = {};
  orders.forEach(o => {
    o.items.forEach(itm => {
      if (!productSalesMap[itm.name]) {
        productSalesMap[itm.name] = { count: 0, rev: 0, img: itm.img };
      }
      productSalesMap[itm.name].count += 1;
      productSalesMap[itm.name].rev += itm.price;
    });
  });

  // Top selling by COUNT (quantity sold)
  const topSellingProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top selling by REVENUE (proceeds)
  const topSellingByRev = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 5);

  const activeTopSelling = topSellerFilter === 'count' ? topSellingProducts : topSellingByRev;

  // Group by date for last 7 days chart (or last few days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const dailyTrend = last7Days.map(dateStr => {
    const dailyOrders = orders.filter(o => o.orderTime.startsWith(dateStr));
    const revenue = dailyOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const count = dailyOrders.length;
    // Format label as MM-DD
    const label = dateStr.slice(5);
    return { date: dateStr, label, revenue, count };
  });

  // Calculate dynamic max according to selected metric
  const maxRev = Math.max(...dailyTrend.map(d => d.revenue), 10);
  const maxOrders = Math.max(...dailyTrend.map(d => d.count), 5);
  const chartMaxVal = chartMetric === 'revenue' ? maxRev : maxOrders;

  // Additional Insight Data points
  const peakDayInfo = dailyTrend.reduce((max, d) => d.revenue > max.revenue ? d : max, { date: '无数据', label: '', revenue: 0, count: 0 });
  const avgDailyRev = (dailyTrend.reduce((sum, d) => sum + d.revenue, 0) / (dailyTrend.length || 1)).toFixed(0);
  const hasTrendData = dailyTrend.some(day => day.revenue > 0 || day.count > 0);

  return (
    <div id="admin-module" className="w-full max-w-6xl mx-auto my-4 text-slate-800">
      {/* Dynamic Success Alert */}
      {successMsg && (
        <div id="admin-success-toast" className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl flex items-center justify-between shadow-md shadow-emerald-500/10 transition-all">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600 rounded-full bg-emerald-100 p-0.5" />
            <span className="text-sm text-emerald-800 font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dynamic Error Alert */}
      {error && (
        <div id="admin-error-block" className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl flex items-start gap-3 shadow-md shadow-rose-500/5">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h5 className="text-sm font-bold text-rose-800">操作出错了</h5>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================= VIEW: LIST ======================================= */}
      {view === 'list' && (
        <div id="admin-list-card" className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/40 overflow-hidden">
          {/* Header with Sub-Tabs selector */}
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setAdminSubTab('sales_dashboard')}
              className={`flex-1 md:flex-initial px-6 py-4 font-sans text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                adminSubTab === 'sales_dashboard'
                  ? 'border-amber-700 text-amber-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/55'
              }`}
            >
              <BarChart2 className="w-4 h-4 text-amber-750" />
              <span>销售看盘 (Sales Dashboard)</span>
            </button>
            <button
              onClick={() => setAdminSubTab('transactions')}
              className={`flex-1 md:flex-initial px-6 py-4 font-sans text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                adminSubTab === 'transactions'
                  ? 'border-amber-700 text-amber-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/55'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>卖出产品明细 (Sold Products)</span>
            </button>
            <button
              onClick={() => setAdminSubTab('inventory')}
              className={`flex-1 md:flex-initial px-6 py-4 font-sans text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                adminSubTab === 'inventory'
                  ? 'border-amber-700 text-amber-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/55'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>菜单库存</span>
            </button>
            <button
              onClick={() => setAdminSubTab('users')}
              className={`flex-1 md:flex-initial px-6 py-4 font-sans text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
                adminSubTab === 'users'
                  ? 'border-amber-700 text-amber-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/55'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>用户账户管理 (User Accounts)</span>
            </button>
          </div>

          {adminSubTab === 'inventory' && (
            <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#5C3A21] font-serif flex items-center gap-2">
                    <Boxes className="w-5 h-5" /> 今日菜单与库存
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">库存为0时前台自动显示售罄；下单成功后由数据库事务扣减。</p>
                </div>
                <button onClick={fetchProducts} className="px-4 py-2 rounded-xl bg-[#FAF7F2] text-amber-900 text-xs font-bold flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> 刷新库存
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm flex gap-4">
                    <img src={product.img} alt={product.name} className="w-20 h-20 rounded-xl object-cover bg-stone-100" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-[#5C3A21] truncate">{product.name}</h4>
                          <p className="text-[10px] text-slate-400">¥{product.price} · {product.category}{product.beanBatch ? ` · ${product.beanBatch.lotCode}` : ''}</p>
                        </div>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={product.active}
                            onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, active: e.target.checked } : item))}
                          />
                          上架
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-500">剩余库存</label>
                        <input
                          type="number"
                          min={0}
                          max={9999}
                          value={product.stock}
                          onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: Math.max(0, Number(e.target.value) || 0) } : item))}
                          className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => saveInventory(product)}
                          disabled={inventorySavingId === product.id}
                          className="ml-auto px-3 py-1.5 rounded-lg bg-[#5C3A21] text-white text-[10px] font-bold disabled:opacity-50"
                        >
                          {inventorySavingId === product.id ? '保存中…' : '保存'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= Subtab: Sales Dashboard ================= */}
          {adminSubTab === 'sales_dashboard' && (
            <div className="p-6 md:p-8 space-y-8 animate-fadeIn">
              {/* Welcome / Intro heading */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-left">
                  <h3 className="text-lg font-bold text-[#5C3A21] flex items-center gap-2 font-serif">
                    <BarChart2 className="w-5 h-5 text-amber-705" />
                    大堂经营商业看板 (Lobby Business Board)
                  </h3>
                  <p className="text-slate-400 text-xs mt-1 text-left">
                    实时分析顾客的消费特调频率与营业额走势，为特调师定制备料提供数据决策支持。
                  </p>
                </div>
                <button
                  onClick={fetchOrders}
                  className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#FAF2E8] text-amber-900 border border-amber-200/50 font-bold text-xs rounded-xl transition border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                  刷新经营数据
                </button>
              </div>

              {/* Bento Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Total revenue */}
                <div className="bg-[#FAF9F5] border border-[#A88C74]/20 p-6 rounded-2xl relative overflow-hidden group hover:shadow-md transition">
                  <div className="absolute right-4 top-4 text-amber-750/10 group-hover:scale-110 transition-transform duration-200">
                    <DollarSign className="w-16 h-16 text-[#A88C74]/20" />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block text-left">大厅销售总额 / Revenue</span>
                  <h4 className="text-3xl font-extrabold text-[#5C3A21] mt-2 font-serif text-left">
                    ¥{totalRev}
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-2 flex items-center gap-1 text-left">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>相比上期表现有稳步自然增长</span>
                  </p>
                </div>

                {/* Total orders */}
                <div className="bg-[#FAF9F5] border border-[#A88C74]/20 p-6 rounded-2xl relative overflow-hidden group hover:shadow-md transition">
                  <div className="absolute right-4 top-4 text-emerald-750/10 group-hover:scale-110 transition-transform duration-200">
                    <ShoppingBag className="w-16 h-16 text-[#A88C74]/20" />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block text-left">完成交易笔数 / Orders Count</span>
                  <h4 className="text-3xl font-extrabold text-[#5C3A21] mt-2 font-serif text-left">
                    {totalOrdersCount} <span className="text-xs font-normal text-stone-400">单</span>
                  </h4>
                  <div className="text-[11px] text-stone-500 mt-2 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-white border border-stone-200/50 rounded text-[9px] font-bold text-stone-700">
                      堂食: {orders.filter(o => o.type === 'dine-in').length} 单
                    </span>
                    <span className="px-1.5 py-0.5 bg-white border border-stone-200/50 rounded text-[9px] font-bold text-stone-700">
                      打包: {orders.filter(o => o.type === 'take-away').length} 单
                    </span>
                  </div>
                </div>

                {/* Average value */}
                <div className="bg-[#FAF9F5] border border-[#A88C74]/20 p-6 rounded-2xl relative overflow-hidden group hover:shadow-md transition">
                  <div className="absolute right-4 top-4 text-[#5C3A21]/10 group-hover:scale-110 transition-transform duration-200">
                    <Coffee className="w-16 h-16 text-[#A88C74]/20" />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block text-left">笔均客单价 / AOV</span>
                  <h4 className="text-3xl font-extrabold text-[#5C3A21] mt-2 font-serif text-left">
                    ¥{avgOrderVal}
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-2 flex items-center gap-1 text-left">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>特色手作经典高溢价驱动</span>
                  </p>
                </div>
              </div>

              {/* Charts & Top lists */}
              <div id="admin-charts-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* COLUMN CHART + LINE CHART WRAPPER COL */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Weekly operating trend */}
                  <div className="bg-white border border-stone-200/80 p-5 sm:p-6 rounded-2xl shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-100 pb-5">
                      <div className="text-left">
                        <h4 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-[#7A5237]" />
                          近 7 日经营趋势
                        </h4>
                        <p className="text-stone-400 text-[11px] mt-1">数据来自已完成订单，点击日期查看明细</p>
                      </div>

                      <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 self-end sm:self-auto">
                        <button
                          onClick={() => {
                            setChartMetric('revenue');
                            setSelectedChartBarIdx(null);
                          }}
                          className={`px-3 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                            chartMetric === 'revenue'
                              ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                              : 'text-stone-500 hover:text-stone-800 border border-transparent'
                          }`}
                        >
                          营业额
                        </button>
                        <button
                          onClick={() => {
                            setChartMetric('orders');
                            setSelectedChartBarIdx(null);
                          }}
                          className={`px-3 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                            chartMetric === 'orders'
                              ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                              : 'text-stone-500 hover:text-stone-800 border border-transparent'
                          }`}
                        >
                          订单量
                        </button>
                      </div>
                    </div>

                    {ordersLoading ? (
                      <div className="h-60 flex flex-col items-center justify-center text-stone-400 text-xs gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin text-stone-400" />
                        <span>正在读取经营数据…</span>
                      </div>
                    ) : !hasTrendData ? (
                      <div className="h-60 rounded-xl border border-dashed border-stone-200 bg-stone-50/60 flex flex-col items-center justify-center text-center px-6">
                        <BarChart2 className="w-7 h-7 text-stone-300 mb-3" />
                        <p className="text-sm font-medium text-stone-600">近 7 日暂无已完成订单</p>
                        <p className="text-[11px] text-stone-400 mt-1.5">订单完成并归档后，营业额和订单量会显示在这里。</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-stretch h-56 mt-2 gap-3">
                          <div className="flex flex-col justify-between text-[10px] tabular-nums text-stone-400 select-none pb-7 text-right w-12 shrink-0">
                            <span>{chartMetric === 'revenue' ? `¥${Math.round(chartMaxVal)}` : `${Math.round(chartMaxVal)}单`}</span>
                            <span>{chartMetric === 'revenue' ? `¥${Math.round(chartMaxVal * 0.66)}` : `${Math.round(chartMaxVal * 0.66)}单`}</span>
                            <span>{chartMetric === 'revenue' ? `¥${Math.round(chartMaxVal * 0.33)}` : `${Math.round(chartMaxVal * 0.33)}单`}</span>
                            <span>0</span>
                          </div>

                          <div className="flex-1 relative border-b border-stone-200 pb-7">
                            <div className="absolute inset-0 pb-7 flex flex-col justify-between pointer-events-none">
                              <div className="w-full border-t border-stone-100" />
                              <div className="w-full border-t border-stone-100" />
                              <div className="w-full border-t border-stone-100" />
                              <div className="w-full" />
                            </div>

                            <div className="absolute inset-0 pb-7 flex items-end justify-between gap-2 sm:gap-4 px-1 sm:px-2">
                              {dailyTrend.map((chunk, idx) => {
                                const value = chartMetric === 'revenue' ? chunk.revenue : chunk.count;
                                const heightPercent = chartMaxVal > 0 ? (value / chartMaxVal) * 100 : 0;
                                const isSelected = selectedChartBarIdx === idx;
                                return (
                                  <div
                                    key={chunk.date}
                                    onClick={() => setSelectedChartBarIdx(isSelected ? null : idx)}
                                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative focus:outline-none"
                                  >
                                    <div className={`absolute -top-16 left-1/2 -translate-x-1/2 min-w-32 bg-white border border-stone-200 text-stone-700 px-3 py-2 rounded-lg transition-all duration-150 pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-md z-20 ${isSelected ? 'opacity-100' : ''}`}>
                                      <div className="text-[10px] text-stone-400 mb-1 text-left">{chunk.date}</div>
                                      <div className="text-[11px] flex justify-between gap-5"><span>营业额</span><strong className="font-semibold text-stone-800">¥{chunk.revenue}</strong></div>
                                      <div className="text-[11px] flex justify-between gap-5 mt-0.5"><span>订单量</span><strong className="font-semibold text-stone-800">{chunk.count} 单</strong></div>
                                    </div>

                                    <div className="w-full h-full flex justify-center items-end">
                                      <div
                                        style={{ height: `${heightPercent}%` }}
                                        className={`w-full max-w-[26px] md:max-w-[34px] rounded-t-sm transition-all duration-300 ${
                                          isSelected 
                                            ? 'bg-[#6F4A32]'
                                            : 'bg-[#C7B09F] group-hover:bg-[#96745D]'
                                        }`}
                                      />
                                    </div>

                                    <span className={`absolute -bottom-6 text-[10px] tabular-nums transition-colors ${isSelected ? 'text-stone-800 font-semibold' : 'text-stone-400 group-hover:text-stone-600'}`}>
                                      {chunk.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center gap-x-8 gap-y-2 text-[11px] text-stone-500">
                          <span>最高营业额 <strong className="ml-1 text-stone-800 font-semibold">¥{peakDayInfo.revenue}</strong></span>
                          <span>日均营业额 <strong className="ml-1 text-stone-800 font-semibold">¥{avgDailyRev}</strong></span>
                          <span>峰值日期 <strong className="ml-1 text-stone-800 font-semibold">{peakDayInfo.date.slice(5)}</strong></span>
                        </div>

                        {selectedChartBarIdx !== null && (
                          <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl space-y-3 shrink-0 animate-fadeIn text-left">
                            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
                              <span className="font-semibold text-stone-800 text-sm">
                                {dailyTrend[selectedChartBarIdx].date} 订单明细
                              </span>
                              <button 
                                onClick={() => setSelectedChartBarIdx(null)}
                                className="text-stone-400 hover:text-stone-700 text-[11px] border-none cursor-pointer"
                              >
                                收起
                              </button>
                            </div>

                            <div className="divide-y divide-stone-200 max-h-48 overflow-y-auto pr-1 text-xs">
                              {orders
                                .filter(o => o.orderTime.startsWith(dailyTrend[selectedChartBarIdx!].date))
                                .map(o => (
                                  <div key={o.id} className="py-3 flex justify-between items-center text-[11px] px-1">
                                    <div className="space-y-0.5 text-left">
                                      <p className="font-medium text-stone-700">{o.id.substring(0, 10)} · {o.buyerName}</p>
                                      <p className="text-[10px] text-stone-400">{o.orderTime.split('T')[1]?.substring(0, 5) || o.orderTime} · {o.type === 'dine-in' ? '堂食' : '打包'} · {o.items.length} 件</p>
                                    </div>
                                    <span className="font-semibold text-stone-800 text-xs">¥{o.totalPrice}</span>
                                  </div>
                                ))}
                              {orders.filter(o => o.orderTime.startsWith(dailyTrend[selectedChartBarIdx!].date)).length === 0 && (
                                <p className="text-center text-stone-400 text-[10px] py-4">该日无已归档入账的交易</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* HIGHLY POLISHED FLOW TREND LINE CHART PANEL */}
                  <div className="bg-white border border-[#A88C74]/15 p-6 rounded-3xl shadow-lg shadow-stone-100/50 space-y-6 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="text-left">
                        <h4 className="text-sm font-extrabold text-[#5C3A21] font-serif flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-emerald-700 animate-pulse" />
                          应收账款流水起伏曲线
                        </h4>
                        <p className="text-stone-400 text-[10px] mt-0.5">近 7 天销售额连续动态追踪，精细呈现每日资金周转高峰</p>
                      </div>

                      {/* Display metric aggregate */}
                      <div className="bg-[#FAF9F5] border border-stone-200/40 rounded-xl px-3.5 py-1.5 text-right">
                        <span className="text-[9px] uppercase font-bold text-stone-400 block tracking-wider">周期总流水 / Segment Vol</span>
                        <span className="text-xs font-mono font-black text-amber-900">¥{totalRev}</span>
                      </div>
                    </div>

                    {ordersLoading ? (
                      <div className="h-56 flex flex-col items-center justify-center text-stone-400 text-xs gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-650" />
                        <span>绘制流水动态走势图...</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* SVG Drawing Area */}
                        <div className="relative w-full overflow-hidden">
                          {/* Calculate coordinates safely */}
                          {(() => {
                            const svgWidth = 500;
                            const svgHeight = 180;
                            const padL = 50;
                            const padR = 30;
                            const padT = 25;
                            const padB = 30;
                            const wPlot = svgWidth - padL - padR; // 420
                            const hPlot = svgHeight - padT - padB; // 125

                            const points = dailyTrend.map((chunk, idx) => {
                              const x = padL + (idx / 6) * wPlot;
                              const y = padT + hPlot - (maxRev > 0 ? (chunk.revenue / maxRev) * hPlot : 0);
                              return { x, y, ...chunk };
                            });

                            const lineD = points.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
                            const areaD = points.length > 0
                              ? `${lineD} L ${points[points.length - 1].x} ${padT + hPlot} L ${points[0].x} ${padT + hPlot} Z`
                              : '';

                            return (
                              <svg id="trend-curve-svg animate-fadeIn" width="100%" height="auto" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible select-none">
                                <defs>
                                  <linearGradient id="area-glow-grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8C5A3C" stopOpacity="0.35" />
                                    <stop offset="100%" stopColor="#8C5A3C" stopOpacity="0.00" />
                                  </linearGradient>
                                  <linearGradient id="stroke-neon-grad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#DBC4B0" />
                                    <stop offset="50%" stopColor="#8C5A3C" />
                                    <stop offset="100%" stopColor="#412817" />
                                  </linearGradient>
                                </defs>

                                {/* Backgrid Horizontal Ticks */}
                                <g stroke="#FAF9F5" strokeWidth="1">
                                  <line x1={padL} y1={padT} x2={svgWidth - padR} y2={padT} stroke="#FAF8F3" />
                                  <line x1={padL} y1={padT + hPlot * 0.33} x2={svgWidth - padR} y2={padT + hPlot * 0.33} strokeDasharray="3,4" stroke="#FAF8F3" />
                                  <line x1={padL} y1={padT + hPlot * 0.66} x2={svgWidth - padR} y2={padT + hPlot * 0.66} strokeDasharray="3,4" stroke="#FAF8F3" />
                                  <line x1={padL} y1={padT + hPlot} x2={svgWidth - padR} y2={padT + hPlot} stroke="#EBE8DF" />
                                </g>

                                {/* Y-axis scale markers */}
                                <g className="text-[9px] font-mono fill-stone-400" textAnchor="end">
                                  <text x={padL - 10} y={padT + 3}>¥{Math.round(maxRev)}</text>
                                  <text x={padL - 10} y={padT + hPlot * 0.5 + 3}>¥{Math.round(maxRev * 0.5)}</text>
                                  <text x={padL - 10} y={padT + hPlot + 3}>¥0</text>
                                </g>

                                {/* Glow Fill under Path */}
                                {areaD && <path d={areaD} fill="url(#area-glow-grad)" className="transition-all duration-300" />}

                                {/* Master Spline Line */}
                                {lineD && (
                                  <path
                                    d={lineD}
                                    fill="none"
                                    stroke="url(#stroke-neon-grad)"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="drop-shadow-sm transition-all duration-300"
                                  />
                                )}

                                {/* Interactive vertical pointer and labels */}
                                {points.map((p, idx) => {
                                  const isSelected = selectedChartBarIdx === idx;
                                  return (
                                    <g
                                      key={p.date}
                                      onClick={() => setSelectedChartBarIdx(isSelected ? null : idx)}
                                      className="cursor-pointer group"
                                    >
                                      {/* Click tracker vertical dashed guideline */}
                                      {isSelected && (
                                        <line
                                          x1={p.x}
                                          y1={padT}
                                          x2={p.x}
                                          y2={padT + hPlot}
                                          stroke="#A88C74"
                                          strokeWidth="1.2"
                                          strokeDasharray="3,3"
                                        />
                                      )}

                                      {/* Horizontal Date Ticks below chart */}
                                      <text
                                        x={p.x}
                                        y={padT + hPlot + 16}
                                        textAnchor="middle"
                                        className={`text-[9px] font-mono font-medium transition-colors ${
                                          isSelected ? 'fill-amber-900 font-extrabold scale-105' : 'fill-stone-400 group-hover:fill-stone-700'
                                        }`}
                                      >
                                        {p.label}
                                      </text>

                                      {/* Outer glowing pulsing ring on selected or hover */}
                                      <circle
                                        cx={p.x}
                                        cy={p.y}
                                        r={isSelected ? 10 : 6}
                                        className={`transition-all duration-200 fill-amber-650/15 ${
                                          isSelected ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                      />

                                      {/* Inner solid anchor node */}
                                      <circle
                                        cx={p.x}
                                        cy={p.y}
                                        r={isSelected ? 5 : 3.5}
                                        className={`transition-all duration-200 stroke-2 ${
                                          isSelected
                                            ? 'fill-amber-700 stroke-white ring-4 ring-amber-100'
                                            : 'fill-white stroke-[#8C5A3C] stroke-[1.8]'
                                        }`}
                                      />

                                      {/* Small Value tags right above selected points */}
                                      <text
                                        x={p.x}
                                        y={p.y - 12}
                                        textAnchor="middle"
                                        className={`text-[9.5px] font-mono transition-opacity duration-200 pointer-events-none ${
                                          isSelected ? 'fill-amber-950 font-bold opacity-100' : 'fill-stone-500 opacity-0 group-hover:opacity-100'
                                        }`}
                                      >
                                        ¥{p.revenue}
                                      </text>
                                    </g>
                                  );
                                })}
                              </svg>
                            );
                          })()}
                        </div>

                        {/* Interactive Hint Legend and Quick Insights */}
                        <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-add sm:items-center justify-between gap-3 text-xs">
                          <div className="text-[10px] text-stone-400 flex items-center gap-1.5 leading-relaxed text-left">
                            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping" />
                            <span>操作提示：点击坐标轴上的日期节点，可以直接穿透查阅该日全套售卖明细单</span>
                          </div>

                          {/* Quick statistics for trend line */}
                          <div className="flex gap-4 text-[10px] font-mono text-stone-500 self-end">
                            <div>周期最高额：<span className="text-[#5C3A21] font-bold">¥{peakDayInfo.revenue}</span></div>
                            <div className="text-stone-300">|</div>
                            <div>日最高交易：<span className="text-[#5C3A21] font-bold">{peakDayInfo.count}笔</span></div>
                          </div>
                        </div>

                        {/* Selected day details drawer (Waterfall list duplication for accessibility from Line Chart) */}
                        {selectedChartBarIdx !== null && (
                          <div id="line-detail-penetration-box" className="bg-[#FAF9F5]/70 border-l-4 border-amber-800 p-4 rounded-2xl space-y-3 shrink-0 animate-fadeIn text-left mt-3">
                            <div className="flex justify-between items-center pb-2 border-b border-[#A88C74]/15">
                              <span className="font-extrabold text-[#5C3A21] flex items-center gap-1.5 text-xs">
                                <span>📈</span>
                                {dailyTrend[selectedChartBarIdx].date} 点位销售穿透详情明细
                              </span>
                              <button 
                                onClick={() => setSelectedChartBarIdx(null)}
                                className="text-stone-400 hover:text-rose-500 font-extrabold text-[10px] bg-transparent border-none cursor-pointer"
                              >
                                收起详情 [x]
                              </button>
                            </div>

                            <div className="divide-y divide-stone-150/60 max-h-40 overflow-y-auto pr-1 text-xs font-mono">
                              {orders
                                .filter(o => o.orderTime.startsWith(dailyTrend[selectedChartBarIdx!].date))
                                .map(o => (
                                  <div key={o.id} className="py-2 flex justify-between items-center text-[10px] hover:bg-stone-50/50 px-1 rounded transition-colors">
                                    <div className="space-y-0.5 text-left">
                                      <p className="font-bold text-stone-700">单号: <span className="bg-[#FAF7F2] px-1.5 py-0.5 rounded text-amber-900 border border-stone-200/50">{o.id.substring(0, 10)}...</span> | 顾客: {o.buyerName}</p>
                                      <p className="text-[9px] text-stone-400">时间: {o.orderTime.split('T')[1]?.substring(0, 5) || o.orderTime} | 分类: {o.type === 'dine-in' ? '堂食' : '打包'} | 件数: {o.items.length}杯/款</p>
                                    </div>
                                    <span className="font-bold text-[#5C3A21] text-xs">¥{o.totalPrice}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* BEST SELLING VISUAL LIST (HORIZONTAL CATEGORY BARS) */}
                <div className="lg:col-span-4 bg-white border border-[#A88C74]/15 p-6 rounded-3xl shadow-lg shadow-stone-100/50 space-y-5">
                  <div className="flex justify-between items-center border-b border-stone-50 pb-2">
                    <div className="text-left">
                      <h4 className="text-sm font-extrabold text-[#5C3A21] font-serif">热卖特调商品排行</h4>
                      <p className="text-stone-400 text-[10px] mt-0.5">大堂前台高净值加单品名</p>
                    </div>

                    {/* Simple Category tab trigger */}
                    <div className="flex border border-stone-200 rounded-lg p-0.5 bg-[#FAF9F5]">
                      <button
                        onClick={() => setTopSellerFilter('count')}
                        className={`px-2 py-1 text-[9px] font-bold rounded-md transition-colors cursor-pointer ${
                          topSellerFilter === 'count'
                            ? 'bg-[#5C3A21] text-white'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="按数量 / By Qty"
                      >
                        销量
                      </button>
                      <button
                        onClick={() => setTopSellerFilter('rev')}
                        className={`px-2 py-1 text-[9px] font-bold rounded-md transition-colors cursor-pointer ${
                          topSellerFilter === 'rev'
                            ? 'bg-[#5C3A21] text-white'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="按总额 / By Rev"
                      >
                        额度
                      </button>
                    </div>
                  </div>

                  {ordersLoading ? (
                    <div className="h-44 flex items-center justify-center text-stone-400 text-xs">
                      正在重新统计排行...
                    </div>
                  ) : activeTopSelling.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-stone-400 text-xs text-center">
                      暂无售出商品纪录
                    </div>
                  ) : (
                    <div className="space-y-4 pt-1">
                      {activeTopSelling.map((p, idx) => {
                        // Max computation specifically matches the current active tab scale
                        const maxVal = Math.max(...activeTopSelling.map(x => topSellerFilter === 'count' ? x.count : x.rev), 1);
                        const currentVal = topSellerFilter === 'count' ? p.count : p.rev;
                        const percent = (currentVal / maxVal) * 100;
                        
                        return (
                          <div key={p.name} className="space-y-1.5 flex items-center gap-3 group">
                            {p.img ? (
                              <img 
                                src={p.img} 
                                alt={p.name} 
                                className="w-10 h-10 object-cover rounded-xl shrink-0 border border-stone-100 shadow-xs group-hover:scale-105 transition-all duration-200" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="w-10 h-10 bg-[#FAF7F2] border border-[#A88C74]/20 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-xs">☕</span>
                            )}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-stone-700 truncate pr-2 group-hover:text-amber-900 transition-colors">
                                  {idx + 1}. {p.name.replace("★独家手作★", "").replace("★咖啡主理极配★", "")}
                                </span>
                                <span className="font-mono text-[10px] text-[#5C3A21] font-extrabold shrink-0 bg-[#FAF9F5] px-1.5 py-0.5 rounded-md border border-stone-100">
                                  {topSellerFilter === 'count' ? `${p.count} 份` : `¥${p.rev}`}
                                </span>
                              </div>

                              {/* VISUAL H-BAR CHART COMPASS ROW */}
                              <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden mt-1 relative">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className="bg-gradient-to-r from-amber-850 via-[#A88C74] to-amber-700 h-full rounded-full transition-all duration-500"
                                />
                                {percent > 20 && (
                                  <div className="absolute top-0 right-1 text-[7px] font-mono text-white/50 leading-none">
                                    {Math.round(percent)}%
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= Subtab: Transactions ================= */}
          {adminSubTab === 'transactions' && (
            <div className="animate-fadeIn">
              {/* Filter search fields */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/20 grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="按买家姓名、单号、或具体商品风味检索售出记录..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#5C3A21] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/10 focus:border-amber-600 focus:bg-white transition text-left"
                  />
                </div>

                <div className="md:col-span-4 text-left">
                  <select
                    value={orderTypeFilter}
                    onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#5E5E5E] focus:outline-none focus:ring-2"
                  >
                    <option value="all">服务形式: 全部交付 / All Types</option>
                    <option value="dine-in">堂食托盘 / Dine-in</option>
                    <option value="take-away">打包防倾带走 / Take-away</option>
                  </select>
                </div>
              </div>

              {/* Scroll table of sold transactions */}
              <div className="overflow-x-auto text-left">
                {ordersLoading ? (
                  <div className="p-16 flex flex-col items-center justify-center text-stone-400 gap-3">
                    <svg className="animate-spin h-8 w-8 text-[#5C3A21]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-xs font-semibold">正在调出后台交易流水数据库...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="p-16 text-center text-slate-400">
                    <p className="text-sm">暂无已付款的历史订单记录</p>
                  </div>
                ) : (() => {
                  const filteredTrans = orders.filter(o => {
                    const q = orderSearchQuery.toLowerCase().trim();
                    const matchesQuery = 
                      o.buyerName.toLowerCase().includes(q) ||
                      o.id.toLowerCase().includes(q) ||
                      o.items.some(i => i.name.toLowerCase().includes(q));
                    const matchesType = orderTypeFilter === 'all' || o.type === orderTypeFilter;
                    return matchesQuery && matchesType;
                  });

                  if (filteredTrans.length === 0) {
                    return (
                      <div className="p-16 text-center text-slate-400">
                        <p className="text-sm">没有检索到符合条件的售出清单</p>
                      </div>
                    );
                  }

                  return (
                    <table className="w-full table-auto border-collapse text-left text-xs uppercase">
                      <thead>
                        <tr className="bg-[#FAF9F5]/30 border-b border-stone-150 text-stone-500 font-bold uppercase tracking-wider">
                          <th className="px-6 py-4">交易单号</th>
                          <th className="px-6 py-4">买家常客 / Customer</th>
                          <th className="px-6 py-4">已付总价</th>
                          <th className="px-6 py-4">售出单品极配细节 configs</th>
                          <th className="px-6 py-4">创建下单时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 lowercase font-mono">
                        {filteredTrans.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-slate-500 font-bold">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                                {o.id}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-800 text-sm font-sans">{o.buyerName}</span>
                                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold font-sans ${o.type === 'dine-in' ? 'bg-[#FAF7F2] text-[#8B5A2B] border border-[#A88C74]/30' : 'bg-stone-100 text-stone-600'}`}>
                                  {o.type === 'dine-in' ? '堂食' : '外带'}
                                </span>
                              </div>
                              <span className="text-[10px] text-stone-400 block text-left font-sans">账户: {o.buyerUsername}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[#5C3A21] font-extrabold text-sm font-sans">¥ {o.totalPrice}</span>
                            </td>
                            <td className="px-6 py-4 space-y-3 font-sans w-2/5 text-left">
                              {o.items.map((itm, idx) => (
                                <div key={idx} className="flex gap-2.5 items-start text-xs border-b border-stone-100/40 pb-2 last:border-0 last:pb-0">
                                  {itm.img ? (
                                    <img 
                                      src={itm.img} 
                                      alt={itm.name} 
                                      className="w-10 h-10 object-cover rounded-lg border border-stone-200 shrink-0 mt-0.5" 
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <span className="w-10 h-10 bg-[#FAF7F2] border border-stone-150 rounded-lg flex items-center justify-center shrink-0">☕</span>
                                  )}
                                  <div className="space-y-0.5">
                                    <p className="font-bold text-stone-700">{itm.name}</p>
                                    <div className="flex flex-wrap gap-1 text-[9px] font-medium text-stone-400">
                                      {itm.size && <span className="bg-stone-50 px-1 rounded border border-stone-150">{itm.size}</span>}
                                      {itm.sugar && <span className="bg-stone-50 px-1 rounded border border-stone-150">{itm.sugar}</span>}
                                      {itm.milk && <span className="bg-stone-50 px-1 rounded border border-stone-150">{itm.milk}</span>}
                                      {itm.temp && <span className="bg-stone-50 px-1 rounded border border-stone-150">{itm.temp}</span>}
                                      {itm.notes && <span className="bg-amber-50 text-amber-800 px-1 rounded border border-amber-100">📝 {itm.notes}</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </td>
                            <td className="px-6 py-4 text-stone-400 text-[10px]">
                              {new Date(o.orderTime).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ================= Subtab: Users Control ================= */}
          {adminSubTab === 'users' && (
            <>
              {/* Header Bar */}
              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-left">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <Users className="w-5.5 h-5.5 text-amber-700" />
                    后台管理部分 <span className="font-mono text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">B/S 控制中心</span>
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">负责系统所有的标准用户进行过滤检索、添加新雇员和信息编辑管理。</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchUsers}
                    className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition duration-150 border-none cursor-pointer"
                    title="刷新名单"
                    disabled={loading}
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleEnterAdd}
                    className="bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs px-4 py-3 rounded-xl shadow-md shadow-amber-800/10 hover:shadow-lg transition flex items-center gap-1.5 border-none cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    手动创建用户 / Create User
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="p-6 border-b border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6 relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="键入用户名 | 邮箱 | 显示昵称 模糊查询..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-705 placeholder-slate-400 focus:outline-[#A88C74] focus:ring-2 focus:ring-amber-600/10 text-left"
                  />
                </div>

                <div className="md:col-span-3 text-left">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-2"
                  >
                    <option value="all">账户类型: 全部 / All Roles</option>
                    <option value="user">普通标准用户 / User</option>
                    <option value="admin">系统管理员 / Admin</option>
                  </select>
                </div>

                <div className="md:col-span-3 text-left">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-2"
                  >
                    <option value="all">账户状态: 全部 / All Status</option>
                    <option value="active">正常激活 / Active</option>
                    <option value="suspended">已被限制 / Suspended</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto text-left">
                {loading && users.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <svg className="animate-spin h-8 w-8 text-amber-700" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-xs font-semibold">正在载入平台用户数据库...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-16 text-center text-slate-400">
                    <p className="text-sm">没有匹配到符合过滤机制的用户账号</p>
                    <p className="text-xs text-slate-300 mt-1">您可以尝试更改搜索条件或注册新账号</p>
                  </div>
                ) : (
                  <table className="w-full table-auto border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">显示昵称 & 账号</th>
                        <th className="px-6 py-4">电子邮箱</th>
                        <th className="px-6 py-4">角色身份</th>
                        <th className="px-6 py-4">账户状态</th>
                        <th className="px-6 py-4">注册加入日期</th>
                        <th className="px-6 py-4 text-right">管理操作 / Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <tr 
                          key={user.id} 
                          className={`hover:bg-slate-50/50 transition-colors ${
                            user.status === 'suspended' ? 'bg-rose-50/10' : ''
                          }`}
                        >
                          <td className="px-6 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600/20 to-amber-700/20 text-amber-800 font-extrabold flex items-center justify-center shrink-0 uppercase">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{user.name}</p>
                              <p className="font-mono text-[11px] text-slate-400">@{user.username}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono select-all">
                            {user.email}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase inline-flex items-center gap-1 ${
                              user.role === 'admin' 
                                ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-100'
                            }`}>
                              <Shield className="w-3 h-3" />
                              {user.role === 'admin' ? '管理员' : '普通用户'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={user.id === currentUser.id}
                              className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md inline-flex items-center gap-1 border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                                user.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title="点击快速启用/禁用该账号"
                            >
                              <Power className="w-3 h-3" />
                              {user.status === 'active' ? '正常激活' : '封禁锁定'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono">
                            {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleViewDetails(user)}
                                className="p-1.5 text-slate-400 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition border-none cursor-pointer"
                                title="详情 / Retrieve"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEnterEdit(user)}
                                className="p-1.5 text-slate-400 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition border-none cursor-pointer"
                                title="编辑 / Update"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                disabled={user.id === currentUser.id}
                                className="p-1.5 text-slate-400 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition border-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                                title="删除 / Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer stats */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
                <span>正在显示 {filteredUsers.length} 项，总计有 {users.length} 个账户录入。</span>
                <span className="font-mono bg-slate-200/60 text-slate-500 px-2.5 py-0.5 rounded-full">系统时间: 2026-05-29</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================= VIEW: DETAILS ======================================= */}
      {view === 'details' && selectedUser && (
        <div id="admin-details-card" className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/40 p-6 md:p-8 animate-fadeIn">
          {/* Back Action button */}
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-6 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl transition border-none cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            返回列表 / Back
          </button>

          <div className="border-b border-slate-100 pb-6 mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              账户详情页 / User Profile Information
            </h3>
            <p className="text-xs text-slate-400 mt-1">只读查看该用户在数据库中记录的完整密级条目和活跃状态。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left box details */}
            <div className="md:col-span-4 bg-slate-50/70 border border-slate-100 rounded-2xl p-6 flex flex-col items-center">
              <div className="w-20 h-20 bg-amber-700 text-white font-extrabold text-3xl rounded-full flex items-center justify-center uppercase mb-4 shadow">
                {selectedUser.name.charAt(0)}
              </div>
              <h4 className="text-base font-bold text-slate-800">{selectedUser.name}</h4>
              <p className="text-xs font-mono text-slate-400 mt-0.5">@{selectedUser.username}</p>

              <div className="flex flex-col gap-2 mt-5 w-full">
                <div className="flex items-center justify-between text-xs border-b border-white pb-2.5">
                  <span className="text-slate-400">账户状态</span>
                  <span className={`px-2 py-0.5 font-bold rounded text-[10px] ${
                    selectedUser.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedUser.status === 'active' ? '激活中' : '已被冻结'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white pb-2.5">
                  <span className="text-slate-400">权限级别</span>
                  <span className={`px-2 py-0.5 font-bold rounded text-[10px] uppercase ${
                    selectedUser.role === 'admin' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-750'
                  }`}>
                    {selectedUser.role === 'admin' ? '系统管理员' : '平台用户'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">注册顺位</span>
                  <span className="font-mono text-[10px] text-slate-600 bg-slate-200/50 px-1.5 py-0.5 rounded">
                    {selectedUser.id.substring(0, 15)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Right details fields */}
            <div className="md:col-span-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">电子邮件 / Email Address</span>
                  <span className="text-xs font-semibold text-slate-700 font-mono select-all block">{selectedUser.email}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">创建日期 / Join Date</span>
                  <span className="text-xs font-semibold text-slate-700 block">
                    {new Date(selectedUser.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> 个人卡片签名 / Bio description
                </span>
                <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-3 rounded-lg border border-slate-100/50">
                  "{selectedUser.bio || '无个人简介描述'}"
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  onClick={() => handleEnterEdit(selectedUser)}
                  className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow transition border-none cursor-pointer"
                >
                  修改该账户
                </button>
                <button
                  onClick={() => handleDeleteUser(selectedUser.id, selectedUser.username)}
                  disabled={selectedUser.id === currentUser.id}
                  className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl transition border-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  彻底注销删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================= VIEW: ADD ======================================= */}
      {view === 'add' && (
        <div id="admin-add-card" className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/40 p-6 md:p-8 animate-fadeIn">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-6 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl transition border-none cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            取消返回
          </button>

          <div className="border-b border-slate-100 pb-6 mb-6">
            <h3 className="text-xl font-bold text-slate-800">
              添加系统用户 / Add New User Account
            </h3>
            <p className="text-xs text-slate-400 mt-1">管理员可以直接在后台手动注入带有特定身份和状态属性的新账户凭证。</p>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">登录用户名 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="请输入用户名(如 hr_user01)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">登录密码 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="请直接硬设定通用明文密码"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">显示名称(昵称) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入用户中文名或展示签名"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">绑定电子邮箱 <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">权属级别 <span className="text-rose-500">*</span></label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2"
                >
                  <option value="user">标准普通账户 / standard user</option>
                  <option value="admin">管理员账户 / administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">初始状态 <span className="text-rose-500">*</span></label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2"
                >
                  <option value="active">正常启用 / active</option>
                  <option value="suspended">封禁冻结 / suspended</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">备注签名 (Bio)</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                placeholder="关于该用户的特定描述..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-3">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-750 font-semibold text-xs rounded-xl transition border-none cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-xl shadow-md transition border-none cursor-pointer"
              >
                保存在册
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================= VIEW: EDIT ======================================= */}
      {view === 'edit' && selectedUser && (
        <div id="admin-edit-card" className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/40 p-6 md:p-8 animate-fadeIn">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-6 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl transition border-none cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            取消返回
          </button>

          <div className="border-b border-slate-100 pb-6 mb-6">
            <h3 className="text-xl font-bold text-slate-800">
              修改账户档案 <span className="font-mono text-sm bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">@{selectedUser.username}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">管理员可以按需求调整该账户的角色划分、电子邮箱，甚至在下方强制重置其账户登录密码。</p>
          </div>

          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">系统分配用户名 (只读 / Disabled)</label>
                <input
                  type="text"
                  value={formData.username}
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-150 rounded-xl text-xs text-slate-400 select-none cursor-not-allowed"
                  disabled
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">重置登录密码 (留空则代表不修改密码)</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="欲重置登录密码请输入新密码，否则放空"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10 placeholder-slate-400 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">显示名称(昵称) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">绑定电子邮箱 <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">管理员分级授权权限级别 <span className="text-rose-500">*</span></label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10"
                  disabled={selectedUser.id === currentUser.id}
                >
                  <option value="user">普通标准用户 / standard user</option>
                  <option value="admin">管理员账户 / administrator</option>
                </select>
                {selectedUser.id === currentUser.id && (
                  <p className="text-[10px] text-amber-600 mt-1">您无法修改自己管理员账号的权限级别。</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">账户锁定冻结设置 <span className="text-rose-500">*</span></label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10"
                  disabled={selectedUser.id === currentUser.id}
                >
                  <option value="active">正常启用 / active</option>
                  <option value="suspended">封禁冻结 / suspended</option>
                </select>
                {selectedUser.id === currentUser.id && (
                  <p className="text-[10px] text-amber-600 mt-1">您无法冻结您自身的管理员登录情况。</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">个性备注签名</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600/10 resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-3">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-755 font-semibold text-xs rounded-xl transition border-none cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-md transition border-none cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
