import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { User as UserType } from '../types';

interface LoginFormProps {
  onLoginSuccess: (token: string, user: UserType) => void;
  onSwitchToRegister: () => void;
  onBackToLobby?: () => void;
}

export default function LoginForm({ onLoginSuccess, onSwitchToRegister, onBackToLobby }: LoginFormProps) {
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
        body: JSON.stringify({ username: username.trim().normalize('NFKC'), password }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`服务端响应异常。请确保本地后端服务已正确启动！`);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '登录失败，请检查您的凭证');
      }

      onLoginSuccess(result.data.token, result.data.user);
    } catch (err: any) {
      setError(
        err instanceof TypeError
          ? '无法连接登录服务。请在项目目录运行 npm run dev，并通过显示的网址打开网站。'
          : err.message || '网络连接异常故障，请检查服务器是否正常运行'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      id="login-card" 
      className="w-full max-w-[400px] bg-[#141414]/95 border border-stone-800/80 rounded-none p-10 md:p-12 text-white shadow-2xl flex flex-col justify-center animate-fadeIn"
    >
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-black tracking-[0.2em] text-white text-center font-serif select-none">
          悠然咖啡客
        </h1>
        <p className="text-stone-400 text-[10px] tracking-[0.18em] uppercase font-bold text-center mt-2 select-none">
          悠然大堂
        </p>
      </div>

      {error && (
        <div id="login-error-alert" className="mb-6 p-4 bg-red-950/85 border border-red-800 text-red-200 rounded-none flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <span className="text-xs font-semibold tracking-wide leading-relaxed">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名（区分大小写）或电子邮箱"
            className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3.5 px-4 text-xs tracking-wider border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
            disabled={loading}
            required
            autoComplete="username"
          />
          <p className="mt-1.5 text-[9px] text-stone-500 tracking-wide">用户名和密码均区分英文字母大小写；邮箱不区分。</p>
        </div>

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3.5 pl-4 pr-16 text-xs tracking-wider border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
            disabled={loading}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-black font-mono text-[10px] tracking-widest uppercase font-bold cursor-pointer border-none bg-transparent"
            disabled={loading}
          >
            {showPassword ? "隐藏" : "显示"}
          </button>
        </div>

        <button
          id="login-btn-submit"
          type="submit"
          className="w-full py-3.5 px-6 bg-white hover:bg-stone-200 text-black font-black tracking-[0.25em] text-xs uppercase cursor-pointer transition-all duration-200 mt-2 flex items-center justify-center disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "登录中..." : "会员登录"}
        </button>
      </form>

      <div className="mt-8 text-center flex flex-col items-center">
        <span className="text-stone-500 text-[10px] tracking-[0.15em] uppercase font-bold mb-2 block">
          还没有会员账号？
        </span>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="w-full py-2.5 px-6 bg-transparent hover:bg-white/10 text-white border border-stone-800 hover:border-stone-500 font-extrabold tracking-[0.2em] text-[10px] uppercase cursor-pointer transition-all duration-200"
          disabled={loading}
        >
          立即注册
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center gap-1.5 border-t border-stone-900 pt-6">
        {onBackToLobby && (
          <button
            type="button"
            onClick={onBackToLobby}
            className="text-stone-400 hover:text-white text-[10px] tracking-[0.15em] font-bold uppercase transition-colors duration-200 bg-transparent border-none cursor-pointer"
          >
            ← 返回咖啡大堂
          </button>
        )}
        <p className="text-stone-600 text-[9px] tracking-widest uppercase mt-1 select-all">
          演示管理员账户: admin / adminpassword
        </p>
      </div>
    </div>
  );
}
