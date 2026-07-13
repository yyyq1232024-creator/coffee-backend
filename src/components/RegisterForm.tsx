import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface RegisterFormProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
  onBackToLobby?: () => void;
}

export default function RegisterForm({ onRegisterSuccess, onSwitchToLogin, onBackToLobby }: RegisterFormProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validations
    if (!username.trim() || !name.trim() || !email.trim() || !password.trim()) {
      setError('请完整填入所需注册信息');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次填写的独立密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度应不少于6位');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          name: name.trim(),
          email: email.trim(),
          bio: bio.trim(),
          password,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`服务端响应异常。请确保本地后端服务已正确启动！`);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '账户注册失败，请换个用户名再试');
      }

      onRegisterSuccess();
    } catch (err: any) {
      setError(err.message || '网络连接异常故障，请检查服务器是否正常运行');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      id="register-card" 
      className="w-full max-w-[420px] bg-[#141414]/95 border border-stone-800/80 rounded-none p-8 md:p-10 text-white shadow-2xl flex flex-col justify-center animate-fadeIn"
    >
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-black tracking-[0.2em] text-white text-center font-serif select-none">
          悠然咖啡客
        </h1>
        <p className="text-stone-400 text-[10px] tracking-[0.18em] uppercase font-bold text-center mt-2 select-none">
          创建会员账号 开启咖啡旅程
        </p>
      </div>

      {error && (
        <div id="register-error-alert" className="mb-5 p-4 bg-red-950/85 border border-red-800 text-red-200 rounded-none flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <span className="text-xs font-semibold tracking-wide leading-relaxed">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3 px-3 text-xs tracking-wider uppercase border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
              disabled={loading}
              required
            />
          </div>

          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="会员昵称"
              className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3 px-3 text-xs tracking-wider uppercase border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="电子邮箱"
            className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3 px-3 text-xs tracking-wider uppercase border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
            disabled={loading}
            required
          />
        </div>

        <div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="个性签名/备注 (选填)"
            rows={2}
            className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3 px-3 text-xs tracking-wider uppercase border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200 resize-none"
            disabled={loading}
          />
        </div>

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码 (最少6位)"
            className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3 pl-3 pr-16 text-xs tracking-wider uppercase border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
            disabled={loading}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-black font-mono text-[10px] tracking-widest uppercase font-bold cursor-pointer border-none bg-transparent"
            disabled={loading}
          >
            {showPassword ? "隐藏" : "显示"}
          </button>
        </div>

        <div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="确认密码"
            className="w-full bg-[#EAEAEA] text-black font-semibold placeholder:text-stone-500 placeholder:font-semibold rounded-none py-3 px-3 text-xs tracking-wider uppercase border-none focus:outline-none focus:ring-2 focus:ring-white transition-all duration-200"
            disabled={loading}
            required
          />
        </div>

        <button
          id="register-btn-submit"
          type="submit"
          className="w-full py-3.5 px-6 bg-white hover:bg-stone-200 text-black font-black tracking-[0.25em] text-xs uppercase cursor-pointer transition-all duration-200 mt-2 flex items-center justify-center disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "提交中..." : "立即注册"}
        </button>
      </form>

      <div className="mt-6 text-center flex flex-col items-center">
        <span className="text-stone-500 text-[10px] tracking-[0.15em] uppercase font-bold mb-2 block">
          已有会员账号？
        </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="w-full py-2.5 px-6 bg-transparent hover:bg-white/10 text-white border border-stone-800 hover:border-stone-500 font-extrabold tracking-[0.2em] text-[10px] uppercase cursor-pointer transition-all duration-200"
          disabled={loading}
        >
          立即登录
        </button>
      </div>

      {onBackToLobby && (
        <div className="mt-6 border-t border-stone-900 pt-5 text-center">
          <button
            type="button"
            onClick={onBackToLobby}
            className="text-stone-400 hover:text-white text-[10px] tracking-[0.15em] font-bold uppercase transition-colors duration-200 bg-transparent border-none cursor-pointer"
          >
            ← 返回咖啡大堂
          </button>
        </div>
      )}
    </div>
  );
}
