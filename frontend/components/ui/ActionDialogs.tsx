"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "info";
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  const toneClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
      : tone === "warning"
        ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20"
        : "bg-[#0044E6] hover:bg-[#0036B8] shadow-[0_4px_14px_rgba(0,68,230,0.2)]";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/15">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-950">{title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-black text-white shadow-lg disabled:opacity-60 ${toneClass}`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type FeedbackDialogProps = {
  open: boolean;
  title: string;
  message: string;
  type?: "success" | "error";
  onClose: () => void;
};

export function FeedbackDialog({
  open,
  title,
  message,
  type = "success",
  onClose,
}: FeedbackDialogProps) {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  React.useEffect(() => {
    if (!open || type !== "success") return;

    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 2500);

    return () => clearTimeout(timer);
  }, [open, type]);

  if (!open) return null;
  const isSuccess = type === "success";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl shadow-slate-950/15"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-950"
          aria-label="Close popup"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${isSuccess ? "bg-[#EBF0FF] text-[#0044E6]" : "bg-red-50 text-red-700"}`}>
          {isSuccess ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
        </div>
        <h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}
