"use client";

/**
 * StageComments.tsx
 * Threaded comment system for production stages.
 * Replaces the single remarks textarea.
 * - Newest comments on top
 * - 5 shown by default, expand to see all
 * - Post, view, delete (own or admin)
 */

import { useEffect, useState, useRef } from "react";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Send, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";

interface Comment {
  id: string;
  text: string;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_initials: string;
}

interface StageCommentsProps {
  stageId: string;
  orderId: string;
  disabled?: boolean;
}

const COLORS = [
  "bg-indigo-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-violet-500", "bg-teal-500", "bg-cyan-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const DEFAULT_SHOW = 5;

export default function StageComments({ stageId, orderId, disabled = false }: StageCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = async () => {
    try {
      const res = await api.get(`/comments/stage/${stageId}`);
      setComments(res.data.data || []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [stageId]);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const res = await api.post(`/comments/stage/${stageId}`, { text: text.trim() });
      setComments((prev) => [res.data.data, ...prev]);
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch {
      // silent
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const visibleComments = expanded ? comments : comments.slice(0, DEFAULT_SHOW);
  const hiddenCount = comments.length - DEFAULT_SHOW;

  return (
    <div className="mt-10 space-y-5 relative z-10">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <span className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-wider">
          Production Comments
        </span>
        {comments.length > 0 && (
          <span className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </span>
        )}
      </div>

      {/* Input box */}
      {!disabled && (
        <div className="flex gap-3 items-end">
          {/* Author avatar */}
          <div className={`flex-shrink-0 h-9 w-9 rounded-full ${avatarColor(user?.full_name || "U")} flex items-center justify-center text-xs font-black text-white`}>
            {(user?.full_name || "U").slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost();
              }}
              placeholder="Write a comment… (Ctrl+Enter to post)"
              className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 pr-14 text-sm font-semibold text-slate-900 resize-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 leading-relaxed overflow-hidden shadow-sm"
            />
            <button
              onClick={handlePost}
              disabled={posting || !text.trim()}
              className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-bold">Loading comments…</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 py-8 text-center">
          <MessageSquare className="w-7 h-7 text-slate-600 mx-auto mb-2" />
          <p className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-wider">
            No comments yet
          </p>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">
            Be the first to leave a production note.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleComments.map((comment, idx) => {
            const isOwn = user && comment.author_id === user.id;
            const canDelete = isOwn || isAdmin;
            const isFirst = idx === 0;

            return (
              <div
                key={comment.id}
                className={`group flex gap-3 rounded-2xl p-4 transition-all shadow-sm ${
                  isFirst
                    ? "bg-emerald-50/50 border border-emerald-200"
                    : "bg-white border border-slate-200"
                }`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 h-9 w-9 rounded-full ${avatarColor(comment.author_name)} flex items-center justify-center text-xs font-black text-white shadow-sm`}>
                  {comment.author_initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-slate-900 truncate">
                      {comment.author_name}
                    </span>
                    {isFirst && (
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                        Latest
                      </span>
                    )}
                    <span className="ml-auto text-xs font-semibold text-slate-500 flex-shrink-0">
                      {timeAgo(comment.created_at)}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-slate-400 hover:text-rose-500"
                        title="Delete comment"
                      >
                        {deletingId === comment.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                    {comment.text}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Expand / collapse */}
          {comments.length > DEFAULT_SHOW && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 py-3 text-xs font-black uppercase tracking-wider text-slate-400 transition hover:text-indigo-400 hover:border-indigo-800"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Show {hiddenCount} more comment{hiddenCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
