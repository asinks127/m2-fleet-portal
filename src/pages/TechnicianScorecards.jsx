import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getPrimaryTechnicians } from "../lib/qcUtils";
const bulkRecalcTechStats = (payload) => base44.functions.invoke('bulkRecalcTechStats', payload);
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const SORT_OPTIONS = [
  { value: "qc_score", label: "Highest QC Score" },
  { value: "warranty", label: "Most Warranty Returns" },
  { value: "open", label: "Most Open Issues" },
  { value: "recent", label: "Most Recent QC Issue" },
  { value: "total", label: "Most Total Issues" },
];

const TRAINING_COLORS = {
  completed: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  not_started: "bg-gray-100 text-gray-700",
  needs_retraining: "bg-red-100 text-red-800",
};

const STATUS_COLORS = {
  active: "bg-green-100 text-green-800",
  on_leave: "bg-yellow-100 text-yellow-800",
  inactive: "bg-gray-100 text-gray-500",
};

function SortHeader({ col, label, sortBy, sortDir, onSort }) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
    >
      {label}
      {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />)}
    </th>
  );
}

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(new Date(d), "MM/dd/yyyy"); } catch { return d; }
};

export default function TechnicianScorecards() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [recalculating, setRecalculating] = useState(false);

  const { data: technicians = [], isLoading } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => base44.entities.Technician.list(),
  });

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const primaryTechs = useMemo(() => getPrimaryTechnicians(technicians), [technicians]);

  const sorted = useMemo(() => {
    const keyMap = {
      qc_score: "qc_score",
      warranty: "warranty_return_count_total",
      open: "open_qc_issue_count",
      recent: "last_qc_issue_date",
      total: "qc_issue_count_total",
    };
    const key = keyMap[sortBy];
    return [...primaryTechs].sort((a, b) => {
      const av = a[key] ?? (sortBy === "recent" ? "0000-00-00" : 0);
      const bv = b[key] ?? (sortBy === "recent" ? "0000-00-00" : 0);
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [primaryTechs, sortBy, sortDir]);

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const res = await bulkRecalcTechStats({});
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      toast({ title: "Stats updated", description: `Updated ${res.data?.updated || 0} of ${res.data?.total || 0} technicians.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setRecalculating(false);
  };

  const cols = [
    { key: "full_name", label: "Technician" },
    { key: "status", label: "Status" },
    { key: "total", label: "Total Issues", sortKey: "total" },
    { key: "qc_issue_count_30d", label: "Last 30 Days" },
    { key: "open", label: "Open", sortKey: "open" },
    { key: "closed_qc_issue_count", label: "Closed" },
    { key: "warranty", label: "Warranties", sortKey: "warranty" },
    { key: "damage_claim_count", label: "Damage Claims" },
    { key: "repeat_issue_count", label: "Repeat Issues" },
    { key: "recent", label: "Last QC Issue", sortKey: "recent" },
    { key: "qc_score", label: "QC Score", sortKey: "qc_score" },
    { key: "training_status", label: "Training" },
    { key: "action", label: "" },
  ];

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Technician Scorecards</h1>
          <p className="text-gray-500 mt-1">QC performance metrics per technician</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{primaryTechs.length} active technicians</span>
          <Button variant="outline" size="sm" onClick={recalculate} disabled={recalculating}>
            <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Recalculate Stats"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {cols.map(c => c.sortKey ? (
                  <SortHeader key={c.key} col={c.sortKey} label={c.label} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                ) : (
                  <th key={c.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(tech => {
                const score = tech.qc_score ?? null;
                const scoreColor = score === null ? "text-gray-400" : score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
                return (
                  <tr key={tech.id} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => navigate(`/technicians/${tech.id}`)}>                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium text-gray-900">{tech.full_name}</p>
                        {tech.market && <p className="text-xs text-gray-400">{tech.market}</p>}
                        {tech.phone && <p className="text-xs text-gray-400">{tech.phone}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {tech.status ? <Badge className={`text-xs ${STATUS_COLORS[tech.status] || "bg-gray-100 text-gray-700"}`}>{tech.status.replace(/_/g, " ")}</Badge> : "—"}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{tech.qc_issue_count_total ?? 0}</td>
                    <td className="px-3 py-2">
                      <span className={tech.qc_issue_count_30d > 0 ? "font-semibold text-orange-600" : "text-gray-700"}>{tech.qc_issue_count_30d ?? 0}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={tech.open_qc_issue_count > 0 ? "font-semibold text-red-600" : "text-gray-700"}>{tech.open_qc_issue_count ?? 0}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{tech.closed_qc_issue_count ?? 0}</td>
                    <td className="px-3 py-2">
                      <span className={tech.warranty_return_count_total > 0 ? "font-semibold text-purple-600" : "text-gray-700"}>{tech.warranty_return_count_total ?? 0}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={tech.damage_claim_count > 0 ? "font-semibold text-red-600" : "text-gray-700"}>{tech.damage_claim_count ?? 0}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={tech.repeat_issue_count > 0 ? "font-semibold text-pink-600" : "text-gray-700"}>{tech.repeat_issue_count ?? 0}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(tech.last_qc_issue_date)}</td>
                    <td className="px-3 py-2">
                      {score !== null ? (
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <Progress value={score} className="h-1.5 w-12 shrink-0" />
                          <span className={`text-xs font-bold ${scoreColor}`}>{score}</span>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {tech.training_status ? (
                        <Badge className={`text-xs ${TRAINING_COLORS[tech.training_status] || "bg-gray-100 text-gray-700"}`}>
                          {tech.training_status.replace(/_/g, " ")}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 h-7 px-2" onClick={e => { e.stopPropagation(); navigate(`/technicians/${tech.id}`); }}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="text-center py-12 text-gray-400">No technicians found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}