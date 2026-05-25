"use client";
import React, { useEffect, useState } from "react";
import { Layers, Palette } from "lucide-react";
import api from "@/services/api";

interface ArticleColorSelectorProps {
  articleCodeId: string;
  productColorId: string;
  onChange: (field: string, value: string) => void;
  trackType?: "bulk" | "sampling";
}

export default function ArticleColorSelector({
  articleCodeId,
  productColorId,
  onChange,
  trackType = "bulk"
}: ArticleColorSelectorProps) {
  const [articles, setArticles] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);

  useEffect(() => {
    fetchArticles();
  }, [trackType]);

  const fetchArticles = async () => {
    try {
      const res = await api.get("/articles", { params: { track_type: trackType } });
      setArticles(res.data.data || []);
    } catch (err) {
      console.warn("Failed to fetch articles", err);
    }
  };

  useEffect(() => {
    if (articleCodeId) {
      const selected = articles.find((a: any) => a.id === articleCodeId);
      setColors(selected?.colors || []);
    } else {
      setColors([]);
    }
  }, [articleCodeId, articles]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Layers className="w-3 h-3" /> Article Code
        </label>
        <select
          value={articleCodeId}
          onChange={(e) => {
            onChange("article_code_id", e.target.value);
            onChange("product_color_id", ""); // reset color when article changes
          }}
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <option value="">Select Article</option>
          {articles.map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.code} {a.name ? `— ${a.name}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Palette className="w-3 h-3" /> Product Color
        </label>
        <select
          value={productColorId}
          disabled={!articleCodeId}
          onChange={(e) => onChange("product_color_id", e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
        >
          <option value="">Select Color</option>
          {colors.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.color_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
