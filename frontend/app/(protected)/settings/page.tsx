"use client";

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, Mail, Key, Bell, Globe, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar Tabs (UI only for now) */}
        <div className="space-y-1">
           <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-medium transition-all">
             <User className="w-4 h-4" /> Profile
           </button>
           <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:bg-slate-800 rounded-xl text-sm font-medium transition-all text-left">
             <Shield className="w-4 h-4" /> Security
           </button>
           <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:bg-slate-800 rounded-xl text-sm font-medium transition-all text-left">
             <Bell className="w-4 h-4" /> Notifications
           </button>
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-6">
           <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" /> Account Profile
              </h3>
              
              <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1.5 ml-1">Full Name</label>
                       <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white text-sm">
                          {user?.full_name}
                       </div>
                    </div>
                    <div>
                       <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1.5 ml-1">Email Address</label>
                       <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white text-sm">
                          {user?.email}
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1.5 ml-1">Current Role</label>
                       <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-indigo-400 text-sm font-semibold capitalize">
                          {user?.role?.replace('_', ' ')}
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Dangerous Zone</h3>
              <p className="text-slate-400 text-sm mb-6">Sign out of your account on this device.</p>
              <button 
                onClick={logout}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-sm font-bold transition-all"
              >
                <LogOut className="w-4 h-4" /> Sign Out from Textile QC
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
