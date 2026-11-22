import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Plus } from "lucide-react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import CallLogItem from "./CallLogItem";
import CallLogForm from "./CallLogForm";

export default function CallLogList({ warrantyClaim }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: callLogs = [] } = useQuery({
    queryKey: ['callLogs', warrantyClaim.id],
    queryFn: () => base44.entities.WarrantyCallLog.filter({ warranty_claim_id: warrantyClaim.id }, '-call_date'),
    enabled: !!warrantyClaim.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WarrantyCallLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callLogs', warrantyClaim.id] });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WarrantyCallLog.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callLogs', warrantyClaim.id] });
    },
  });

  const handleSubmit = (data) => {
    createMutation.mutate({
      ...data,
      warranty_claim_id: warrantyClaim.id,
      claim_number: warrantyClaim.claim_number
    });
  };

  return (
    <Card className="material-card shadow-md sticky top-6">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="w-5 h-5 text-blue-600" />
            Call Log
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 ripple"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Call
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <CallLogForm
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
                isLoading={createMutation.isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <AnimatePresence>
            {callLogs.map((log) => (
              <CallLogItem
                key={log.id}
                callLog={log}
                onDelete={() => deleteMutation.mutate(log.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {callLogs.length === 0 && !showForm && (
          <div className="text-center py-8 text-gray-500">
            <Phone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No calls logged yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}