import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Calendar, User, Pencil, Trash2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_review: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  resolved: "bg-purple-100 text-purple-800 border-purple-200"
};

export default function WarrantyCard({ warrantyClaim, onEdit, onDelete, onSelect, isSelected }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={`material-card shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => onSelect(warrantyClaim)}
      >
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg text-gray-900">{warrantyClaim.customer_name}</CardTitle>
              {warrantyClaim.claim_number && (
                <p className="text-sm text-gray-500 mt-1">#{warrantyClaim.claim_number}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge variant="secondary" className={statusColors[warrantyClaim.status]}>
                {warrantyClaim.status.replace('_', ' ')}
              </Badge>
              {warrantyClaim.return_required && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <Package className="w-3 h-3 mr-1" />
                  Return Required
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Product</p>
            <p className="text-sm text-gray-600">{warrantyClaim.product_description}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Issue</p>
            <p className="text-sm text-gray-600">{warrantyClaim.issue_description}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Filed: {format(new Date(warrantyClaim.claim_date), 'MMM d, yyyy')}</span>
          </div>
          {warrantyClaim.technician_name && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-blue-600" />
              <span>{warrantyClaim.technician_name}</span>
            </div>
          )}
          {warrantyClaim.resolution && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm font-medium text-green-900">Resolution</p>
              </div>
              <p className="text-sm text-green-700">{warrantyClaim.resolution}</p>
              {warrantyClaim.resolution_date && (
                <p className="text-xs text-green-600 mt-1">
                  {format(new Date(warrantyClaim.resolution_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(warrantyClaim);
              }}
              className="flex-1 ripple"
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(warrantyClaim.id);
              }}
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