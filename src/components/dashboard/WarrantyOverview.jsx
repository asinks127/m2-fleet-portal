import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Package, XCircle, CheckCircle } from "lucide-react";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_review: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  resolved: "bg-purple-100 text-purple-800 border-purple-200"
};

export default function WarrantyOverview({ warrantyClaims }) {
  const stats = {
    pending: warrantyClaims.filter(w => w.status === 'pending').length,
    returnRequired: warrantyClaims.filter(w => w.return_required).length,
    resolved: warrantyClaims.filter(w => w.status === 'resolved').length
  };

  return (
    <Card className="material-card shadow-md">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Warranty Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.returnRequired}</p>
              <p className="text-sm text-gray-500">Return Required</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.resolved}</p>
              <p className="text-sm text-gray-500">Resolved</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {warrantyClaims.slice(0, 5).map((claim) => (
            <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{claim.customer_name}</p>
                <p className="text-sm text-gray-500 truncate">{claim.product_description}</p>
              </div>
              <div className="flex items-center gap-2">
                {claim.return_required && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    Return Required
                  </Badge>
                )}
                <Badge variant="secondary" className={statusColors[claim.status]}>
                  {claim.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}