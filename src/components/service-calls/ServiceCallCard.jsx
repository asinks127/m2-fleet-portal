import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, User, Pencil, Trash2, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
};

const serviceTypeColors = {
  installation: "bg-purple-100 text-purple-800",
  repair: "bg-red-100 text-red-800",
  maintenance: "bg-blue-100 text-blue-800",
  inspection: "bg-yellow-100 text-yellow-800",
  warranty: "bg-orange-100 text-orange-800"
};

export default function ServiceCallCard({ serviceCall, onEdit, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="material-card shadow-md hover:shadow-lg transition-all duration-300">
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg text-gray-900">{serviceCall.customer_name}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className={statusColors[serviceCall.status]}>
                  {serviceCall.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className={serviceTypeColors[serviceCall.service_type]}>
                  {serviceCall.service_type}
                </Badge>
              </div>
            </div>
            {serviceCall.miles_driven > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{serviceCall.miles_driven}</div>
                <div className="text-xs text-gray-500">miles</div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{serviceCall.service_address}</span>
          </div>
          {serviceCall.start_address && (
            <div className="flex items-start gap-2 text-sm">
              <Navigation className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">From: {serviceCall.start_address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>{format(new Date(serviceCall.service_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4 text-blue-600" />
            <span>{serviceCall.technician_name}</span>
          </div>
          {serviceCall.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {serviceCall.notes}
            </div>
          )}
          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(serviceCall)}
              className="flex-1 ripple"
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(serviceCall.id)}
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