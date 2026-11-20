/**
 * AIChatWidget.tsx — Floating AI chat bubble for the CC Production & QMS system.
 *
 * Features:
 * - Floating FAB (bottom-right) that expands into a full chat panel
 * - Sends messages to /api/v1/ai/chat with conversation history
 * - Supports document/image file uploads (PDF, DOCX, PNG, JPG)
 * - Renders AI replies with markdown-like formatting
 * - Shows clickable result links returned by the backend
 * - Persists conversation in component state (session-lived)
 * - Animated entrance, typing indicator, auto-scroll
 */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatLink {
  label: string;
  href: string;
  type?: string;
}

interface AutoReportHint {
  action: string;
  message: string;
  document: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  links?: ChatLink[];
  autoReportHint?: AutoReportHint;
  documentProcessed?: string;
  timestamp: Date;
  isError?: boolean;
}

export interface ChatSessionItem {
  id: string;
  title: string;
  message_count: number;
  last_message_preview: string;
  created_at: string;
  updated_at: string;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ── Helper to parse simple markdown-like syntax ───────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const key = `line-${i}`;
    // Bold: **text**
    const parsedLine = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Code inline: `code`
    const parsedLine2 = parsedLine.replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>');

    if (line.startsWith("## ")) {
      elements.push(
        <p key={key} className="ai-msg-heading" dangerouslySetInnerHTML={{ __html: parsedLine2.slice(3) }} />
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <p key={key} className="ai-msg-h1" dangerouslySetInnerHTML={{ __html: parsedLine2.slice(2) }} />
      );
    } else if (line.match(/^[-*•]\s/)) {
      elements.push(
        <li key={key} className="ai-msg-li" dangerouslySetInnerHTML={{ __html: parsedLine2.slice(2) }} />
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key} className="ai-msg-spacer" />);
    } else {
      elements.push(
        <p key={key} className="ai-msg-p" dangerouslySetInnerHTML={{ __html: parsedLine2 }} />
      );
    }
  });

  return <>{elements}</>;
}

// ── Badge colors for link types ───────────────────────────────────────────────

function linkBadgeClass(type?: string) {
  switch (type) {
    case "order": return "ai-badge-order";
    case "vendor": return "ai-badge-vendor";
    case "sample": return "ai-badge-sample";
    case "bulk": return "ai-badge-bulk";
    default: return "ai-badge-default";
  }
}

