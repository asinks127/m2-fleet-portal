import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS = {
  pending_repair: "bg-red-100 text-red-800",
  scheduled: "bg-yellow-100 text-yellow-800",
  repaired: "bg-blue-100 text-blue-800",
  closed: "bg-green-100 text-green-800"
};

function StatusBadge({ status }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>{status?.replace(/_/g, " ") || "—"}</span>;
}

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 text-sm text-gray-700 ${className}`}>{children}</td>;
}

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }); } catch { return d; }
}

function GroupRow({ group, isExpanded, onToggle, onModalOpen }) {
  const catDisplay = (issue) => {
    const c = issue.final_category || issue.auto_category || issue.issue_category || "";
    return c.replace(/_/g, " ") || "—";
  };

  return (
    <div key={group.id} className="border-b border-gray-200">
      <button
        onClick={onToggle}
        className="w-full hover:bg-gray-50 transition-colors"
      >
        <div className="px-4 py-3 flex items-center gap-3 bg-gray-50">
          <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-gray-900">{group.name}</p>
          </div>
          <div className="flex gap-3 text-sm text-gray-600">
            <span><span className="font-medium">{group.issues.length}</span> issues</span>
            <span><span className="font-medium text-purple-600">{group.warranty}</span> warranty</span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr><Th>Date</Th><Th>Asset #</Th><Th>Customer</Th><Th>Category</Th><Th>Status</Th><Th>Warranty</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {group.issues.map(issue => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <Td>{fmtDate(issue.qc_event_date || issue.date_received)}</Td>
                  <Td><button onClick={() => onModalOpen(issue)} className="text-blue-600 hover:underline">{issue.asset_number || "—"}</button></Td>
                  <Td><button onClick={() => onModalOpen(issue)} className="text-blue-600 hover:underline text-left">{issue.customer || "—"}</button></Td>
                  <Td>{catDisplay(issue)}</Td>
                  <Td><StatusBadge status={issue.status} /></Td>
                  <Td>{issue.warranty_return_required ? <Badge className="text-xs bg-purple-100 text-purple-800">Yes</Badge> : "No"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function GroupedQCView({ issues, groupBy, onModalOpen, projectMap }) {
  const [sortBy, setSortBy] = useState("issues");
  const [expandedGroups, setExpandedGroups] = useState({});

  const groups = useMemo(() => {
    const map = {};

    for (const issue of issues) {
      let groupKey, groupName;

      if (groupBy === "technician") {
        groupKey = issue.technician_id || "unknown";
        groupName = issue.technician_name || "Unknown Technician";
      } else if (groupBy === "customer") {
        groupKey = issue.customer || "unknown";
        groupName = issue.customer || "Unknown Customer";
      } else if (groupBy === "project") {
        groupKey = issue.project_id || "unknown";
        groupName = projectMap[issue.project_id] || issue.work_order_name || "Unknown Project";
      }

      if (!map[groupKey]) {
        map[groupKey] = { id: groupKey, name: groupName, issues: [], warranty: 0 };
      }

      map[groupKey].issues.push(issue);
      if (issue.warranty_return_required) {
        map[groupKey].warranty++;
      }
    }

    // Sort groups
    const sortedGroups = Object.values(map);
    if (sortBy === "issues") {
      sortedGroups.sort((a, b) => b.issues.length - a.issues.length);
    } else if (sortBy === "warranty") {
      sortedGroups.sort((a, b) => b.warranty - a.warranty);
    } else if (sortBy === "recent") {
      sortedGroups.sort((a, b) => {
        const dateA = a.issues[0]?.qc_event_date || a.issues[0]?.date_received || a.issues[0]?.created_date || "";
        const dateB = b.issues[0]?.qc_event_date || b.issues[0]?.date_received || b.issues[0]?.created_date || "";
        return dateB.localeCompare(dateA);
      });
    }

    return sortedGroups;
  }, [issues, groupBy, sortBy, projectMap]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  if (groups.length === 0) {
    return <div className="text-center py-8 text-gray-400">No issues found</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 py-3 bg-white border rounded-lg">
        <p className="text-sm text-gray-600"><span className="font-medium">{groups.length}</span> groups · <span className="font-medium">{issues.length}</span> total issues</p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="issues">Sort by Most Issues</SelectItem>
            <SelectItem value="warranty">Sort by Most Warranty</SelectItem>
            <SelectItem value="recent">Sort by Most Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {groups.map(group => (
            <GroupRow
              key={group.id}
              group={group}
              isExpanded={expandedGroups[group.id] || false}
              onToggle={() => toggleGroup(group.id)}
              onModalOpen={onModalOpen}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}