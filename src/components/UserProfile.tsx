import React, { useState } from 'react';
import { User, Mail, FileText, Calendar, Edit2, CheckCircle2, AlertCircle, ShieldAlert, Camera, Trash2 } from 'lucide-react';
import { User as UserType } from '../types';

interface UserProfileProps {
  user: UserType;
  token: string;
  onUpdateSuccess: (updatedUser: UserType) => void;
}

export default function UserProfile({ user, token, onUpdateSuccess }: UserProfileProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarChange = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('请选择 JPG、PNG 或 WebP 图片');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('原图不能超过 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) return;
        const sourceSize = Math.min(image.width, image.height);
        const sourceX = (image.width - sourceSize) / 2;
        const sourceY = (image.height - sourceSize) / 2;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        setAvatar(canvas.toDataURL('image/webp', 0.82));
        setError(null);
      };
      image.onerror = () => setError('图片读取失败，请重新选择');
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('显示昵称和电子邮箱不准留空');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          bio: bio.trim(),
          avatar,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存修改失败，请重试');
      }

      setSuccess('个人资料更新成功！');
      onUpdateSuccess(result.data);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || '更新个人资料出现网络异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="profile-container" className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-4">
      {/* Box A - Left Dashboard Info (Static display) */}
      <div className="lg:col-span-5 bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/40 p-6 md:p-8">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-amber-600 to-amber-800 text-white rounded-full flex items-center justify-center text-4xl font-extrabold shadow-md mb-5 leading-none overflow-hidden">
            {user.avatar ? <img src={user.avatar} alt={`${user.name}的头像`} className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
          </div>
          
          <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
          <p className="text-slate-400 font-mono text-xs mt-1 selection:bg-slate-100">@{user.username}</p>
          
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${
              user.role === 'admin' 
                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
            }`}>
              <ShieldAlert className="w-3.5 h-3.5" />
              {user.role === 'admin' ? '系统管理员' : '标准用户'}
            </span>
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
              user.status === 'active' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {user.status === 'active' ? '正常激活中' : '已被禁用'}
            </span>
          </div>

          <p className="text-slate-500 text-sm text-center italic mt-5 px-4 w-full border-t border-slate-50 pt-5">
            "{user.bio || '这个人很懒，什么都没有写哟'}"
          </p>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 space-y-4 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5"><Mail className="w-4 h-4" /> 电子邮箱</span>
            <span className="font-medium text-slate-700 select-all">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> 注册时间</span>
            <span className="font-medium text-slate-700">
              {new Date(user.createdAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5"><User className="w-4 h-4" /> 账户编号</span>
            <span className="font-mono text-[10px] bg-slate-50 px-2 py-0.5 rounded text-slate-500">{user.id}</span>
          </div>
        </div>
      </div>

      {/* Box B - Right Profile Forms */}
      <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/40 p-6 md:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <h2 className="text-lg font-bold text-slate-800">基本资料管理</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 px-3.5 py-2 rounded-xl transition duration-150 border-none cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              编辑账户信息
            </button>
          )}
        </div>

        {success && (
          <div id="profile-success" className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-sm text-emerald-800 font-medium">{success}</span>
          </div>
        )}

        {error && (
          <div id="profile-error" className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span className="text-sm text-red-800 font-medium">{error}</span>
          </div>
        )}

        {editing ? (
          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">个人头像 / Avatar</label>
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-amber-600 to-amber-800 text-white flex items-center justify-center text-2xl font-bold">
                  {avatar ? <img src={avatar} alt="头像预览" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-amber-800 shadow-sm ring-1 ring-slate-200 hover:bg-amber-50">
                    <Camera className="h-3.5 w-3.5" />选择照片
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => handleAvatarChange(event.target.files?.[0])} disabled={loading} />
                  </label>
                  {avatar && (
                    <button type="button" onClick={() => setAvatar('')} className="inline-flex items-center gap-1.5 rounded-xl border-0 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 cursor-pointer hover:bg-rose-100">
                      <Trash2 className="h-3.5 w-3.5" />移除
                    </button>
                  )}
                  <p className="w-full text-[10px] text-slate-400">图片会自动裁成方形并压缩，不会上传原始大图。</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">昵称 / Display Name</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">邮箱地址 / Email Address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 focus:bg-white transition-all text-sm"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">个性签名 / Personal Bio</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400">
                  <FileText className="w-4 h-4" />
                </span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="介绍一下你是谁..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 focus:bg-white transition-all text-sm resize-none"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setName(user.name);
                  setEmail(user.email);
                  setBio(user.bio || '');
                  setAvatar(user.avatar || '');
                  setEditing(false);
                  setError(null);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition border-none cursor-pointer"
                disabled={loading}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-xl text-xs shadow-md shadow-amber-800/10 hover:shadow-lg transition flex items-center gap-1.5 border-none cursor-pointer"
                disabled={loading}
              >
                {loading ? '正在保存...' : '保存更改'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-50/60 rounded-2xl p-5 border border-slate-100 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">系统登录昵称</span>
                <span className="text-slate-800 font-semibold">{user.name}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">绑定安全邮箱</span>
                <span className="text-slate-800 font-semibold font-mono">{user.email}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">用户个性签名</span>
                <span className="text-slate-600 italic">
                  {user.bio ? `"${user.bio}"` : '还没有编辑个性签名哟'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-150/40 text-[13px] text-amber-800 leading-relaxed">
              <strong>温馨提示：</strong> 作为我们平台的尊贵注册会员，您可以自行选择更新您的文字名片。如果有重置登录密码的需求，或者账号遇到任何异常问题，请联系相应的系统管理员协助操作。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