// ── Welcome message ───────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Hi! I'm your **CC Production AI Assistant**.\n\nI can help you:\n- Find orders, vendors, and QC reports\n- Summarize production analytics & KPIs\n- Analyze documents you upload (PDF, DOCX, images)\n- Auto-extract fields for QC report drafts\n\nWhat would you like to know?",
  timestamp: new Date(),
};

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "Show me delayed orders",
  "What are the top defects this month?",
  "Summarize today's QC activity",
  "How many orders are in progress?",
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Chat history & sessions (strictly scoped to the logged-in user)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>("New Conversation");
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDeletingSessionId, setIsDeletingSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Escape key exits full-screen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) setIsFullScreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullScreen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  // Build conversation history for API
  const buildHistory = useCallback(() => {
    return messages
      .filter((m) => m.role !== "system" && m.id !== "welcome")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text || input).trim();
      if (!messageText && !selectedFile) return;
      if (isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageText || `[Uploaded: ${selectedFile?.name}]`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      const capturedFile = selectedFile;
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      try {
        const formData = new FormData();
        formData.append("message", messageText || "Please analyze this document.");
        formData.append("history", JSON.stringify(buildHistory()));
        if (currentSessionId) {
          formData.append("session_id", currentSessionId);
        }
        if (capturedFile) {
          formData.append("file", capturedFile);
        }

        // Get token from storage
        const token =
          typeof window !== "undefined"
            ? sessionStorage.getItem("access_token") ||
              document.cookie.match(/access_token=([^;]*)/)?.[1] ||
              ""
            : "";

        const res = await fetch(
          (process.env.NEXT_PUBLIC_API_URL || "/api/v1") + "/ai/chat",
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.detail || errData?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const payload = data.data || {};

        if (payload.session_id) {
          setCurrentSessionId(payload.session_id);
        }
        if (payload.session_title) {
          setSessionTitle(payload.session_title);
        }

        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: payload.reply || "I couldn't generate a response.",
          links: payload.links || [],
          autoReportHint: payload.auto_report_hint || null,
          documentProcessed: payload.document_processed,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Refresh sessions list in background
        fetchSessions();

        // Track unread if window is closed/minimized
        if (!isOpen || isMinimized) {
          setUnreadCount((c) => c + 1);
        }
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Error**: ${errMessage}\n\nPlease check your connection and try again.`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, selectedFile, isLoading, buildHistory, isOpen, isMinimized, currentSessionId]
  );

  const fetchSessions = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("access_token") ||
            document.cookie.match(/access_token=([^;]*)/)?.[1] ||
            ""
          : "";
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "/api/v1") + "/ai/sessions",
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("access_token") ||
            document.cookie.match(/access_token=([^;]*)/)?.[1] ||
            ""
          : "";
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "/api/v1") + `/ai/sessions/${sessionId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error("Could not load session.");
      const data = await res.json();
      const s = data.data;
      setCurrentSessionId(s.id);
      setSessionTitle(s.title || "Conversation");

      if (s.messages && s.messages.length > 0) {
        const loadedMsgs: ChatMessage[] = s.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          links: m.links || [],
          documentProcessed: m.document_name,
          timestamp: new Date(m.created_at || Date.now()),
        }));
        setMessages(loadedMsgs);
      } else {
        setMessages([WELCOME_MESSAGE]);
      }
      setShowHistory(false);
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStartNewChat = () => {
    setCurrentSessionId(null);
    setSessionTitle("New Conversation");
    setMessages([WELCOME_MESSAGE]);
    setShowHistory(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat conversation?")) return;
    setIsDeletingSessionId(sessionId);
    try {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("access_token") ||
            document.cookie.match(/access_token=([^;]*)/)?.[1] ||
            ""
          : "";
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "/api/v1") + `/ai/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          handleStartNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setIsDeletingSessionId(null);
    }
  };

  const handleClearAllHistory = async () => {
    if (!confirm("Are you sure you want to delete ALL your chat history? This cannot be undone.")) return;
    try {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("access_token") ||
            document.cookie.match(/access_token=([^;]*)/)?.[1] ||
            ""
          : "";
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "/api/v1") + "/ai/sessions",
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        setSessions([]);
        handleStartNewChat();
      }
    } catch (err) {
      console.error("Failed to clear all history:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
    fetchSessions();
  };

  const clearChat = () => {
    handleStartNewChat();
  };

  return (
    <>
      {/* Inject styles */}
      <style>{AI_CHAT_STYLES}</style>

      {/* ── Floating Action Button ── */}
      {!isOpen && (
        <button
          id="ai-chat-fab"
          onClick={handleOpen}
          className="ai-fab"
          aria-label="Open AI Assistant"
          title="AI Assistant"
        >
          <span className="ai-fab-icon">
            <AISparkIcon />
          </span>
          {unreadCount > 0 && (
            <span className="ai-fab-badge">{unreadCount}</span>
          )}
          <span className="ai-fab-ripple" />
        </button>
      )}

      {/* ── Chat Panel ── */}
      {isOpen && (
        <div
          className={`ai-panel${isMinimized ? " ai-panel--minimized" : ""}${isFullScreen ? " ai-panel--fullscreen" : ""}`}
          id="ai-chat-panel"
        >
          {/* Header */}
          <div className="ai-panel-header">
            <div className="ai-panel-header-left">
              <div className="ai-panel-avatar">
                <AISparkIcon />
              </div>
              <div className="min-w-0">
                <p className="ai-panel-title truncate">
                  {showHistory ? "Chat History" : (sessionTitle || "AI Assistant")}
                </p>
                <p className="ai-panel-subtitle">
                  {showHistory ? (
                    <span className="ai-history-privacy-tag">
                      <LockIcon /> Private to you
                    </span>
                  ) : isLoading ? (
                    <span className="ai-typing-dots">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    "CC Production & QMS"
                  )}
                </p>
              </div>
            </div>
            <div className="ai-panel-actions">
              <button
                onClick={() => {
                  setShowHistory((prev) => {
                    const next = !prev;
                    if (next) fetchSessions();
                    return next;
                  });
                }}
                className={`ai-icon-btn ${showHistory ? "ai-icon-btn--active" : ""}`}
                title={showHistory ? "Back to Current Chat" : "My Chat History (Private)"}
              >
                <HistoryIcon />
              </button>
              <button onClick={handleStartNewChat} className="ai-icon-btn" title="New Chat">
                <PlusIcon />
              </button>
              <button
                onClick={() => {
                  setIsFullScreen((f) => !f);
                  if (isMinimized) setIsMinimized(false);
                }}
                className={`ai-icon-btn ${isFullScreen ? "ai-icon-btn--active" : ""}`}
                title={isFullScreen ? "Exit Full Screen (Esc)" : "Full Screen"}
              >
                {isFullScreen ? <ShrinkIcon /> : <FullScreenIcon />}
              </button>
              <button onClick={() => setIsMinimized((m) => !m)} className="ai-icon-btn" title={isMinimized ? "Expand" : "Minimize"}>
                {isMinimized ? <ExpandIcon /> : <MinimizeIcon />}
              </button>
              <button onClick={() => { setIsOpen(false); setIsFullScreen(false); }} className="ai-icon-btn" title="Close">
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Body area */}
          {!isMinimized && (
            showHistory ? (
              /* ── Chat History View (Strictly Private) ── */
              <div className="ai-history-panel" id="ai-history-area">
                <div className="ai-history-toolbar">
                  <button onClick={handleStartNewChat} className="ai-history-new-btn">
                    <PlusIcon /> New Conversation
                  </button>
                  {sessions.length > 0 && (
                    <button onClick={handleClearAllHistory} className="ai-history-clear-btn" title="Clear all your history">
                      <TrashIcon /> Clear All
                    </button>
                  )}
                </div>

                <div className="ai-history-privacy-banner">
                  <LockIcon />
                  <span>Strictly confidential: Only you can view your chat history.</span>
                </div>

                <div className="ai-history-list">
                  {isLoadingHistory && sessions.length === 0 ? (
                    <div className="ai-history-empty">
                      <div className="ai-thinking" style={{ justifyContent: "center" }}>
                        <span /><span /><span />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Loading your conversations...</p>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="ai-history-empty">
                      <div className="mx-auto w-10 h-10 rounded-full bg-[#EBF0FF] text-[#0044E6] flex items-center justify-center mb-2">
                        <AISparkIcon />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">No saved chats yet</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                        Your conversations with the AI will be privately saved here for you.
                      </p>
                      <button onClick={handleStartNewChat} className="ai-history-new-btn mt-3" style={{ margin: "14px auto 0" }}>
                        <PlusIcon /> Start First Chat
                      </button>
                    </div>
                  ) : (
                    sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className={`ai-history-item ${currentSessionId === s.id ? "ai-history-item--active" : ""}`}
                      >
                        <div className="ai-history-item-left">
                          <div className="ai-history-item-title">
                            {s.title || "Untitled Conversation"}
                          </div>
                          <div className="ai-history-item-meta">
                            <span>{s.message_count} {s.message_count === 1 ? "msg" : "msgs"}</span>
                            <span>•</span>
                            <span>{formatRelativeTime(s.updated_at || s.created_at)}</span>
                            {currentSessionId === s.id && (
                              <>
                                <span>•</span>
                                <span className="text-[#0044E6] font-bold">Active</span>
                              </>
                            )}
                          </div>
                          {s.last_message_preview && (
                            <div className="ai-history-item-preview">{s.last_message_preview}</div>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          className="ai-history-item-delete"
                          title="Delete this conversation"
                          disabled={isDeletingSessionId === s.id}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="ai-messages" id="ai-messages-area">
                {messages.map((msg) => (
                  <div key={msg.id} className={`ai-msg-row ai-msg-row--${msg.role}`}>
                    {msg.role === "assistant" && (
                      <div className="ai-msg-avatar">
                        <AISparkIcon />
                      </div>
                    )}
                    <div className={`ai-msg-bubble ai-msg-bubble--${msg.role} ${msg.isError ? "ai-msg-bubble--error" : ""}`}>
                      {/* Document badge */}
                      {msg.documentProcessed && (
                        <div className="ai-doc-badge">
                          <DocIcon />
                          <span>{msg.documentProcessed}</span>
                        </div>
                      )}

                      {/* Message content */}
                      <div className="ai-msg-content">
                        {renderMarkdown(msg.content)}
                      </div>

                      {/* Result links */}
                      {msg.links && msg.links.length > 0 && (
                        <div className="ai-links">
                          <p className="ai-links-label">Relevant records:</p>
                          {msg.links.map((link, li) => (
                            <Link
                              key={li}
                              href={link.href}
                              className={`ai-link-chip ${linkBadgeClass(link.type)}`}
                            >
                              <span className="ai-link-label">{link.label || link.href}</span>
                              <span className="ai-link-type">{link.type}</span>
                              <ArrowIcon />
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Auto-report hint */}
                      {msg.autoReportHint && (
                        <div className="ai-report-hint">
                          <p className="ai-report-hint-text">{msg.autoReportHint.message}</p>
                          <div className="ai-report-hint-buttons">
                            {["Cut Panel", "Inline", "End Line", "Finishing", "QA Audit"].map((rt) => (
                              <button
                                key={rt}
                                className="ai-report-type-btn"
                                onClick={() => sendMessage(`Create a ${rt} QC report from the uploaded document`)}
                              >
                                {rt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="ai-msg-time">
                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="ai-msg-user-avatar">U</div>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="ai-msg-row ai-msg-row--assistant">
                    <div className="ai-msg-avatar"><AISparkIcon /></div>
                    <div className="ai-msg-bubble ai-msg-bubble--assistant ai-msg-bubble--loading">
                      <div className="ai-thinking">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggested prompts (show only at start) */}
              {messages.length <= 1 && (
                <div className="ai-suggestions">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      className="ai-suggestion-chip"
                      onClick={() => sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* File preview */}
              {selectedFile && (
                <div className="ai-file-preview">
                  <DocIcon />
                  <span className="ai-file-name">{selectedFile.name}</span>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ai-file-remove"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Input bar */}
              <div className="ai-input-bar">
                <button
                  className="ai-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach document (PDF, DOCX, PNG, JPG)"
                >
                  <PaperclipIcon />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                  className="ai-file-input-hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />
                <textarea
                  ref={inputRef}
                  id="ai-chat-input"
                  className="ai-textarea"
                  placeholder="Ask me anything… (Shift+Enter for new line)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  id="ai-send-btn"
                  className={`ai-send-btn ${(!input.trim() && !selectedFile) || isLoading ? "ai-send-btn--disabled" : ""}`}
                  onClick={() => sendMessage()}
                  disabled={(!input.trim() && !selectedFile) || isLoading}
                  aria-label="Send message"
                >
                  <SendIcon />
                </button>
              </div>
            </>
            )
          )}
        </div>
      )}
    </>
  );
}

function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function AISparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function FullScreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ShrinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const AI_CHAT_STYLES = `
/* ── FAB ───────────────────────────────────────────────────────────────── */
.ai-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 99999;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(5, 150, 105, 0.45), 0 2px 8px rgba(0,0,0,0.15);
  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
  outline: none;
}
.ai-fab:hover {
  transform: scale(1.10) translateY(-2px);
  box-shadow: 0 12px 40px rgba(5, 150, 105, 0.55), 0 4px 12px rgba(0,0,0,0.18);
}
.ai-fab:active { transform: scale(0.95); }
.ai-fab-icon { position: relative; z-index: 1; }
.ai-fab-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid white;
}
.ai-fab-ripple {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  animation: ai-ripple 2.5s ease-out infinite;
}
@keyframes ai-ripple {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.2); opacity: 0; }
}

