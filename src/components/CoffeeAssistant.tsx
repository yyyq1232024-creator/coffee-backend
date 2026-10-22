import React, { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, Send, X } from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: '你好，我是悠然咖啡顾问。你可以告诉我喜欢的风味、甜度、预算或饮用时间，我会结合当前菜单给你建议。',
};

export default function CoffeeAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.filter((message) => message !== WELCOME) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '咖啡顾问暂时无法回答');
      setMessages((current) => [...current, { role: 'assistant', content: result.data.reply }]);
    } catch (error: any) {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: error?.message || '咖啡顾问暂时离开了一会儿，请稍后再试。',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-4 bottom-4 sm:right-7 sm:bottom-7 z-[80]">
      {open && (
        <section className="mb-3 w-[calc(100vw-2rem)] sm:w-[380px] h-[560px] max-h-[72vh] bg-[#FBF8F2] border border-[#A88C74]/35 rounded-[28px] shadow-2xl overflow-hidden flex flex-col animate-fadeIn">
          <header className="px-5 py-4 bg-[#1D140F] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#DDBA87]" />
              </span>
              <div>
                <h3 className="text-sm font-bold font-serif">悠然咖啡顾问</h3>
                <p className="text-[9px] tracking-[0.18em] text-white/55 uppercase">24H Coffee Consultant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-white/10 transition" aria-label="关闭咖啡顾问">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-6 whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-[#5C3A21] text-white rounded-br-md'
                    : 'bg-white border border-[#A88C74]/20 text-stone-700 rounded-bl-md shadow-sm'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#A88C74]/20 px-4 py-3 rounded-2xl rounded-bl-md text-stone-500 flex items-center gap-2 text-xs">
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> 正在品读你的需求…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-[#A88C74]/20 bg-white">
            <div className="flex items-end gap-2 bg-[#FAF7F2] border border-[#A88C74]/25 rounded-2xl p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                maxLength={1200}
                placeholder="例如：下午喝，不要太苦，有什么推荐？"
                className="flex-1 resize-none bg-transparent border-none outline-none text-xs text-stone-700 placeholder:text-stone-400 px-2 py-1.5"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-[#5C3A21] text-white flex items-center justify-center disabled:opacity-40 transition"
                aria-label="发送消息"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-stone-400 mt-2 text-center">AI建议仅供参考；过敏与健康问题请向专业人士核实。</p>
          </form>
        </section>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className="ml-auto w-14 h-14 rounded-full bg-[#1D140F] text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform border border-[#DDBA87]/40"
        aria-label={open ? '关闭咖啡顾问' : '打开咖啡顾问'}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
