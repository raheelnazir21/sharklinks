"use client";

import React, { useEffect, useState } from "react";
import api from "@/services/api";
import Modal from "@/components/ui/Modal";

type HistoryEvent = {
  id: string;
  source?: string;
  action: string;
  details?: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  created_at?: string | null;
  user?: string;
};

function formatValue(value: unknown) {
  if (!value || typeof value !== "object") return "";
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key.replace(/_/g, " ")}: ${String(item ?? "-")}`)
    .join(" | ");
}

export default function OrderHistoryModal({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    // Load history when the modal opens for a specific order.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .get(`/orders/${orderId}/history`)
      .then((res) => setEvents(res.data.data || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <Modal isOpen={Boolean(orderId)} onClose={onClose} title="Order History">
      <div className="max-h-[62vh] overflow-y-auto pr-2">
        {loading ? (
          <div className="py-10 text-center text-sm font-bold text-slate-500">Loading history...</div>
        ) : events.length ? (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={`${event.id}-${event.source}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase text-slate-950">{event.action.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{event.details || "No extra details recorded."}</p>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {event.created_at ? new Date(event.created_at).toLocaleString() : "No time"}
                  </p>
                </div>
                <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-500">By {event.user || "System"}</p>
                {(event.old_value || event.new_value) && (
                  <div className="mt-3 grid gap-2 text-[11px] font-semibold text-slate-600">
                    {event.old_value && <p><span className="font-black text-slate-900">Before:</span> {formatValue(event.old_value)}</p>}
                    {event.new_value && <p><span className="font-black text-slate-900">After:</span> {formatValue(event.new_value)}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">
            No history recorded for this order yet.
          </div>
        )}
      </div>
    </Modal>
  );
}
