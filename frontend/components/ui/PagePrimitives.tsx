"use client";

import React from "react";

export function IndustrialHeading({
  eyebrow,
  title,
  highlight,
  subtitle,
  align = "left",
  compact = false,
  tone = "mint",
}: {
  eyebrow?: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  align?: "left" | "center";
  compact?: boolean;
  tone?: "mint" | "neutral";
}) {
  const accent =
    tone === "neutral"
      ? {
          bar: "from-slate-300 to-slate-500 shadow-slate-500/10",
          eyebrow: "text-slate-500",
          highlight: "text-slate-500",
        }
      : {
          bar: "from-blue-400 to-blue-700 shadow-blue-600/20",
          eyebrow: "text-blue-600",
          highlight: "text-[#0044E6]",
        };

  return (
    <div className={`flex ${compact ? "gap-3 items-center" : "gap-4 items-start"} ${align === "center" ? "justify-center text-center" : ""}`}>
      <div className={`${compact ? "h-9 w-1.5" : "h-12 w-2"} shrink-0 rounded-full bg-gradient-to-b ${accent.bar} shadow-sm`} />
      <div className="min-w-0">
        {eyebrow && (
          <p className={`${compact ? "mb-0.5 text-[10px] md:text-[11px]" : "mb-1 text-xs"} font-black uppercase tracking-wider ${accent.eyebrow}`}>
            {eyebrow}
          </p>
        )}
        <h1
          className={`${compact ? "text-xl md:text-2xl" : "text-2xl md:text-4xl"} font-black italic uppercase leading-tight tracking-tight text-slate-950 break-words`}
        >
          {title}
          {highlight && <span className={accent.highlight}> {highlight}</span>}
        </h1>
        {subtitle && (
          <p className={`${compact ? "mt-0.5 text-[10px] md:text-[11px]" : "mt-2 text-xs md:text-sm"} max-w-5xl font-bold uppercase tracking-wider text-slate-500`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function PageToolbar({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      {children}
    </section>
  );
}

export function SearchInput({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#0044E6]">
        {icon}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#0044E6] focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0044E6] px-5 text-sm font-black text-white shadow-lg shadow-[0_4px_14px_rgba(0,68,230,0.2)] transition hover:-translate-y-0.5 hover:bg-[#0036B8] active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

export function StatusBadge({
  children,
  tone = "info",
  status,
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  status?: "active" | "pending" | "critical" | "inactive";
}) {
  const resolvedTone = status
    ? status === "active"
      ? "success"
      : status === "pending"
        ? "warning"
        : status === "critical"
          ? "danger"
          : "neutral"
    : tone;
  const styles = {
    info: "border-[#C7D6FF] bg-[#EBF0FF] text-[#0044E6]",
    success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${styles[resolvedTone]}`}>
      {children}
    </span>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-11 w-11 rounded-xl bg-slate-100" />
          <div className="mt-8 h-5 w-2/3 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
          <div className="mt-8 h-3 rounded bg-slate-100" />
          <div className="mt-3 h-10 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  description?: string;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EBF0FF] text-[#0044E6]">
        {icon || <span className="text-lg font-black">--</span>}
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{message || description}</p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export const formControlClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#16233B] outline-none transition focus:border-[#0044E6] focus:bg-white focus:ring-4 focus:ring-blue-100";
