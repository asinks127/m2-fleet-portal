import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  on_leave: "bg-yellow-100 text-yellow-800 border-yellow-200",
  inactive: "bg-gray-100 text-gray-800 border-gray-200"
};

export default function TechCard({ technician, onEdit, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="material-card shadow-md hover:shadow-lg transition-all duration-300">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl text-gray-900">{technician.full_name}</CardTitle>
              {technician.employee_id && (
                <p className="text-sm text-gray-500 mt-1">ID: {technician.employee_id}</p>
              )}
            </div>
            <Badge variant="secondary" className={statusColors[technician.status]}>
              {technician.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {technician.specialty && (
            <div className="text-sm">
              <span className="font-medium text-gray-700">Specialty:</span>
              <span className="ml-2 text-gray-600">{technician.specialty}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4 text-blue-600" />
            <a href={`tel:${technician.phone}`} className="hover:text-blue-600 transition-colors">
              {technician.phone}
            </a>
          </div>
          {technician.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-blue-600" />
              <a href={`mailto:${technician.email}`} className="hover:text-blue-600 transition-colors truncate">
                {technician.email}
              </a>
            </div>
          )}
          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(technician)}
              className="flex-1 ripple"
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(technician.id)}
              className="flex-1 text-red-600 hover:bg-red-50 ripple"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}