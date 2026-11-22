import React, { useState, useMemo } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import { isValidRecord } from "../lib/qcFilters";
import { format } from "date-fns";

export default function CustomerAccountView() {
  const [expanded, setExpanded] = useState({});
  const [projectFilter, setProjectFilter] = useState("all");

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['qcIssues'],
    queryFn: () => base44.entities.QCIssue.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.WarrantyProject.list(),
  });

  const filteredIssues = useMemo(() => {
    const valid = issues.filter(isValidRecord);
    if (projectFilter === 'all') return valid;
    return valid.filter(i => i.project_id === projectFilter);
  }, [issues, projectFilter]);

  const grouped = useMemo(() => {
    const map = {};
    for (const issue of filteredIssues) {
      const key = issue.customer || issue.work_order_name?.split(':')[0]?.trim() || 'Unknown Customer';
      if (!map[key]) map[key] = [];
      map[key].push(issue);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filteredIssues]);

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer / Account View</h1>
          <p className="text-gray-500 mt-1">QC issues grouped by customer or account</p>
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {grouped.map(([customer, customerIssues]) => {
          const open = customerIssues.filter(i => ['pending_repair', 'scheduled'].includes(i.status)).length;
          const warranty = customerIssues.filter(i => i.warranty_return_required).length;
          const isOpen = expanded[customer];

          return (
            <Card key={customer} className="shadow-sm">
              <CardHeader
                className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggle(customer)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-base">{customer}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{customerIssues.length} total</Badge>
                    {open > 0 && <Badge className="bg-orange-100 text-orange-800">{open} open</Badge>}
                    {warranty > 0 && <Badge className="bg-purple-100 text-purple-800">{warranty} warranty</Badge>}
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 font-medium">Work Order</th>
                          <th className="pb-2 font-medium">Technician</th>
                          <th className="pb-2 font-medium">Category</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerIssues.map(issue => (
                          <tr key={issue.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 font-medium">{issue.work_order_name || issue.asset_number || '—'}</td>
                            <td className="py-2 text-gray-600">{issue.technician_name || '—'}</td>
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs">
                                {(issue.final_category || issue.auto_category || issue.issue_category || 'other').replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="py-2">
                              <StatusBadge status={issue.status} />
                            </td>
                            <td className="py-2 text-gray-500 text-xs">
                              {issue.date_received ? format(new Date(issue.date_received), 'MM/dd/yy') : '—'}
                            </td>
                            <td className="py-2 flex gap-1 flex-wrap">
                              {issue.overdue_flag && <Badge className="text-xs bg-red-100 text-red-800">Overdue</Badge>}
                              {issue.warranty_return_required && <Badge className="text-xs bg-purple-100 text-purple-800">Warranty</Badge>}
                              {issue.repeat_issue && <Badge className="text-xs bg-pink-100 text-pink-800">Repeat</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {grouped.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No customer data yet</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    pending_repair: "bg-red-100 text-red-800",
    scheduled: "bg-yellow-100 text-yellow-800",
    repaired: "bg-blue-100 text-blue-800",
    closed: "bg-green-100 text-green-800"
  };
  return <Badge className={`text-xs ${colors[status] || 'bg-gray-100 text-gray-800'}`}>{status?.replace(/_/g, ' ')}</Badge>;
}