import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const callTypeColors = {
  customer_inquiry: "bg-blue-100 text-blue-800",
  follow_up: "bg-purple-100 text-purple-800",
  resolution: "bg-green-100 text-green-800",
  escalation: "bg-red-100 text-red-800",
  parts_order: "bg-orange-100 text-orange-800"
};

export default function CallLogItem({ callLog, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-medium text-sm text-gray-900">{callLog.caller_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={callTypeColors[callLog.call_type]}>
              {callLog.call_type.replace('_', ' ')}
            </Badge>
            {callLog.duration_minutes && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{callLog.duration_minutes} min</span>
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-red-500 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        {format(new Date(callLog.call_date), 'MMM d, yyyy h:mm a')}
      </p>
      {callLog.notes && (
        <p className="text-sm text-gray-700 mb-2">{callLog.notes}</p>
      )}
      {callLog.action_taken && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-900">
          <span className="font-medium">Action: </span>
          {callLog.action_taken}
        </div>
      )}
    </motion.div>
  );
}