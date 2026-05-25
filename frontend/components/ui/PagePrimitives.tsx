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
          bar: "from-slate-300 to-slate-600 shadow-slate-500/10",
          eyebrow: "text-slate-500",
          highlight: "text-slate-500",
        }
      : {
          bar: "from-emerald-300 to-teal-500 shadow-emerald-500/20",
          eyebrow: "text-teal-700",
          highlight: "text-emerald-500",
        };

  return (
    <div className={`flex gap-4 ${align === "center" ? "justify-center text-center" : "items-start"}`}>
      <div className={`${compact ? "h-12 w-2" : "h-16 w-2.5"} mt-1 shrink-0 rounded-full bg-gradient-to-b ${accent.bar} shadow-lg`} />
      <div>
        {eyebrow && (
          <p className={`mb-2 text-[10px] font-black uppercase tracking-[0.28em] ${accent.eyebrow}`}>
            {eyebrow}
          </p>
        )}
        <h1
          className={`${compact ? "text-3xl md:text-4xl" : "text-4xl md:text-6xl"} font-black italic uppercase leading-none tracking-tight text-slate-950`}
        >
          {title}
          {highlight && <span className={accent.highlight}> {highlight}</span>}
        </h1>
        {subtitle && (
          <p className={`${compact ? "mt-3 text-[11px]" : "mt-4 text-xs"} max-w-5xl font-black uppercase tracking-[0.22em] text-slate-500 md:tracking-[0.26em]`}>
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
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-teal-600">
        {icon}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-600/15 transition hover:-translate-y-0.5 hover:bg-emerald-500 active:translate-y-0"
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
    info: "border-teal-200 bg-teal-50 text-teal-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-teal-700">
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
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100";
