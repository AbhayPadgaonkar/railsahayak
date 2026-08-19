"use client";

import { useEffect, useRef, useState } from "react";
import {
  AssistantChip,
  AssistantResponse,
  askAssistant,
  getAssistantPrompts,
} from "@/lib/api";
import { getSession } from "@/lib/auth";

interface Message {
  role: "user" | "assistant";
  text: string;
  chips?: AssistantChip[];
}

const ChatAssistantPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const controller = getSession()?.name ?? getSession()?.controller_id ?? "Controller";

  useEffect(() => {
    let cancelled = false;
    getAssistantPrompts()
      .then((p) => {
        if (!cancelled) setPrompts(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Greeting once, mirroring the assistant's capabilities.
    setMessages((prev) =>
      prev.length === 0
        ? [
            {
              role: "assistant",
              text: `Hello ${controller}, I'm your RailSahayak line advisor. I read the live G&SR state — ask me about trains, crises, advisories, sections, or how to hold a train.`,
            },
          ]
        : prev
    );
  }, [controller]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const res: AssistantResponse = await askAssistant(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.answer, chips: res.chips },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3 min-h-0">
      <div>
        <h1 className="text-xl font-bold text-white">Chat Assistant</h1>
        <p className="text-xs text-slate-400">
          Rule-based advisor over live line state — trains, crises, advisories
          and G&SR guidance
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-sky-700 text-white"
                  : "bg-slate-800 border border-slate-700 text-slate-200"
              }`}
            >
              {m.text}
              {m.chips && m.chips.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {m.chips.map((c, j) => (
                    <span
                      key={j}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-slate-950/60 text-sky-300 border border-slate-700"
                    >
                      {c.label}
                      {c.section ? ` · ${c.section}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2 bg-slate-800 border border-slate-700 text-sm text-slate-400">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      {prompts.length > 0 && messages.length <= 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider">
            Try asking
          </span>
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-sky-500 hover:text-sky-300 text-xs text-slate-300 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send(input);
          }}
          placeholder="Ask about the line…"
          className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 transition-colors"
        />
        <button
          onClick={() => send(input)}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatAssistantPage;