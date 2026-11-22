import React from "react";
import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DATE_PRESETS = [
  { value: "7",      label: "Last 7 Days" },
  { value: "30",     label: "Last 30 Days" },
  { value: "60",     label: "Last 60 Days" },
  { value: "90",     label: "Last 90 Days" },
  { value: "month",  label: "This Month" },
  { value: "lmonth", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

export function getDateBounds(dateRange) {
  const { preset, customStart, customEnd } = dateRange;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  if (preset === "custom") {
    return { start: customStart || null, end: customEnd || null };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: start.toISOString().split("T")[0], end: todayStr };
  }
  if (preset === "lmonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  }
  const days = parseInt(preset, 10);
  if (isNaN(days)) return { start: null, end: null };
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { start: start.toISOString().split("T")[0], end: todayStr };
}

export function filterByDate(issues, dateRange) {
  const { start, end } = getDateBounds(dateRange);
  if (!start && !end) return issues;
  return issues.filter(issue => {
    const d = issue.install_service_date || issue.qc_event_date || issue.date_received || "";
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

export function getPresetLabel(dateRange) {
  if (dateRange.preset === "custom") {
    const { customStart, customEnd } = dateRange;
    if (customStart && customEnd) return `${customStart} → ${customEnd}`;
    return "Custom Range";
  }
  return DATE_PRESETS.find(p => p.value === dateRange.preset)?.label || "Last 30 Days";
}

export default function DateRangeFilter({ dateRange, setDateRange }) {
  const { preset, customStart, customEnd } = dateRange;

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-blue-50 border-b border-blue-100">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
        <Calendar className="w-4 h-4" />
        Date Range
      </div>

      <Select value={preset} onValueChange={v => setDateRange(dr => ({ ...dr, preset: v }))}>
        <SelectTrigger className="w-44 h-8 text-xs bg-white border-blue-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map(p => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={e => setDateRange(dr => ({ ...dr, customStart: e.target.value }))}
            className="h-8 px-2 text-xs border border-blue-200 rounded bg-white"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setDateRange(dr => ({ ...dr, customEnd: e.target.value }))}
            className="h-8 px-2 text-xs border border-blue-200 rounded bg-white"
          />
        </div>
      )}

      <span className="text-xs text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-medium ml-auto">
        Showing data for: <strong>{getPresetLabel(dateRange)}</strong>
      </span>
    </div>
  );
}