/* ── Panel ──────────────────────────────────────────────────────────────── */
.ai-panel {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 99999;
  width: 420px;
  max-width: calc(100vw - 40px);
  height: 640px;
  max-height: calc(100vh - 80px);
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 24px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(5,150,105,0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ai-panel-in 0.35s cubic-bezier(0.34,1.56,0.64,1);
  border: 1px solid rgba(5,150,105,0.15);
  transition: width 0.35s cubic-bezier(0.4,0,0.2,1),
              height 0.35s cubic-bezier(0.4,0,0.2,1),
              bottom 0.35s cubic-bezier(0.4,0,0.2,1),
              right 0.35s cubic-bezier(0.4,0,0.2,1),
              border-radius 0.35s ease,
              box-shadow 0.35s ease;
}
@keyframes ai-panel-in {
  from { opacity: 0; transform: scale(0.85) translateY(24px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.ai-panel--minimized {
  height: auto !important;
}
/* Full-screen mode: large centered overlay */
.ai-panel--fullscreen {
  width: min(1100px, 92vw) !important;
  height: 90vh !important;
  max-height: 90vh !important;
  max-width: 92vw !important;
  bottom: 5vh !important;
  right: 50% !important;
  transform: translateX(50%);
  border-radius: 20px !important;
  box-shadow: 0 32px 120px rgba(0,0,0,0.28), 0 8px 32px rgba(5,150,105,0.18) !important;
  z-index: 100000;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
  color: white;
  border-radius: 24px 24px 0 0;
  flex-shrink: 0;
}
.ai-panel-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ai-panel-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ai-panel-title {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
  margin: 0;
}
.ai-panel-subtitle {
  font-size: 11px;
  opacity: 0.75;
  margin: 0;
  font-weight: 600;
}
.ai-panel-actions {
  display: flex;
  gap: 4px;
}
.ai-icon-btn {
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  cursor: pointer;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.ai-icon-btn:hover { background: rgba(255,255,255,0.28); }

/* ── Messages ─────────────────────────────────────────────────────────── */
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}
.ai-messages::-webkit-scrollbar { width: 4px; }
.ai-messages::-webkit-scrollbar-track { background: transparent; }
.ai-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

.ai-msg-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  animation: ai-msg-in 0.25s ease;
}
@keyframes ai-msg-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ai-msg-row--user { flex-direction: row-reverse; }
.ai-msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #059669, #0d9488);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
}
.ai-msg-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
}

.ai-msg-bubble {
  max-width: 86%;
  border-radius: 18px;
  padding: 10px 14px;
  font-size: 13.5px;
  line-height: 1.55;
}
.ai-msg-bubble--assistant {
  background: #f0fdf9;
  color: #0f172a;
  border: 1px solid #d1fae5;
  border-bottom-left-radius: 4px;
}
.ai-msg-bubble--user {
  background: linear-gradient(135deg, #059669, #0d9488);
  color: white;
  border-bottom-right-radius: 4px;
}
.ai-msg-bubble--error {
  background: #fef2f2;
  border-color: #fecaca;
}
.ai-msg-bubble--loading {
  padding: 14px 18px;
}

/* ── Markdown styles ─────────────────────────────────────────────────── */
.ai-msg-content { display: flex; flex-direction: column; gap: 2px; }
.ai-msg-heading { font-size: 14px; font-weight: 800; margin: 4px 0 2px; }
.ai-msg-h1 { font-size: 15px; font-weight: 900; margin: 4px 0 2px; }
.ai-msg-p { margin: 1px 0; }
.ai-msg-li { margin: 1px 0 1px 14px; list-style: disc; display: list-item; }
.ai-msg-spacer { height: 4px; }
.ai-code {
  background: rgba(0,0,0,0.08);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: monospace;
  font-size: 12px;
}
.ai-msg-bubble--user .ai-code { background: rgba(255,255,255,0.2); }

/* ── Thinking dots ───────────────────────────────────────────────────── */
.ai-thinking {
  display: flex;
  gap: 5px;
  align-items: center;
}
.ai-thinking span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #059669;
  animation: ai-bounce 1.2s ease-in-out infinite;
}
.ai-thinking span:nth-child(2) { animation-delay: 0.2s; }
.ai-thinking span:nth-child(3) { animation-delay: 0.4s; }
@keyframes ai-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-7px); }
}

