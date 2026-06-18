"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";

const FAQS = [
  { label: "Best Section?" },
  { label: "Fee Defaulters?" },
  { label: "Revenue Stats" },
  { label: "Absentee Stats" }
];

const TOKEN_LIMIT = 12000;

function TokenDonut({ used, limit }) {
  const size = 38;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((used / limit) * 100, 100);
  const offset = circ - (circ * pct) / 100;
  const color = pct >= 85 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#10b981";

  return (
    <div className="flex flex-col items-center gap-0.5" title={`${used.toLocaleString()} / ${limit.toLocaleString()} tokens used this session`}>
      <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="text-[8px] font-bold text-slate-400 leading-none">{used >= 1000 ? `${(used / 1000).toFixed(1)}k` : used}</span>
    </div>
  );
}

export default function AdminChatbot({ role }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! I'm your dashboard assistant. Ask me anything about your institute's data." }
  ]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sessionTokens, setSessionTokens] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  function buildHistory() {
    return messages.slice(1).slice(-10).map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text
    }));
  }

  async function sendToAI(userText) {
    setMessages(prev => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    try {
      const history = buildHistory();
      const res = await fetch("/api/chatbot/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history })
      });
      const data = await res.json();

      setMessages(prev => [...prev, { sender: "bot", text: data.answer || "Sorry, I couldn't compute that.", tokens: data.usage }]);

      if (data.usage?.total_tokens) {
        setSessionTokens(prev => prev + data.usage.total_tokens);
      }
    } catch (error) {
      setMessages(prev => [...prev, { sender: "bot", text: "Oops, network error." }]);
    }

    setLoading(false);
  }

  function handleFAQ(faq) {
    sendToAI(faq.label);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!inputText.trim()) return;
    const queryText = inputText;
    setInputText("");
    sendToAI(queryText);
  }

  if (role !== "ADMIN") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-800 hover:bg-slate-900 text-white p-3.5 rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center group"
        >
          <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[540px] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden border border-gray-200" style={{ animation: 'slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {/* Header */}
          <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-md flex items-center justify-center text-white">
                <Bot size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Assistant</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Live Data · Groq</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Token Usage Donut */}
              <div className="flex flex-col items-center" title={`${sessionTokens.toLocaleString()} / ${TOKEN_LIMIT.toLocaleString()} TPM tokens used`}>
                <TokenDonut used={sessionTokens} limit={TOKEN_LIMIT} />
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Token bar under header */}
          {sessionTokens > 0 && (
            <div className="bg-slate-900 px-4 py-1.5 flex items-center gap-2">
              <Zap size={9} className="text-amber-400 flex-shrink-0" />
              <div className="flex-1 bg-white/10 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${sessionTokens / TOKEN_LIMIT >= 0.85 ? "bg-red-400" : sessionTokens / TOKEN_LIMIT >= 0.6 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.min((sessionTokens / TOKEN_LIMIT) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">{sessionTokens.toLocaleString()} / {TOKEN_LIMIT.toLocaleString()} TPM</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2.5 max-w-[88%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${msg.sender === "user" ? "bg-gray-200 text-gray-600" : "bg-slate-100 text-slate-600"}`}>
                  {msg.sender === "user" ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed ${msg.sender === "user" ? "bg-slate-800 text-white rounded-tr-sm" : "bg-white text-gray-700 rounded-tl-sm border border-gray-200 shadow-sm"}`}>
                    <div className="prose prose-sm prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-700 max-w-none">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                  {/* Show per-message token usage for bot messages */}
                  {msg.tokens && msg.sender === "bot" && (
                    <div className="flex items-center gap-1 px-1">
                      <Zap size={9} className="text-amber-400" />
                      <span className="text-[9px] text-gray-400 font-medium">{msg.tokens.total_tokens} tokens</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5 max-w-[88%]">
                <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} />
                </div>
                <div className="px-3.5 py-2.5 bg-white text-gray-500 rounded-lg rounded-tl-sm text-[13px] border border-gray-200 flex items-center gap-2 shadow-sm">
                  <Loader2 size={14} className="animate-spin text-slate-500" /> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div className="px-3 py-2 bg-white border-t border-gray-100">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 px-0.5 no-scrollbar items-center">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap mr-1">Quick:</span>
              {FAQS.map(faq => (
                <button
                  key={faq.label}
                  onClick={() => handleFAQ(faq)}
                  disabled={loading}
                  className="whitespace-nowrap text-[11px] py-1.5 px-3 bg-gray-50 hover:bg-slate-100 border border-gray-200 hover:border-slate-300 rounded-md text-gray-600 hover:text-slate-800 font-medium transition-all disabled:opacity-50"
                >
                  {faq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Input */}
          <form onSubmit={handleManualSubmit} className="px-3 py-3 bg-white border-t border-gray-100 flex gap-2 items-center">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={loading}
              placeholder="Ask about your data..."
              className="flex-1 text-[13px] bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-500/15 focus:border-slate-400 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="w-9 h-9 flex items-center justify-center shrink-0 bg-slate-800 text-white rounded-md shadow-sm hover:bg-slate-900 disabled:opacity-50 disabled:hover:bg-slate-800 transition-all"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
