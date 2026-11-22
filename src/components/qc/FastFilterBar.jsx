import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPrimaryTechnicians } from "../../lib/qcUtils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const QUICK_TOGGLES = [
  { label: "Warranty Only", key: "warranty", value: "yes" },
  { label: "Open Only", key: "status", value: "pending_repair" },
  { label: "Overdue Only", key: "overdue", value: "yes" },
  { label: "Needs Review", key: "needsReview", value: "yes" },
];

export default function FastFilterBar({ filters, setFilter, technicians, customers, projects }) {
  const primaryTechs = getPrimaryTechnicians(technicians);
  const activeCount = Object.entries(filters).filter(([k, v]) => v && v !== "all").length;

  const isToggleActive = (toggle) => {
    if (toggle.key === "dateRange") {
      return filters[toggle.key] === toggle.value;
    }
    return filters[toggle.key] === toggle.value;
  };

  const toggleFilter = (toggle) => {
    if (isToggleActive(toggle)) {
      setFilter(toggle.key, toggle.key === "dateRange" ? "all" : "all");
    } else {
      setFilter(toggle.key, toggle.value);
    }
  };

  const clearAll = () => {
    setFilter("technician", "all");
    setFilter("customer", "all");
    setFilter("project", "all");
    setFilter("status", "all");
    setFilter("warranty", "all");
    setFilter("overdue", "all");
    setFilter("needsReview", "all");
  };

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="px-6 py-3 space-y-3">
        {/* Dropdown row */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filters.technician || "all"} onValueChange={v => setFilter("technician", v)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {primaryTechs.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.customer || "all"} onValueChange={v => setFilter("customer", v)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.project || "all"} onValueChange={v => setFilter("project", v)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.status || "all"} onValueChange={v => setFilter("status", v)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending_repair">Pending Repair</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="repaired">Repaired</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.warranty || "all"} onValueChange={v => setFilter("warranty", v)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Warranty Return" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>

          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-3 h-3 mr-1" /> Clear ({activeCount})
            </Button>
          )}
        </div>

        {/* Quick toggle buttons */}
        <div className="flex flex-wrap gap-2">
          {QUICK_TOGGLES.map(toggle => (
            <button
              key={toggle.label}
              onClick={() => toggleFilter(toggle)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                isToggleActive(toggle)
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {toggle.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}