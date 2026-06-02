"use client";
import React, { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, X, Download, FileText, Image, File } from "lucide-react";
import api from "@/services/api";
import { formatLocalDateTime } from "@/services/dateUtils";

interface Attachment {
  id: string;
  file_name: string;
  mime_type?: string;
  file_size: number;
  uploaded_at: string;
}

interface AttachmentPanelProps {
  reportId?: string;                         // undefined when report is not yet saved
  initialAttachments?: Attachment[];
  pendingFiles: File[];                       // files queued before report is saved
  onPendingChange: (files: File[]) => void;  // update parent with pending queue
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime?: string) {
  if (!mime) return <File className="w-4 h-4" />;
  if (mime.startsWith("image/")) return <Image className="w-4 h-4" />;
  if (mime.includes("pdf")) return <FileText className="w-4 h-4 text-red-400" />;
  return <FileText className="w-4 h-4 text-sky-400" />;
}

const ALLOWED_EXT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt";
const EMPTY_ATTACHMENTS: Attachment[] = [];

export default function AttachmentPanel({
  reportId, initialAttachments = EMPTY_ATTACHMENTS, pendingFiles, onPendingChange
}: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!reportId) return;
    api.get(`/qc-reports/${reportId}`)
      .then(res => setAttachments(res.data.data?.attachments || []))
      .catch(() => setAttachments(initialAttachments));
  }, [reportId, initialAttachments]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);

    if (!reportId) {
      // Report not yet saved — queue locally
      onPendingChange([...pendingFiles, ...arr]);
      return;
    }
    // Upload immediately if report exists
    for (const file of arr) {
      setUploading(file.name);
      const formData = new FormData();
      formData.append("file", file);
      try {
        await api.post(`/qc-reports/${reportId}/attachments`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch {
        alert(`Failed to upload: ${file.name}`);
      }
    }
    setUploading(null);
    // Refresh list
    try {
      const res = await api.get(`/qc-reports/${reportId}`);
      setAttachments(res.data.data?.attachments || []);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!reportId) return;
    try {
      await api.delete(`/qc-reports/${reportId}/attachments/${id}`);
      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch {
      alert("Failed to delete attachment.");
    }
  };

  const removePending = (idx: number) => {
    onPendingChange(pendingFiles.filter((_, i) => i !== idx));
  };

  const handleDownload = (id: string) => {
    if (!reportId) return;
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/qc-reports/${reportId}/attachments/${id}/download`,
      "_blank"
    );
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
      <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-3 opacity-70">
        <Paperclip className="w-4 h-4 text-indigo-400" /> Attachments
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
          dragging
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50"
        }`}
      >
        <Upload className={`w-7 h-7 mx-auto mb-3 ${dragging ? "text-indigo-400" : "text-slate-600"}`} />
        <p className="text-slate-400 text-xs font-bold">
          Drag & drop files here or <span className="text-indigo-400 underline">browse</span>
        </p>
        <p className="text-slate-600 text-[10px] mt-1 font-black uppercase tracking-widest">
          PDF · DOCX · XLSX · JPG · PNG · TXT
        </p>
        {uploading && (
          <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">
            Uploading {uploading}…
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXT}
          className="hidden"
          onChange={e => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Saved attachments */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map(att => (
            <li key={att.id}
              className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-2xl group hover:border-slate-600 transition-all"
            >
              <span className="text-slate-400">{fileIcon(att.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">{att.file_name}</p>
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                  {formatBytes(att.file_size)} · {formatLocalDateTime(att.uploaded_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(att.id)}
                className="p-1.5 text-slate-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(att.id)}
                className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Pending (pre-save) files */}
      {pendingFiles.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2">
            Queued — will upload on submit
          </p>
          <ul className="space-y-2">
            {pendingFiles.map((f, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                <FileText className="w-4 h-4 text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{f.name}</p>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">{formatBytes(f.size)}</p>
                </div>
                <button type="button" onClick={() => removePending(i)} className="text-slate-600 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {attachments.length === 0 && pendingFiles.length === 0 && (
        <p className="text-slate-700 text-[10px] text-center font-black uppercase tracking-widest">No attachments yet</p>
      )}
    </div>
  );
}
