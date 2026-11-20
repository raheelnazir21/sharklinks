"use client";

import React, { useState, useEffect } from "react";
import api from "@/services/api";
import { Paperclip, Upload, X, Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";

export const DEFAULT_BULK_STAGES = [
  { name: "customer_order_wrapping_card", label: "Customer Order / Wrapping Card" },
  { name: "pp_sample_development", label: "PP Sample Development" },
  { name: "full_flag_dying_production", label: "Full Flag Dying Production" },
  { name: "sublimation", label: "Sublimation" },
  { name: "bulk_fabric_cutting", label: "Bulk Fabric Cutting" },
  { name: "printing_embroidery_embellishment", label: "Printing / Embroidery / Embellishment" },
  { name: "stitching", label: "Stitching" },
  { name: "washing", label: "Washing" },
  { name: "pressing", label: "Pressing" },
  { name: "finishing", label: "Finishing" },
  { name: "packing", label: "Packing" },
  { name: "final_random_inspection", label: "Final Random Inspection" },
  { name: "shipment_ex_factory", label: "Shipment / Ex-Factory" },
];

export const DEFAULT_SAMPLE_STAGES = [
  { name: "sample_start", label: "Sample Start" },
  { name: "fabrication", label: "Fabrication" },
  { name: "fabric_cutting", label: "Fabric Cutting" },
  { name: "embellishment", label: "Printing / Embroidery / Embellishment" },
  { name: "stitching", label: "Stitching" },
  { name: "washing", label: "Washing" },
  { name: "finishing", label: "Finishing" },
  { name: "qc_check", label: "PPS QC Check" },
  { name: "dispatch", label: "Dispatch" },
  { name: "sample_completed", label: "Sample Completed" },
];

export type ReferenceAttachment = {
  url: string;
  requirement: string;
  filename?: string;
};

export type FloorLineAssignment = {
  floor_id: string;
  line_ids: string[];
};

export interface StageChunk {
  id: string;
  name: string;
  target_days: number;
  buffer_days?: number;
  stage_names: string[];
}

export function buildStagePayload(
  stages: Array<{ name: string; label: string }>,
  stageDays: Record<string, number>,
  stageBuffers: Record<string, number>,
  moduleType: "sampling" | "bulk",
  chunkedStageNames: string[] = []
) {
  return stages
    .filter((stage) => Number(stageDays[stage.name]) > 0 || chunkedStageNames.includes(stage.name))
    .map((stage, index) => ({
      stage_name: stage.name,
      stage_order: index + 1,
      target_days: chunkedStageNames.includes(stage.name) ? 0 : Number(stageDays[stage.name]),
      buffer_days: Number(stageBuffers[stage.name] || 0),
      module_type: moduleType,
      is_required: true,
    }));
}

export function StageMergingComponent(props: any) {
  const defaultStages = props.defaultStages || props.stages || [];
  const stageDays = props.stageDays || {};
  const setStageDays = props.setStageDays || props.onStageDaysChange || (() => {});
  const stageBuffers = props.stageBuffers || {};
  const setStageBuffers = props.setStageBuffers || props.onStageBuffersChange || (() => {});
  const chunks = props.chunks || [];
  const setChunks = props.setChunks || props.onChunksChange || (() => {});
  const selectedMergeStages = props.selectedMergeStages || props.selectedStages || [];
  const setSelectedMergeStages = props.setSelectedMergeStages || props.onSelectedStagesChange || (() => {});
  const themeHex = props.themeHex || "#10b981";
  const themeColor = props.themeColor || "emerald";

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [chunkDaysInput, setChunkDaysInput] = useState<number>(3);
  const [chunkBufferInput, setChunkBufferInput] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // helper to check if a stage is chunked
  const isChunked = (stageName: string) => (chunks || []).some((c: any) => (c.stage_names || []).includes(stageName));

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleToggleSelect = (stageName: string) => {
    if (selectedMergeStages.includes(stageName)) {
      setSelectedMergeStages(selectedMergeStages.filter((n: string) => n !== stageName));
    } else {
      setSelectedMergeStages([...selectedMergeStages, stageName]);
    }
  };

  const getAutoChunkName = () => {
    const selectedStagesSorted = defaultStages
      .filter((s: any) => selectedMergeStages.includes(s.name));
    if (selectedStagesSorted.length === 0) return "Merged Phase";
    if (selectedStagesSorted.length === 1) return selectedStagesSorted[0].label;
    return `${selectedStagesSorted[0].label} to ${selectedStagesSorted[selectedStagesSorted.length - 1].label}`;
  };

  const handleMergeClick = () => {
    if (selectedMergeStages.length < 2) return;
    const sumDays = selectedMergeStages.reduce((acc: number, name: string) => acc + (stageDays[name] ?? 0), 0);
    const sumBuffers = selectedMergeStages.reduce((acc: number, name: string) => acc + (stageBuffers[name] ?? 0), 0);
    setChunkDaysInput(sumDays > 0 ? sumDays : 3);
    setChunkBufferInput(sumBuffers > 0 ? sumBuffers : 0);
    setShowMergeModal(true);
  };

  const handleUnmerge = (chunkId: string) => {
    setChunks(chunks.filter((c: any) => c.id !== chunkId));
    setToastMessage("Chunk dissolved!");
  };

  return (
    <div className="space-y-6">
      {/* Active Chunks List */}
      {chunks.length > 0 && (
        <div className="space-y-4">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 italic">Merged Chunks</h5>
          {chunks.map((chunk: any) => (
            <div key={chunk.id} className="bg-slate-950 border border-indigo-500/20 rounded-[2rem] p-6 shadow-lg relative overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                  <div className="min-w-0">
                    <h4 className="text-white text-sm font-black uppercase tracking-wider truncate" title={chunk.name}>
                      {chunk.name}
                    </h4>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-0.5">{chunk.stage_names.length} Stages Merged</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnmerge(chunk.id)}
                  className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-red-400 hover:bg-red-500/20 transition-all active:scale-95 shrink-0"
                >
                  Unmerge
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-400">Total Chunk SLA Days</span>
                  <input 
                    type="number" min="1"
                    required
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-indigo-400 text-center focus:outline-none focus:border-indigo-500"
                    value={chunk.target_days}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setChunks(chunks.map((c: any) => c.id === chunk.id ? { ...c, target_days: val } : c));
                    }}
                  />
                </div>
                <div className="flex items-center justify-between border-l border-slate-800 pl-4">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">+Buffer Days</span>
                  <input 
                    type="number" min="0"
                    className="w-16 bg-slate-950 border border-amber-500/20 rounded-xl px-3 py-2 text-xs font-black text-amber-400 text-center focus:outline-none focus:border-amber-500/50"
                    value={chunk.buffer_days ?? 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setChunks(chunks.map((c: any) => c.id === chunk.id ? { ...c, buffer_days: val } : c));
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-900">
                {chunk.stage_names.map((sName: string) => {
                  const stageObj = defaultStages.find((ds: any) => ds.name === sName);
                  return (
                    <span key={sName} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-900 border border-slate-800 text-slate-200">
                      {stageObj?.label || sName}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Toolbar for Selection */}
      <div className="flex items-center justify-between bg-slate-950 border border-slate-800/80 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">
            Selected for Merging: <strong className="text-white">{selectedMergeStages.length}</strong>
          </span>
          {selectedMergeStages.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedMergeStages([])}
              className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider underline ml-2"
            >
              Clear
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={selectedMergeStages.length < 2}
          onClick={handleMergeClick}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            selectedMergeStages.length >= 2
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg cursor-pointer"
              : "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
          }`}
        >
          Merge Selected ({selectedMergeStages.length})
        </button>
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {defaultStages.map((stage: any) => {
          const chunked = isChunked(stage.name);
          const isSelected = selectedMergeStages.includes(stage.name);

          return (
            <div 
              key={stage.name} 
              className={`border p-4 rounded-2xl transition-all relative ${
                chunked 
                  ? "bg-slate-950/20 border-slate-900/60 opacity-60" 
                  : isSelected 
                    ? "bg-indigo-950/20 border-indigo-500/50 shadow-md"
                    : "bg-slate-950 border-slate-900 hover:border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {!chunked ? (
                    <input 
                      type="checkbox" 
                      id={`select-${stage.name}`}
                      checked={isSelected}
                      onChange={() => handleToggleSelect(stage.name)}
                      className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-0 focus:outline-none bg-slate-900 cursor-pointer"
                    />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-indigo-500/50"></span>
                  )}
                  <label 
                    htmlFor={`select-${stage.name}`}
                    className={`text-xs font-black uppercase tracking-wider truncate cursor-pointer ${
                      isSelected ? "text-indigo-300" : "text-slate-300"
                    }`}
                    title={stage.label}
                  >
                    {stage.label}
                  </label>
                </div>
                {chunked && (
                  <span className="text-xs font-black tracking-wider uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-full shrink-0">
                    Chunked
                  </span>
                )}
              </div>

              {!chunked ? (
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-900">
                  <div>
                    <span className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Target Days</span>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-black text-white focus:outline-none focus:border-slate-700" 
                      value={stageDays[stage.name] ?? 0} 
                      onChange={(e) => setStageDays({ ...stageDays, [stage.name]: parseInt(e.target.value) || 0 })} 
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1">+Buffer Days</span>
                    <input 
                      type="number" 
                      min="0"
                      placeholder="0"
                      className="w-full bg-slate-900 border border-amber-500/20 rounded-lg px-3 py-2 text-xs font-black text-amber-400 focus:outline-none focus:border-amber-500/50" 
                      value={stageBuffers[stage.name] ?? 0} 
                      onChange={(e) => setStageBuffers({ ...stageBuffers, [stage.name]: parseInt(e.target.value) || 0 })} 
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-wider italic">
                  SLA Managed by Parent Chunk
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Merge Modal Popup */}
      <Modal 
        isOpen={showMergeModal} 
        onClose={() => setShowMergeModal(false)}
        title="Combine Stages into Single SLA"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">
              Merged Phase Name
            </label>
            <input 
              type="text"
              id="merged-phase-name-input"
              defaultValue={getAutoChunkName()}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">
                Target Days for Whole Group
              </label>
              <input 
                type="number"
                min="1"
                value={chunkDaysInput}
                onChange={(e) => setChunkDaysInput(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2 italic">
                +Buffer Days (Contingency)
              </label>
              <input 
                type="number"
                min="0"
                value={chunkBufferInput}
                onChange={(e) => setChunkBufferInput(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-amber-500/30 rounded-2xl px-5 py-3 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <span className="block text-[8px] font-black uppercase tracking-widest text-slate-600 mb-2">Stages Included:</span>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-2">
              {selectedMergeStages.map((stName: string) => {
                const s = defaultStages.find((d: any) => d.name === stName);
                return (
                  <div key={stName} className="text-[9px] font-bold text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center justify-between">
                    <span>{s?.label || stName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowMergeModal(false)}
              className="w-1/2 py-3 rounded-xl border border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const nameInput = (document.getElementById("merged-phase-name-input") as HTMLInputElement)?.value || getAutoChunkName();
                const newChunk = {
                  id: Math.random().toString(36).substring(7),
                  name: nameInput,
                  target_days: chunkDaysInput,
                  buffer_days: chunkBufferInput,
                  stage_names: [...selectedMergeStages]
                };
                setChunks([...chunks, newChunk]);
                setSelectedMergeStages([]);
                setShowMergeModal(false);
                setToastMessage(`Created chunk: ${nameInput}`);
              }}
              className="w-1/2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg"
            >
              Confirm Merge
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/40 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export function VendorFloorLineSelector({
  vendorId,
  value,
  onChange,
}: {
  vendorId: string;
  value: FloorLineAssignment[];
  onChange: (assignments: FloorLineAssignment[]) => void;
}) {
  const [floors, setFloors] = useState<any[]>([]);

  useEffect(() => {
    if (!vendorId) {
      setFloors([]);
      onChange([]);
      return;
    }
    api.get(`/vendors/${vendorId}/floors`)
      .then(res => setFloors(res.data.data || []))
      .catch(() => setFloors([]));
  }, [vendorId]);

  const isFloorSelected = (floorId: string) => value.some((assignment) => assignment.floor_id === floorId);
  const floorAssignment = (floorId: string) => value.find((assignment) => assignment.floor_id === floorId);

  const toggleFloor = (floorId: string) => {
    if (isFloorSelected(floorId)) {
      onChange(value.filter((assignment) => assignment.floor_id !== floorId));
      return;
    }
    onChange([...value, { floor_id: floorId, line_ids: [] }]);
  };

  const toggleLine = (floorId: string, lineId: string) => {
    onChange(value.map((assignment) => {
      if (assignment.floor_id !== floorId) return assignment;
      const exists = assignment.line_ids.includes(lineId);
      return {
        ...assignment,
        line_ids: exists
          ? assignment.line_ids.filter((id) => id !== lineId)
          : [...assignment.line_ids, lineId],
      };
    }));
  };

  if (!vendorId) {
    return <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-4 text-xs font-bold text-slate-500">Select vendor first</div>;
  }

  if (floors.length === 0) {
    return <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-4 text-xs font-bold text-slate-500">No floors found for this vendor</div>;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
        {floors.map((floor) => {
          const assignment = floorAssignment(floor.id);
          const selected = Boolean(assignment);
          const allLines = floor.lines || [];

          return (
            <div key={floor.id} className="rounded-xl border border-slate-850 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleFloor(floor.id)}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
                  />
                  <span>{floor.name}</span>
                </label>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {allLines.length ? `${assignment?.line_ids?.length || 0}/${allLines.length} lines` : "Whole floor"}
                </span>
              </div>

              {selected && allLines.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3">
                  {allLines.map((line: any) => {
                    const lineChecked = assignment?.line_ids?.includes(line.id) || false;
                    return (
                      <label key={line.id} className="flex items-center gap-2 rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 cursor-pointer hover:bg-slate-950">
                        <input
                          type="checkbox"
                          checked={lineChecked}
                          onChange={() => toggleLine(floor.id, line.id)}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                        />
                        <span className="truncate">{line.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReferenceAttachmentButton({
  attachments,
  uploading,
  onUpload,
  onRequirementChange,
  onRemove,
}: {
  attachments: ReferenceAttachment[];
  uploading: boolean;
  onUpload: (file: File | null) => void;
  onRequirementChange: (index: number, field: keyof ReferenceAttachment, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-slate-400">
            <Paperclip className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-white">Reference Pictures</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              {attachments.length ? `${attachments.length} picture${attachments.length === 1 ? "" : "s"} attached` : "Add product images with requirements"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`cursor-pointer rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            <span className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Add Picture"}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                Array.from(event.target.files || []).forEach((file) => onUpload(file));
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {attachments.map((attachment, index) => (
            <div key={`${attachment.url}-${index}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 md:grid-cols-[88px_1fr_auto] md:items-center">
              <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                <img src={attachment.url} alt={attachment.requirement || "Reference picture"} className="h-20 w-full object-cover md:w-20" />
              </a>
              <div>
                <p className="mb-2 truncate text-xs font-black uppercase tracking-wider text-slate-400">
                  {attachment.filename || attachment.url.split("/").pop() || `Picture ${index + 1}`}
                </p>
                <textarea
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                  placeholder="Requirement for this picture..."
                  value={attachment.requirement}
                  onChange={(event) => onRequirementChange(index, "requirement", event.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="justify-self-start rounded-full border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10 md:justify-self-end"
                title="Remove picture"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
