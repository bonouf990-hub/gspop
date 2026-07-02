"use client";

import { useState, useRef, useEffect } from "react";
import { queryData } from "./actions";

type Message = {
  role: "user" | "ai";
  content: string;
  timestamp: Date;
};

const EXAMPLE_QUESTIONS = [
  "What did Building 5 spend on AC repairs this quarter?",
  "Which vendor has the most disputed invoices?",
  "Show me the top 3 technicians by hours worked",
  "What's the average cost per work order by type?",
  "Which buildings are over budget?",
  "How many open work orders are critical priority?",
];

export default function AIChat({ userRole }: { userRole: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleAsk(question?: string) {
    const q = question ?? input.trim();
    if (!q) return;
    setInput("");
    const userMsg: Message = { role: "user", content: q, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const answer = await queryData(q);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: answer, timestamp: new Date() },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `Error: ${e instanceof Error ? e.message : "Query failed"}`, timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && (
        <div className="mb-4">
          <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleAsk(q)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(184,144,47,0.15)] text-[#a0977e] hover:border-[#b8902f] hover:text-[#d4af5a] transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-[500px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-sm ${
              msg.role === "user"
                ? "bg-[rgba(184,144,47,0.12)] ml-8"
                : "bg-[#0f1626] mr-8"
            }`}
          >
            <p className="text-[10px] text-[#6b6454] mb-1">
              {msg.role === "user" ? "You" : "AI Brain"} · {msg.timestamp.toLocaleTimeString()}
            </p>
            <div className="text-[#f0ece4] whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="bg-[#0f1626] rounded-lg p-3 mr-8">
            <p className="text-sm text-[#a0977e] animate-pulse">Analyzing your data…</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAsk()}
          placeholder="Ask anything about your operations data…"
          className="flex-1 bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm placeholder:text-[#6b6454]"
          disabled={loading}
        />
        <button
          onClick={() => handleAsk()}
          disabled={loading || !input.trim()}
          className="px-4 py-2 btn-gold text-sm disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
