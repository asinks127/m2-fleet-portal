import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const REPORTING_CUTOFF = "2026-04-01";

function getIssueDate(issue) {
  return issue.qc_event_date || issue.date_received || (issue.created_date || "").split("T")[0] || "";
}

function RankItem({ rank, name, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors text-left border border-transparent hover:border-blue-200"
    >
      <span className="text-sm font-semibold text-gray-400 min-w-5">{rank}</span>
      <span className="flex-1 text-sm font-medium text-gray-900 truncate">{name}</span>
      <Badge variant="secondary" className="text-xs">{count}</Badge>
    </button>
  );
}

export default function QCSummaryWidgets({ issues, technicians, customers, projects, onFilterClick, projectMap }) {
  // Only count issues from April 1, 2026+
  const recentIssues = useMemo(() => {
    return issues.filter(issue => {
      const d = getIssueDate(issue);
      return d >= REPORTING_CUTOFF;
    });
  }, [issues]);

  const techData = useMemo(() => {
    const map = {};
    for (const issue of recentIssues) {
      const key = issue.technician_id || issue.technician_name;
      if (!key) continue;
      const name = issue.technician_name || "Unknown";
      if (!map[key]) map[key] = { id: issue.technician_id, name, count: 0 };
      map[key].count++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [recentIssues]);

  const custData = useMemo(() => {
    const map = {};
    for (const issue of recentIssues) {
      if (!issue.customer) continue;
      map[issue.customer] = (map[issue.customer] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [recentIssues]);

  const projData = useMemo(() => {
    const map = {};
    for (const issue of recentIssues) {
      if (!issue.project_id) continue;
      const name = projectMap[issue.project_id] || issue.work_order_name || "Unknown";
      if (!map[issue.project_id]) map[issue.project_id] = { id: issue.project_id, name, count: 0 };
      map[issue.project_id].count++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [recentIssues, projectMap]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Top Technicians */}
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Top Technicians</CardTitle>
          <p className="text-xs text-gray-500 mt-1">By failures · Apr 1, 2026+</p>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-4 space-y-1">
          {techData.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">No failures in this period</p>
          ) : (
            techData.map((item, idx) => (
              <RankItem
                key={item.id || item.name}
                rank={idx + 1}
                name={item.name}
                count={item.count}
                onClick={() => item.id ? onFilterClick("technician", item.id) : onFilterClick("technicianName", item.name)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Top Customers</CardTitle>
          <p className="text-xs text-gray-500 mt-1">By failures · Apr 1, 2026+</p>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-4 space-y-1">
          {custData.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">No failures in this period</p>
          ) : (
            custData.map((item, idx) => (
              <RankItem
                key={item.name}
                rank={idx + 1}
                name={item.name}
                count={item.count}
                onClick={() => onFilterClick("customer", item.name)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Top Projects */}
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Top Projects</CardTitle>
          <p className="text-xs text-gray-500 mt-1">By failures · Apr 1, 2026+</p>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-4 space-y-1">
          {projData.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">No failures in this period</p>
          ) : (
            projData.map((item, idx) => (
              <RankItem
                key={item.id}
                rank={idx + 1}
                name={item.name}
                count={item.count}
                onClick={() => onFilterClick("project", item.id)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}