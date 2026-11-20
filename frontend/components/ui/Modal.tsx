"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-lg" }: ModalProps) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Centering Wrapper */}
      <div className="flex min-h-full items-center justify-center">
        {/* Modal Content */}
        <div className={`relative z-10 w-full ${maxWidth} my-6 max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15 animate-in fade-in zoom-in duration-200`}>
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 shrink-0 rounded-t-2xl">
            <h3 className="text-lg font-bold tracking-tight text-[#16233B]">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-200/60 hover:text-slate-800 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 bg-white">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
