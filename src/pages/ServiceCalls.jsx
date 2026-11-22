import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import ServiceCallCard from "../components/service-calls/ServiceCallCard";
import ServiceCallForm from "../components/service-calls/ServiceCallForm";

export default function ServiceCalls() {
  const [showForm, setShowForm] = useState(false);
  const [editingCall, setEditingCall] = useState(null);
  const queryClient = useQueryClient();

  const { data: serviceCalls = [], isLoading } = useQuery({
    queryKey: ['serviceCalls'],
    queryFn: () => base44.entities.ServiceCall.list('-service_date'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ServiceCall.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      setShowForm(false);
      setEditingCall(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ServiceCall.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      setShowForm(false);
      setEditingCall(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServiceCall.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
    },
  });

  const handleSubmit = (data) => {
    if (editingCall) {
      updateMutation.mutate({ id: editingCall.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (call) => {
    setEditingCall(call);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this service call?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Calls</h1>
          <p className="text-gray-500 mt-1">Track jobs and mileage</p>
        </div>
        <Button
          onClick={() => {
            setEditingCall(null);
            setShowForm(!showForm);
          }}
          className="bg-blue-600 hover:bg-blue-700 shadow-md ripple"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Service Call
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ServiceCallForm
              serviceCall={editingCall}
              technicians={technicians}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingCall(null);
              }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence>
          {serviceCalls.map((call) => (
            <ServiceCallCard
              key={call.id}
              serviceCall={call}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </AnimatePresence>
      </div>

      {!isLoading && serviceCalls.length === 0 && !showForm && (
        <div className="text-center py-12">
          <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No service calls yet</h3>
          <p className="text-gray-500">Start tracking by adding your first service call</p>
        </div>
      )}
    </div>
  );
}