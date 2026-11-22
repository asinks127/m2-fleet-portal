import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Bookmark, BookmarkCheck, X, ChevronDown, ChevronUp } from "lucide-react";

const SAVED_VIEWS_KEY = "qc_saved_views";

const QUICK_FILTERS = [
  { label: "Warranty Only", key: "warranty", value: "yes" },
  { label: "Overdue Only", key: "overdue", value: "yes" },
  { label: "Needs Review", key: "needsReview", value: "yes" },
  { label: "Last 7 Days", key: "dateRange", value: "7" },
  { label: "Last 30 Days", key: "dateRange", value: "30" },
];

const STATUSES = ["pending_repair", "scheduled", "repaired", "closed"];
const SEVERITIES = ["critical", "high", "medium", "low"];
const CATEGORIES = [
  "camera_positioning", "mirror_adjustment", "mounting",
  "connection_issue", "equipment_missing", "installation_quality", "other"
];

function activeFilterCount(filters) {
  let count = 0;
  if (filters.search) count++;
  if (filters.technician !== "all") count++;
  if (filters.customer !== "all") count++;
  if (filters.project !== "all") count++;
  if (filters.category !== "all") count++;
  if (filters.severity !== "all") count++;
  if (filters.status !== "all") count++;
  if (filters.warranty !== "all") count++;
  if (filters.overdue !== "all") count++;
  if (filters.needsReview !== "all") count++;
  if (filters.dateRange !== "all") count++;
  return count;
}

export default function QCFilters({ filters, setFilter, resetFilters, technicians, projects, customers }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedViews, setSavedViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY)) || []; } catch { return []; }
  });
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  const saveView = () => {
    if (!saveName.trim()) return;
    const view = { name: saveName.trim(), filters: { ...filters } };
    setSavedViews(prev => [...prev, view]);
    setSaveName("");
    setShowSaveInput(false);
  };

  const loadView = (view) => {
    Object.entries(view.filters).forEach(([k, v]) => setFilter(k, v));
  };

  const deleteView = (index, e) => {
    e.stopPropagation();
    setSavedViews(prev => prev.filter((_, i) => i !== index));
  };

  const isQuickActive = (qf) => filters[qf.key] === qf.value;

  const toggleQuick = (qf) => {
    if (isQuickActive(qf)) {
      setFilter(qf.key, qf.key === "dateRange" ? "all" : "all");
    } else {
      setFilter(qf.key, qf.value);
    }
  };

  const activeCount = activeFilterCount(filters);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={filters.search || ""}
            onChange={e => setFilter("search", e.target.value)}
            placeholder="Search technician, asset #, work order, customer, project..."
            className="pl-9 h-9 text-sm"
          />
          {filters.search && (
            <button onClick={() => setFilter("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick filter pills */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Quick:</span>
          {QUICK_FILTERS.map(qf => (
            <button
              key={qf.label}
              onClick={() => toggleQuick(qf)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                isQuickActive(qf)
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {qf.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {activeCount > 0 && (
              <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all ({activeCount})
              </button>
            )}
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 border rounded"
            >
              Advanced {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            <Select value={filters.technician} onValueChange={v => setFilter("technician", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Technicians" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.customer} onValueChange={v => setFilter("customer", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Customers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.project} onValueChange={v => setFilter("project", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.category} onValueChange={v => setFilter("category", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.severity} onValueChange={v => setFilter("severity", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Severities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={v => setFilter("status", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Saved Views */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Bookmark className="w-3 h-3" /> Saved Views
            </span>
            <button
              onClick={() => setShowSaveInput(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <BookmarkCheck className="w-3 h-3" />
              {showSaveInput ? "Cancel" : "Save current view"}
            </button>
          </div>

          {showSaveInput && (
            <div className="flex gap-2 mb-2">
              <Input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveView()}
                placeholder='e.g. "Warranty Returns - This Week"'
                className="h-8 text-xs flex-1"
                autoFocus
              />
              <Button size="sm" onClick={saveView} disabled={!saveName.trim()} className="h-8 text-xs px-3">
                Save
              </Button>
            </div>
          )}

          {savedViews.length === 0 && !showSaveInput && (
            <p className="text-xs text-gray-400 italic">No saved views yet. Save your current filters for quick access.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {savedViews.map((view, i) => (
              <div
                key={i}
                onClick={() => loadView(view)}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs cursor-pointer hover:bg-indigo-100 transition-colors group"
              >
                <BookmarkCheck className="w-3 h-3" />
                {view.name}
                <button
                  onClick={e => deleteView(i, e)}
                  className="opacity-0 group-hover:opacity-100 ml-0.5 text-indigo-400 hover:text-red-500 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}