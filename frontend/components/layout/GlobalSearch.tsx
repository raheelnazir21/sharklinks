/**
 * GlobalSearch.tsx — Real-time global search with suggestion dropdown.
 * Debounces input, calls /api/v1/search, and renders typed result cards.
 * Keyboard navigable (↑ ↓ Enter Escape).
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Package, Building2, FlaskConical, Layers } from "lucide-react";
import api from "@/services/api";

interface SearchResult {
  type: "order" | "vendor" | "sample" | "bulk";
  label: string;
  sublabel: string;
  href: string;
  badge: string;
}

const TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  order: {
    icon: <Package className="h-4 w-4" />,
    color: "text-teal-700",
    bg: "bg-teal-50",
  },
  vendor: {
    icon: <Building2 className="h-4 w-4" />,
    color: "text-violet-700",
    bg: "bg-violet-50",
  },
  sample: {
    icon: <FlaskConical className="h-4 w-4" />,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  bulk: {
    icon: <Layers className="h-4 w-4" />,
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
};

const TYPE_LABEL: Record<string, string> = {
  order: "Order",
  vendor: "Vendor",
  sample: "Sample",
  bulk: "Bulk",
};

export default function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch suggestions ────────────────────────────────────────────────────
  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/search", { params: { q } });
      const data: SearchResult[] = res.data?.data || [];
      setResults(data);
      setOpen(true);
      setActiveIdx(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Debounce input ───────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchResults(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  // ── Click outside to close ───────────────────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      navigate(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function navigate(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <div className="relative hidden md:block">
      {/* Input */}
      <div className="relative flex items-center">
        {loading ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-500" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          ref={inputRef}
          id="global-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search orders, vendors, projects…"
          autoComplete="off"
          className="h-10 w-72 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-50"
        />
        {query && (
          <button
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10"
        >
          {results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-500">
                No results found for{" "}
                <span className="text-slate-800">"{query}"</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try searching by order number, vendor name, or project name
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              {(["order", "vendor", "sample", "bulk"] as const).map((type) => {
                const items = grouped[type];
                if (!items?.length) return null;
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    {/* Group header */}
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                      <span className={`${cfg.color}`}>{cfg.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {TYPE_LABEL[type]}s
                      </span>
                    </div>
                    {/* Items */}
                    {items.map((result, i) => {
                      const flatIdx = results.indexOf(result);
                      const isActive = flatIdx === activeIdx;
                      return (
                        <button
                          key={`${type}-${i}`}
                          onClick={() => navigate(result)}
                          onMouseEnter={() => setActiveIdx(flatIdx)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                            isActive
                              ? "bg-emerald-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          {/* Type badge */}
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cfg.bg} ${cfg.color}`}
                          >
                            {cfg.icon}
                          </span>
                          {/* Text */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {result.label}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {result.sublabel}
                            </p>
                          </div>
                          {/* Arrow hint on active */}
                          {isActive && (
                            <span className="shrink-0 text-xs font-black text-emerald-600">
                              ↵
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2">
            <span className="text-[10px] text-slate-400">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">↑</kbd>{" "}
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">↓</kbd>{" "}
              to navigate
            </span>
            <span className="text-[10px] text-slate-400">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">↵</kbd>{" "}
              to open
            </span>
            <span className="text-[10px] text-slate-400">
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">Esc</kbd>{" "}
              to close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
