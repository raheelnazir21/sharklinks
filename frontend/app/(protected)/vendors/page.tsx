"use client";

import React, { useEffect, useState } from "react";
import api from "@/services/api";
import { Plus, Search, Mail, Phone, MapPin, Building2, Edit3, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { ConfirmDialog, FeedbackDialog } from "@/components/ui/ActionDialogs";
import Link from "next/link";

type Vendor = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  contact_person?: string;
  total_orders?: number;
};

const emptyVendorForm = {
  name: "",
  email: "",
  phone: "",
  phone_country_code: "+92",
  phone_number: "",
  country: "",
  contact_person: ""
};

const COUNTRY_CODES = [
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+91", label: "India (+91)" },
  { code: "+86", label: "China (+86)" },
  { code: "+90", label: "Turkey (+90)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+1", label: "United States/Canada (+1)" },
];

function splitPhone(phone?: string) {
  const cleaned = (phone || "").trim();
  const match = cleaned.match(/^(\+\d{1,4})\s*(.*)$/);
  return {
    phone_country_code: match?.[1] || "+92",
    phone_number: (match?.[2] || cleaned).replace(/[^\d\s-]/g, "").trim(),
  };
}

function buildPhone(countryCode: string, localNumber: string) {
  const digits = localNumber.replace(/[^\d]/g, "");
  return digits ? `${countryCode} ${digits}` : "";
}

type ApiError = {
  response?: {
    data?: {
      detail?: string;
      message?: string;
      details?: string;
    };
  };
};

function getApiError(err: unknown, fallback: string) {
  const apiError = err as ApiError;
  return (
    apiError.response?.data?.detail ||
    apiError.response?.data?.message ||
    apiError.response?.data?.details ||
    fallback
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyVendorForm);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get("/vendors/", { params: { search } });
      setVendors(res.data.data);
    } catch (err) {
      console.warn("Failed to fetch vendors", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [search]);

  const openCreate = () => {
    setEditingVendor(null);
    setFormData(emptyVendorForm);
    setIsModalOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    const phoneParts = splitPhone(vendor.phone);
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      phone_country_code: phoneParts.phone_country_code,
      phone_number: phoneParts.phone_number,
      country: vendor.country || "",
      contact_person: vendor.contact_person || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        phone: buildPhone(formData.phone_country_code, formData.phone_number),
      };
      if (editingVendor) {
        await api.put(`/vendors/${editingVendor.id}`, payload);
      } else {
        await api.post("/vendors/", payload);
      }
      setIsModalOpen(false);
      setFormData(emptyVendorForm);
      setEditingVendor(null);
      fetchVendors();
      setFeedback({
        type: "success",
        title: "Mission Successful",
        message: editingVendor ? "Vendor updated successfully." : "Vendor created successfully.",
      });
    } catch (err) {
      setFeedback({ type: "error", title: "Operation Failed", message: "Failed to save vendor." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteVendor = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/vendors/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchVendors();
      setFeedback({ type: "success", title: "Mission Successful", message: "Vendor deactivated successfully." });
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Operation Failed",
        message: getApiError(err, "Failed to deactivate vendor."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-end">
        <button 
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" /> Add New Vendor
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 items-center shadow-sm">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search by vendor name or contact..." 
            className="bg-transparent border-none text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Vendors Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-20">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-indigo-300 transition-all group relative overflow-hidden shadow-sm">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -mr-16 -mt-16 rounded-full"></div>
              
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(vendor)}
                    className="text-slate-500 hover:text-indigo-700 p-2 bg-slate-50 rounded-xl border border-slate-200 transition-all"
                    title="Edit vendor"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(vendor)}
                    className="text-slate-500 hover:text-red-700 p-2 bg-slate-50 rounded-xl border border-slate-200 transition-all"
                    title="Deactivate vendor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-slate-950 font-black text-xl mb-1 tracking-tight uppercase">{vendor.name}</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-indigo-500" /> {vendor.country || 'International Supplier'}
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-slate-600 text-xs font-bold">
                  <Mail className="w-4 h-4 text-slate-600" /> {vendor.email || 'No email provided'}
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-xs font-bold">
                  <Phone className="w-4 h-4 text-slate-600" /> {vendor.phone || 'No phone provided'}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-slate-950 font-black text-lg leading-none">{vendor.total_orders || 0}</p>
                  <p className="text-slate-500 text-[9px] uppercase font-black tracking-widest mt-1">Active Projects</p>
                </div>
                <Link 
                  href={`/vendors/${vendor.id}`}
                  className="bg-slate-50 hover:bg-indigo-600 text-indigo-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-indigo-500 transition-all"
                >
                  Vendor Profile
                </Link>
              </div>
            </div>
          ))}
          
          {vendors.length === 0 && (
            <div className="col-span-full py-32 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-200">
                <Building2 className="w-10 h-10 text-slate-700" />
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-widest">No Vendors Registered</p>
              <button onClick={openCreate} className="text-indigo-400 text-xs font-black mt-4 hover:underline uppercase tracking-widest">Add your first supplier →</button>
            </div>
          )}
        </div>
      )}

      {/* Add Vendor Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingVendor ? "Update Vendor" : "Register New Vendor"}
      >
        <form onSubmit={handleSaveVendor} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Company / Supplier Name</label>
            <input 
              required
              type="text" 
              className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Apex Textile Mills"
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Business Email</label>
              <input 
                type="email" 
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="vendor@company.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Contact Number</label>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <select
                  className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-3 text-sm font-black text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={formData.phone_country_code}
                  onChange={(e) => setFormData({...formData, phone_country_code: e.target.value})}
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code} value={country.code}>{country.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value.replace(/[^\d\s-]/g, "")})}
                  placeholder="3001234567"
                />
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Saves as {buildPhone(formData.phone_country_code, formData.phone_number) || `${formData.phone_country_code} local number`}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Manufacturing Country</label>
            <input 
              type="text" 
              className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={formData.country}
              onChange={(e) => setFormData({...formData, country: e.target.value})}
              placeholder="e.g. Bangladesh, Turkey"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl mt-4 transition-all shadow-xl shadow-indigo-500/20 uppercase tracking-[0.2em] text-xs"
          >
            {isSubmitting ? "Saving..." : editingVendor ? "Update Vendor" : "Activate Vendor Account"}
          </button>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Deactivate vendor?"
        message={`Are you sure you want to deactivate ${deleteTarget?.name}? Existing orders remain in history.`}
        confirmLabel="Yes, Deactivate"
        loading={isSubmitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteVendor}
      />
      <FeedbackDialog
        open={Boolean(feedback)}
        type={feedback?.type}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
