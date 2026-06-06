import React, { useState } from 'react';
import { LogIn, User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { User as UserType } from '../types';

interface LoginFormProps {
  onLoginSuccess: (token: string, user: UserType) => void;
  onSwitchToRegister: () => void;
}

export default function LoginForm({ onLoginSuccess, onSwitchToRegister }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '登录失败，请检查您的凭证');
      }

      onLoginSuccess(result.data.token, result.data.user);
    } catch (err: any) {
      setError(err.message || '网络错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-card" className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/40 p-8 md:p-10 transition-all duration-300">
      <div className="flex flex-col items-center mb-8">
        <div id="login-icon-bg" className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-700 mb-4 shadow-sm">
          <LogIn className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">欢迎回来</h2>
        <p className="text-slate-500 mt-1 text-sm">请输入用户名和密码登录您的账户</p>
      </div>

      {error && (
        <div id="login-error-alert" className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <span className="text-sm text-red-700 font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">用户名 / Username</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <User className="w-5 h-5" />
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">密码 / Password</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock className="w-5 h-5" />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full pl-11 pr-12 py-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          id="login-btn-submit"
          type="submit"
          className="w-full py-4 px-6 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-semibold rounded-2xl shadow-lg shadow-amber-700/10 hover:shadow-xl hover:shadow-amber-700/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          disabled={loading}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <>
              登录系统
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-slate-500">
        还没有账号？{' '}
        <button
          onClick={onSwitchToRegister}
          className="text-amber-700 font-bold hover:text-amber-800 transition shadow-none border-none cursor-pointer bg-transparent"
          disabled={loading}
        >
          立即注册账户
        </button>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        管理员演示密码: <strong className="text-emerald-600 select-all font-mono">adminpassword</strong>
      </div>
    </div>
  );
}
