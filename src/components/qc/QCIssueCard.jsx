import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, User, Pencil, Trash2, Wrench, Package } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import WarrantyResolutionPanel from "./WarrantyResolutionPanel";

const statusColors = {
  pending_repair: "bg-red-100 text-red-800 border-red-200",
  scheduled: "bg-yellow-100 text-yellow-800 border-yellow-200",
  repaired: "bg-blue-100 text-blue-800 border-blue-200",
  closed: "bg-green-100 text-green-800 border-green-200"
};

const categoryColors = {
  camera_positioning: "bg-purple-100 text-purple-800",
  mirror_adjustment: "bg-blue-100 text-blue-800",
  mounting: "bg-orange-100 text-orange-800",
  connection_issue: "bg-red-100 text-red-800",
  equipment_missing: "bg-yellow-100 text-yellow-800",
  installation_quality: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-800"
};

export default function QCIssueCard({ qcIssue, onEdit, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="material-card shadow-md hover:shadow-lg transition-all duration-300">
        <CardHeader className="border-b bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <CardTitle className="text-lg text-gray-900">
                  {qcIssue.work_order_name || 'QC Issue'}
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className={statusColors[qcIssue.status]}>
                  {qcIssue.status.replace('_', ' ')}
                </Badge>
                {qcIssue.issue_category && (
                  <Badge variant="outline" className={categoryColors[qcIssue.issue_category]}>
                    {qcIssue.issue_category.replace('_', ' ')}
                  </Badge>
                )}
                {qcIssue.warranty_return_required && (
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                    <Package className="w-3 h-3 mr-1" />
                    Warranty Return Required
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-900 mb-1">Remote QC Notes:</p>
            <p className="text-sm text-red-800">{qcIssue.qc_notes}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {qcIssue.asset_number && (
              <div>
                <p className="text-gray-500 font-medium">Asset Number</p>
                <p className="text-gray-900">{qcIssue.asset_number}</p>
              </div>
            )}
            {qcIssue.install_service_date && (
              <div>
                <p className="text-gray-500 font-medium">Install Date</p>
                <p className="text-gray-900">{format(new Date(qcIssue.install_service_date), 'MM/dd/yyyy')}</p>
              </div>
            )}
            {qcIssue.installed_vin && (
              <div>
                <p className="text-gray-500 font-medium">Installed VIN</p>
                <p className="text-gray-900 font-mono text-xs">{qcIssue.installed_vin}</p>
              </div>
            )}
            {qcIssue.equip_vin && (
              <div>
                <p className="text-gray-500 font-medium">Equip VIN</p>
                <p className="text-gray-900 font-mono text-xs">{qcIssue.equip_vin}</p>
              </div>
            )}
            {(qcIssue.make || qcIssue.model || qcIssue.year) && (
              <div className="col-span-2">
                <p className="text-gray-500 font-medium">Vehicle</p>
                <p className="text-gray-900">
                  {[qcIssue.year, qcIssue.make, qcIssue.model].filter(Boolean).join(' ')}
                </p>
              </div>
            )}
          </div>

          {qcIssue.post_install_notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-900 mb-1">Post Install Notes:</p>
              <p className="text-sm text-yellow-800">{qcIssue.post_install_notes}</p>
            </div>
          )}

          {qcIssue.case_number && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Case: {qcIssue.case_number}</span>
            </div>
          )}

          {qcIssue.technician_name && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-blue-600" />
              <span>{qcIssue.technician_name}</span>
            </div>
          )}

          {qcIssue.repair_notes && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="w-4 h-4 text-green-600" />
                <p className="text-sm font-medium text-green-900">Repair Notes:</p>
              </div>
              <p className="text-sm text-green-800">{qcIssue.repair_notes}</p>
              {qcIssue.repair_date && (
                <p className="text-xs text-green-600 mt-1">
                  Completed: {format(new Date(qcIssue.repair_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}

          {qcIssue.warranty_return_required && (
            <WarrantyResolutionPanel qcIssue={qcIssue} />
          )}

          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(qcIssue)}
              className="flex-1 ripple"
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(qcIssue.id)}
              className="flex-1 text-red-600 hover:bg-red-50 ripple"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}