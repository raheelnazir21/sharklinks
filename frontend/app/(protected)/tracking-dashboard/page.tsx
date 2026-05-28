"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/services/api";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Factory,
  Layers,
  Map as MapIcon,
  Package,
  Search,
  Shirt,
  Workflow,
} from "lucide-react";

type TrackingOrder = {
  order_id: string;
  order_no?: string;
  product_name?: string;
  style_name?: string;
  quantity?: number;
  track_type: "bulk" | "sampling";
  class_name?: string;
  order_status?: string;
  priority?: string;
  ex_factory_date?: string;
  is_delayed?: boolean;
  delay_days?: number;
  stage_name?: string;
  stage_label?: string;
  stage_status?: string;
  progress_percent?: number;
};

type TrackingLine = {
  line_id?: string | null;
  line_name: string;
  total_orders: number;
  bulk_orders: number;
  sample_orders: number;
  orders: TrackingOrder[];
};

type TrackingFloor = {
  floor_id?: string | null;
  floor_name: string;
  total_orders: number;
  lines: TrackingLine[];
};

type TrackingVendor = {
  vendor_id: string;
  vendor_name: string;
  total_orders: number;
  bulk_orders: number;
  sample_orders: number;
  delayed_orders: number;
  floors: TrackingFloor[];
};

type TrackingPayload = {
  summary: {
    total_orders: number;
    bulk_orders: number;
    sample_orders: number;
    delayed_orders: number;
    completed_orders: number;
    in_progress_orders: number;
  };
  vendors: TrackingVendor[];
};

const emptyPayload: TrackingPayload = {
  summary: {
    total_orders: 0,
    bulk_orders: 0,
    sample_orders: 0,
    delayed_orders: 0,
    completed_orders: 0,
    in_progress_orders: 0,
  },
  vendors: [],
};

function statusLabel(value?: string) {
  return value ? value.replaceAll("_", " ").toUpperCase() : "PENDING";
}

const BULK_STAGES = [
  { id: "customer_order_wrapping_card", label: "Order" },
  { id: "pp_sample_development", label: "PP Dev" },
  { id: "customer_approval", label: "Approval" },
  { id: "fabric_shade_continuity_approval", label: "Shade" },
  { id: "sublimation", label: "Sublimation" },
  { id: "bulk_fabric_cutting", label: "Cutting" },
  { id: "printing_embroidery_embellishment", label: "Emb." },
  { id: "stitching", label: "Stitching" },
  { id: "end_line_qc", label: "End QC" },
  { id: "washing", label: "Washing" },
  { id: "pressing", label: "Pressing" },
  { id: "finishing", label: "Finishing" },
  { id: "packing", label: "Packing" },
  { id: "final_random_inspection", label: "FRI" },
  { id: "shipment_ex_factory", label: "Ship" },
];

const SAMPLE_STAGES = [
  { id: "sample_start", label: "Start" },
  { id: "fabrication", label: "Fabrication" },
  { id: "fabric_cutting", label: "Cutting" },
  { id: "embellishment", label: "Emb." },
  { id: "stitching", label: "Stitching" },
  { id: "washing", label: "Washing" },
  { id: "finishing", label: "Finishing" },
  { id: "qc_check", label: "QC" },
  { id: "dispatch", label: "Dispatch" },
  { id: "sample_completed", label: "Done" },
];

function stageListFor(trackType: "bulk" | "sampling") {
  return trackType === "bulk" ? BULK_STAGES : SAMPLE_STAGES;
}

function stageColumnId(order: TrackingOrder) {
  const stages = stageListFor(order.track_type);
  const exact = stages.find((stage) => stage.id === order.stage_name);
  if (exact) return exact.id;

  const label = order.stage_label?.toLowerCase();
  const byLabel = stages.find((stage) => stage.label.toLowerCase() === label);
  return byLabel?.id || stages[0].id;
}

function OrderMiniCard({ order }: { order: TrackingOrder }) {
  return (
    <Link
      href={`/orders/${order.order_id}`}
      className={`block rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        order.is_delayed
          ? "bg-rose-500/10 border-rose-500/30"
          : order.track_type === "bulk"
            ? "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-400/50"
            : "bg-blue-500/10 border-blue-500/20 hover:border-blue-400/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[8px] font-black uppercase tracking-widest ${order.track_type === "bulk" ? "text-emerald-300" : "text-blue-300"}`}>
          {order.track_type === "bulk" ? "Bulk" : "Sample"}
        </span>
        {order.is_delayed && <span className="text-[8px] font-black text-rose-300 uppercase">{order.delay_days}d late</span>}
      </div>
      <p className="text-white text-[11px] font-black uppercase truncate mt-2">
        {order.product_name || order.style_name || "Unnamed Product"}
      </p>
      <p className="text-slate-400 text-[9px] font-bold uppercase truncate mt-1">
        {order.class_name || "No Class"}
      </p>
      <div className="flex items-center justify-between mt-3 text-[8px] font-black uppercase text-slate-500">
        <span>{order.order_no || "No PO"}</span>
        <span>Qty {order.quantity || 0}</span>
      </div>
    </Link>
  );
}

