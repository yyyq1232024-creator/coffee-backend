import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Shield, LogOut, Terminal, Layers, 
  Coffee, Globe, CheckCircle, Home
} from 'lucide-react';
import { User } from './types';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import UserProfile from './components/UserProfile';
import AdminPanel from './components/AdminPanel';
import CoffeeShop from './components/CoffeeShop';

export default function App() {
  // Navigation: 'shop' | 'login' | 'register' | 'profile' | 'admin'
  const [currentTab, setCurrentTab] = useState<'shop' | 'login' | 'register' | 'profile' | 'admin'>('shop');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto check session from localStorage on startup
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        // Do not force-redirect on startup or page refresh so user always lands on the main lobby 'shop' page!
      } catch (e) {
        // Clear corrupt data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  // Show dynamic self-dismissing toast notifications
  const triggerNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Handle Login success callback
  const handleLoginSuccess = (newToken: string, loggedInUser: User) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(loggedInUser));
    setToken(newToken);
    setUser(loggedInUser);
    triggerNotification('success', `欢迎回来，${loggedInUser.name}！登录成功。`);
    
    if (loggedInUser.role === 'admin') {
      setCurrentTab('admin');
    } else {
      setCurrentTab('profile');
    }
  };

  // Handle Register success callback
  const handleRegisterSuccess = () => {
    triggerNotification('success', '账号注册成功！正在返回登录界面，请进行登录。');
    setCurrentTab('login');
  };

  // Handle Profile Update success callback
  const handleProfileUpdate = (updatedUser: User) => {
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  // Logout routine
  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (e) {
        // Safe to ignore on frontend logout
      }
    }
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    setCurrentTab('shop');
    triggerNotification('success', '注销系统登录成功，期待您的下一次光临。');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400">
        <svg className="animate-spin h-10 w-10 text-amber-700" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="mt-4 text-sm font-semibold tracking-wide">系统初始化中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-slate-800 flex flex-col font-sans">
      
      {/* Dynamic Floating Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-2.5 max-w-sm border transition-all duration-305 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
            : 'bg-red-50 text-red-800 border-red-100'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <span className="w-5 h-5 text-red-600 bg-red-100 rounded-full flex items-center justify-center font-bold shrink-0 text-xs">!</span>
          )}
          <p className="text-xs font-semibold">{notification.message}</p>
        </div>
      )}

      {/* Top Header Navigation */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-stone-200/50 h-16 flex items-center shadow-sm">
        <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-600 to-[#8B5A2B] text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
              <Coffee className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-amber-50" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] sm:text-base font-bold tracking-tight text-stone-800">
                  悠然咖啡客
                </span>
                <span className="hidden xs:inline text-[13px] sm:text-base font-bold text-stone-500">
                  · 用户中心
                </span>
              </div>
              <p className="text-[8px] sm:text-[10px] text-amber-700/95 tracking-wider uppercase font-bold hidden sm:block">Leisurely User Control</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-stone-100/80 p-0.5 rounded-full border border-stone-200/60 backdrop-blur-sm">
            <button
               onClick={() => setCurrentTab('shop')}
              className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1 border-none cursor-pointer ${
                currentTab === 'shop' 
                  ? 'bg-gradient-to-r from-amber-600 to-[#8B5A2B] text-white shadow-sm border border-amber-700/10 scale-[1.02]' 
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
              }`}
            >
              <Home className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xxs:inline">大堂</span>
              <span className="hidden md:inline">返回大堂</span>
            </button>

            <div className="h-4 w-[1px] bg-stone-300/60 mx-0.5 sm:mx-1" />

            {token && user ? (
              <div className="flex items-center gap-1">
                {user.role === 'admin' && (
                  <button
                    onClick={() => setCurrentTab('admin')}
                    className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1 border-none cursor-pointer ${
                      currentTab === 'admin' 
                        ? 'bg-gradient-to-r from-amber-600 to-[#8B5A2B] text-white shadow-sm border border-amber-700/10 scale-[1.02]' 
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <span>后台</span>
                    <span className="hidden md:inline">管理</span>
                  </button>
                )}
                
                <button
                  onClick={() => setCurrentTab('profile')}
                  className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1 border-none cursor-pointer ${
                    currentTab === 'profile' 
                      ? 'bg-gradient-to-r from-amber-600 to-[#8B5A2B] text-white shadow-sm border border-amber-700/10 scale-[1.02]' 
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>个人</span>
                  <span className="hidden md:inline">中心</span>
                </button>

                <div className="h-4 w-[1px] bg-stone-300/60 mx-0.5 sm:mx-1" />

                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 hover:bg-rose-50 text-rose-600 rounded-full text-xs font-semibold transition-all border-none cursor-pointer flex items-center gap-1"
                  title="注销登录"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span className="hidden xs:inline">退出</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setCurrentTab('login')}
                  className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-semibold transition-all duration-300 border-none cursor-pointer ${
                    currentTab === 'login' 
                      ? 'bg-gradient-to-r from-amber-600 to-[#8B5A2B] text-white shadow-sm border border-amber-700/10 scale-[1.02]' 
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <span className="hidden xxs:inline">会员</span>登录
                </button>
                <button
                  onClick={() => setCurrentTab('register')}
                  className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-semibold transition-all duration-300 border-none cursor-pointer relative z-10 ${
                    currentTab === 'register' 
                      ? 'bg-gradient-to-r from-amber-600 to-[#8B5A2B] text-white shadow-sm border border-amber-700/10 scale-[1.02]' 
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <span className="hidden xxs:inline">会员</span>注册
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 w-full flex flex-col justify-center ${currentTab === 'shop' ? 'py-0 px-0' : 'py-12 px-4 max-w-6xl mx-auto'}`}>
        
        {/* Conditional rendering based on Authentication State */}
        {currentTab === 'shop' && (
          <CoffeeShop 
            user={user}
            token={token}
            onNavigateToLogin={() => setCurrentTab('login')} 
            onNavigateToRegister={() => setCurrentTab('register')} 
            onLogout={handleLogout}
          />
        )}

        {currentTab !== 'shop' && (!token || !user ? (
          <div className="flex justify-center items-center">
            {currentTab === 'login' && (
              <LoginForm 
                onLoginSuccess={handleLoginSuccess} 
                onSwitchToRegister={() => setCurrentTab('register')} 
              />
            )}
            {currentTab === 'register' && (
              <RegisterForm 
                onRegisterSuccess={handleRegisterSuccess} 
                onSwitchToLogin={() => setCurrentTab('login')} 
              />
            )}
          </div>
        ) : (
          <div className="animate-fadeIn">
            {currentTab === 'profile' && (
              <div className="space-y-4">
                <div className="text-center md:text-left mb-6">
                  <h2 className="text-xl font-extrabold text-[#8B5A2B] overflow-hidden">您好，{user.name} 🍵</h2>
                  <p className="text-xs text-slate-400 mt-1">这里是您的个人专属卡片。您可以在此更改公开名字、个人简介或查看当前注册序列。</p>
                </div>
                <UserProfile 
                  user={user} 
                  token={token} 
                  onUpdateSuccess={handleProfileUpdate} 
                />
              </div>
            )}

            {currentTab === 'admin' && user.role === 'admin' && (
              <div className="space-y-4">
                <div className="text-center md:text-left mb-6">
                  <h2 className="text-xl font-extrabold text-[#8B5A2B]">管理后台控制台 ⚙️</h2>
                  <p className="text-xs text-slate-400 mt-1">作为系统管理员，您拥有全局最高级的 CRUD 数据特权，可以对数据库条目施加增删改查动作。</p>
                </div>
                <AdminPanel 
                  token={token} 
                  currentUser={user} 
                />
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="bg-stone-100 text-stone-500 py-6 px-4 border-t border-stone-200 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-semibold text-stone-700">悠然咖啡客</span> · 慢煮光阴，手作纯真
          </div>
          <div className="text-stone-400">
            &copy; {new Date().getFullYear()} 悠然咖啡客. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