/* ── Typing dots in subtitle ─────────────────────────────────────────── */
.ai-typing-dots {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}
.ai-typing-dots span {
  width: 4px; height: 4px;
  border-radius: 50%;
  background: rgba(255,255,255,0.8);
  animation: ai-bounce 1s ease-in-out infinite;
}
.ai-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
.ai-typing-dots span:nth-child(3) { animation-delay: 0.3s; }

/* ── Timestamp ───────────────────────────────────────────────────────── */
.ai-msg-time {
  font-size: 10px;
  opacity: 0.5;
  margin-top: 4px;
  text-align: right;
}

/* ── Links ───────────────────────────────────────────────────────────── */
.ai-links { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
.ai-links-label { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 2px; }
.ai-link-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  text-decoration: none;
  font-size: 12px;
  font-weight: 700;
  transition: transform 0.15s, box-shadow 0.15s;
  border: 1px solid transparent;
}
.ai-link-chip:hover { transform: translateX(3px); }
.ai-link-label { flex: 1; truncate: true; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ai-link-type { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.6; }
.ai-badge-order { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.ai-badge-vendor { background: #fdf4ff; color: #7c3aed; border-color: #e9d5ff; }
.ai-badge-sample { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
.ai-badge-bulk { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
.ai-badge-default { background: #f8fafc; color: #475569; border-color: #e2e8f0; }

/* ── Doc badge ────────────────────────────────────────────────────────── */
.ai-doc-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  margin-bottom: 6px;
}

/* ── Auto-report hint ─────────────────────────────────────────────────── */
.ai-report-hint {
  margin-top: 10px;
  padding: 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
}
.ai-report-hint-text { font-size: 12.5px; font-weight: 600; color: #92400e; margin-bottom: 8px; }
.ai-report-hint-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.ai-report-type-btn {
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s;
}
.ai-report-type-btn:hover { background: #d97706; }

/* ── Suggestions ──────────────────────────────────────────────────────── */
.ai-suggestions {
  padding: 0 14px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}
.ai-suggestion-chip {
  background: #f0fdf4;
  border: 1px solid #d1fae5;
  color: #065f46;
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}
.ai-suggestion-chip:hover { background: #d1fae5; transform: translateY(-1px); }

/* ── File preview ─────────────────────────────────────────────────────── */
.ai-file-preview {
  margin: 0 14px 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: #065f46;
  flex-shrink: 0;
}
.ai-file-name { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ai-file-remove {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  font-weight: 900;
  padding: 0 2px;
}
.ai-file-input-hidden { display: none; }

/* ── Input bar ────────────────────────────────────────────────────────── */
.ai-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid #f1f5f9;
  background: #ffffff;
  flex-shrink: 0;
}
.ai-attach-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.ai-attach-btn:hover { background: #e2e8f0; color: #059669; }
.ai-textarea {
  flex: 1;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 9px 12px;
  font-size: 13.5px;
  font-family: inherit;
  color: #0f172a;
  resize: none;
  outline: none;
  line-height: 1.5;
  max-height: 100px;
  overflow-y: auto;
  transition: border-color 0.15s;
}
.ai-textarea:focus { border-color: #059669; background: #fff; }
.ai-send-btn {
  background: linear-gradient(135deg, #059669, #0d9488);
  border: none;
  border-radius: 10px;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
}
.ai-icon-btn--active {
  background: #ecfdf5 !important;
  color: #059669 !important;
  border-color: #a7f3d0 !important;
}

/* ── History Panel ────────────────────────────────────────────────────── */
.ai-history-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
}
.ai-history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.ai-history-new-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #059669, #0d9488);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}
.ai-history-new-btn:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}
.ai-history-clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.ai-history-clear-btn:hover {
  background: #fee2e2;
}
.ai-history-privacy-banner {
  margin: 10px 14px 4px;
  padding: 8px 12px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: #065f46;
  font-weight: 600;
  flex-shrink: 0;
}
.ai-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-history-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px 12px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}
.ai-history-item:hover {
  border-color: #059669;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.ai-history-item--active {
  border-color: #059669;
  background: #f0fdf4;
}
.ai-history-item-left {
  flex: 1;
  min-width: 0;
}
.ai-history-item-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-history-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 11px;
  color: #64748b;
}
.ai-history-item-preview {
  margin-top: 4px;
  font-size: 11.5px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-history-item-delete {
  background: none;
  border: none;
  color: #94a3b8;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  margin-left: 8px;
  transition: color 0.15s, background 0.15s;
}
.ai-history-item-delete:hover {
  color: #dc2626;
  background: #fee2e2;
}
.ai-history-empty {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}
.ai-history-privacy-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #059669;
  font-weight: 700;
}
`;