function StagePipeline({ orders, trackType }: { orders: TrackingOrder[]; trackType: "bulk" | "sampling" }) {
  const stages = stageListFor(trackType);
  const trackOrders = orders.filter((order) => order.track_type === trackType);
  if (trackOrders.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-black uppercase tracking-widest ${trackType === "bulk" ? "text-emerald-300" : "text-blue-300"}`}>
          {trackType === "bulk" ? "Bulk Flow" : "Sample Flow"}
        </p>
        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{trackOrders.length} products</span>
      </div>
      <div
        className="grid gap-2 min-w-[1100px]"
        style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(92px, 1fr))` }}
      >
        {stages.map((stage) => {
          const stageOrders = trackOrders.filter((order) => stageColumnId(order) === stage.id);
          return (
            <div key={stage.id} className="min-h-[150px] bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/70">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate">{stage.label}</p>
              </div>
              <div className="p-2 space-y-2">
                {stageOrders.length === 0 ? (
                  <div className="h-20 rounded-xl border border-dashed border-slate-800/70"></div>
                ) : (
                  stageOrders.map((order) => <OrderMiniCard key={order.order_id} order={order} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackingDashboardPage() {
  const [data, setData] = useState<TrackingPayload>(emptyPayload);
  const [track, setTrack] = useState("all");
  const [view, setView] = useState<"map" | "list" | "product">("map");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTracking = async () => {
    setLoading(true);
    try {
      const res = await api.get("/analytics/order-tracking", {
        params: { track_type: track },
      });
      setData(res.data.data || emptyPayload);
    } catch (err) {
      console.warn("Failed to load order tracking dashboard", err);
      setData(emptyPayload);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [track]);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.vendors;

    return data.vendors
      .map((vendor) => {
        const floors = vendor.floors
          .map((floor) => {
            const lines = floor.lines
              .map((line) => ({
                ...line,
                orders: line.orders.filter((order) =>
                  [
                    vendor.vendor_name,
                    floor.floor_name,
                    line.line_name,
                    order.order_no,
                    order.product_name,
                    order.style_name,
                    order.class_name,
                    order.stage_label,
                    order.track_type,
                  ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(q))
                ),
              }))
              .filter((line) => line.orders.length > 0);
            return { ...floor, lines };
          })
          .filter((floor) => floor.lines.length > 0);
        return { ...vendor, floors };
      })
      .filter((vendor) => vendor.floors.length > 0);
  }, [data.vendors, search]);

  const productGroups = useMemo(() => {
    const groups = new Map<string, {
      product_name: string;
      total_quantity: number;
      orders: Array<TrackingOrder & {
        vendor_name: string;
        floor_name: string;
        line_name: string;
      }>;
    }>();

    filteredVendors.forEach((vendor) => {
      vendor.floors.forEach((floor) => {
        floor.lines.forEach((line) => {
          line.orders.forEach((order) => {
            const productName = order.product_name || order.style_name || "Unnamed Product";
            if (!groups.has(productName)) {
              groups.set(productName, {
                product_name: productName,
                total_quantity: 0,
                orders: [],
              });
            }

            const group = groups.get(productName)!;
            group.total_quantity += order.quantity || 0;
            group.orders.push({
              ...order,
              vendor_name: vendor.vendor_name,
              floor_name: floor.floor_name,
              line_name: line.line_name,
            });
          });
        });
      });
    });

    return Array.from(groups.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [filteredVendors]);

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-end gap-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1">
            {[
              { id: "all", label: "All" },
              { id: "bulk", label: "Bulk" },
              { id: "sampling", label: "Sample" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTrack(item.id)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  track === item.id ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1">
            {[
              { id: "map", label: "Map View" },
              { id: "list", label: "List View" },
              { id: "product", label: "Product View" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id as "map" | "list" | "product")}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  view === item.id ? "bg-slate-700 text-white shadow-lg" : "text-slate-500 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Track product by name..."
              className="bg-transparent outline-none text-sm text-white placeholder:text-slate-600 py-3 w-full"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        {[
          { label: "Total Orders", value: data.summary.total_orders, icon: <Package className="w-5 h-5" />, tone: "text-white" },
          { label: "Bulk", value: data.summary.bulk_orders, icon: <Layers className="w-5 h-5" />, tone: "text-emerald-400" },
          { label: "Samples", value: data.summary.sample_orders, icon: <Shirt className="w-5 h-5" />, tone: "text-blue-400" },
          { label: "Delayed", value: data.summary.delayed_orders, icon: <AlertTriangle className="w-5 h-5" />, tone: "text-rose-400" },
          { label: "In Progress", value: data.summary.in_progress_orders, icon: <Factory className="w-5 h-5" />, tone: "text-amber-400" },
          { label: "Completed", value: data.summary.completed_orders, icon: <CheckCircle2 className="w-5 h-5" />, tone: "text-emerald-300" },
        ].map((item) => (
          <div key={item.label} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className={`mb-5 ${item.tone}`}>{item.icon}</div>
            <p className="text-2xl font-black text-white">{item.value}</p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-32 flex justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="py-32 text-center bg-slate-900/40 border border-slate-800 rounded-[2rem]">
          <MapIcon className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">No orders match this tracking view.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {view === "product" ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {productGroups.map((product) => (
                <section key={product.product_name} className="bg-slate-900/40 border border-slate-800 rounded-[2rem] overflow-hidden">
                  <div className="p-6 border-b border-slate-800 bg-slate-900/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Package className="w-5 h-5 text-indigo-300" />
                        <h2 className="text-xl font-black text-white uppercase tracking-tight truncate">{product.product_name}</h2>
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {product.orders.length} placements • Qty {product.total_quantity}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800/70">
                    {product.orders.map((order) => (
                      <Link
                        href={`/orders/${order.order_id}`}
                        key={`${product.product_name}-${order.order_id}-${order.floor_name}-${order.line_name}`}
                        className="block p-5 hover:bg-slate-800/40 transition-all"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                                order.track_type === "bulk"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              }`}>
                                {order.track_type}
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-500 border border-slate-800 text-[8px] font-black uppercase tracking-widest">
                                {order.order_no || "No PO"}
                              </span>
                              {order.is_delayed && (
                                <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-black uppercase tracking-widest">
                                  Delayed {order.delay_days}d
                                </span>
                              )}
                            </div>
                            <p className="text-white text-sm font-black uppercase truncate">
                              {order.vendor_name} / {order.floor_name} / {order.line_name}
                            </p>
                            <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">
                              Class: {order.class_name || "No Class"} • Style: {order.style_name || "N/A"} • Qty {order.quantity || 0}
                            </p>
                          </div>

                          <div className="lg:text-right min-w-[190px]">
                            <p className="text-indigo-300 text-xs font-black uppercase">{order.stage_label}</p>
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">
                              {statusLabel(order.stage_status)} • {order.progress_percent || 0}% complete
                            </p>
                            <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden mt-3">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${order.progress_percent || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : filteredVendors.map((vendor) => (
            <section key={vendor.vendor_id} className="bg-slate-900/40 border border-slate-800 rounded-[2rem] overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/70">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">{vendor.vendor_name}</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {vendor.total_orders} orders • {vendor.bulk_orders} bulk • {vendor.sample_orders} samples
                    </p>
                  </div>
                </div>
                {vendor.delayed_orders > 0 && (
                  <span className="w-fit px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest">
                    {vendor.delayed_orders} delayed
                  </span>
                )}
              </div>

              <div className="p-5 space-y-5">
                {vendor.floors.map((floor) => (
                  <div key={`${vendor.vendor_id}-${floor.floor_id || floor.floor_name}`} className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Factory className="w-4 h-4 text-slate-500" />
                        <h3 className="text-white text-sm font-black uppercase tracking-widest">{floor.floor_name}</h3>
                      </div>
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{floor.total_orders} placements</span>
                    </div>

                    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 p-4">
                      {floor.lines.map((line) => (
                        <div key={`${floor.floor_id || floor.floor_name}-${line.line_id || line.line_name}`} className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
                          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                            <div>
                              <p className="text-white text-sm font-black uppercase">{line.line_name}</p>
                              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                {line.bulk_orders} bulk • {line.sample_orders} sample
                              </p>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-black">
                              {line.total_orders}
                            </span>
                          </div>

                          {view === "map" ? (
                            <div className="p-4 space-y-6 overflow-x-auto">
                              {(track === "all" || track === "bulk") && <StagePipeline orders={line.orders} trackType="bulk" />}
                              {(track === "all" || track === "sampling") && <StagePipeline orders={line.orders} trackType="sampling" />}
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-800/70">
                              {line.orders.map((order) => (
                                <Link
                                  href={`/orders/${order.order_id}`}
                                  key={order.order_id}
                                  className="block p-5 hover:bg-slate-800/40 transition-all"
                                >
                                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                                          order.track_type === "bulk"
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                        }`}>
                                          {order.track_type === "bulk" ? "Bulk" : "Sample"}
                                        </span>
                                        {order.is_delayed && (
                                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-black uppercase tracking-widest">
                                            Delayed {order.delay_days}d
                                          </span>
                                        )}
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                          {order.order_no || "No PO"}
                                        </span>
                                      </div>
                                      <p className="text-white font-black text-sm uppercase tracking-tight truncate">
                                        {order.product_name || order.style_name || "Unnamed Product"}
                                      </p>
                                      <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">
                                        Style: {order.style_name || "N/A"} • Class: {order.class_name || "No Class"}
                                      </p>
                                    </div>

                                    <div className="lg:text-right min-w-[170px]">
                                      <p className="text-indigo-300 text-xs font-black uppercase">{order.stage_label}</p>
                                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">
                                        {statusLabel(order.stage_status)} • Qty {order.quantity || 0}
                                      </p>
                                      <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden mt-3">
                                        <div
                                          className="h-full bg-indigo-500 rounded-full"
                                          style={{ width: `${order.progress_percent || 0}%` }}
                                        ></div>
                                      </div>
                                      <p className="text-[8px] font-black text-slate-600 uppercase mt-1">{order.progress_percent || 0}% complete</p>
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
