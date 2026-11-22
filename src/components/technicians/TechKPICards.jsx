import React from "react";
import { TrendingUp, Package, AlertOctagon, Clock, CheckCircle2, ShieldCheck, BarChart2 } from "lucide-react";

const CARDS = [
  { key: "total",      label: "Total Issues",     icon: BarChart2,      color: "text-gray-900",    bg: "bg-gray-50",    border: "border-gray-100" },
  { key: "warranties", label: "Warranties",        icon: Package,        color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-100" },
  { key: "damage",     label: "Damage Claims",     icon: AlertOctagon,   color: "text-red-600",     bg: "bg-red-50",     border: "border-red-100" },
  { key: "open",       label: "Open Issues",       icon: TrendingUp,     color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-100" },
  { key: "overdue",    label: "Overdue",           icon: Clock,          color: "text-red-600",     bg: "bg-red-50",     border: "border-red-100" },
  { key: "resolved",   label: "Resolved",          icon: CheckCircle2,   color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  { key: "verified",   label: "QC Verified",       icon: ShieldCheck,    color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100" },
];

export default function TechKPICards({ metrics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {CARDS.map(({ key, label, icon: Icon, color, bg, border }) => {
        const val = metrics?.[key] ?? 0;
        const isZero = val === 0;
        return (
          <div key={key} className={`rounded-xl border ${border} ${bg} p-4 transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isZero ? "text-gray-300" : color}`} />
            </div>
            <p className={`text-2xl font-bold tabular-nums ${isZero ? "text-gray-300" : color}`}>{val}</p>
          </div>
        );
      })}
    </div>
  );
}