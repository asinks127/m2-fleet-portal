import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Shield } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import WarrantyCard from "../components/warranty/WarrantyCard";
import WarrantyForm from "../components/warranty/WarrantyForm";
import CallLogList from "../components/warranty/CallLogList";

export default function WarrantyClaims() {
  const [showForm, setShowForm] = useState(false);
  const [editingClaim, setEditingClaim] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const queryClient = useQueryClient();

  const { data: warrantyClaims = [], isLoading } = useQuery({
    queryKey: ['warrantyClaims'],
    queryFn: () => base44.entities.WarrantyClaim.list('-claim_date'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WarrantyClaim.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warrantyClaims'] });
      setShowForm(false);
      setEditingClaim(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WarrantyClaim.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warrantyClaims'] });
      setShowForm(false);
      setEditingClaim(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WarrantyClaim.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warrantyClaims'] });
    },
  });

  const handleSubmit = (data) => {
    if (editingClaim) {
      updateMutation.mutate({ id: editingClaim.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (claim) => {
    setEditingClaim(claim);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this warranty claim?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Warranty Claims</h1>
          <p className="text-gray-500 mt-1">Manage returns and resolutions</p>
        </div>
        <Button
          onClick={() => {
            setEditingClaim(null);
            setShowForm(!showForm);
          }}
          className="bg-blue-600 hover:bg-blue-700 shadow-md ripple"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Warranty Claim
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <WarrantyForm
              warrantyClaim={editingClaim}
              technicians={technicians}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingClaim(null);
              }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {warrantyClaims.map((claim) => (
            <WarrantyCard
              key={claim.id}
              warrantyClaim={claim}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSelect={setSelectedClaim}
              isSelected={selectedClaim?.id === claim.id}
            />
          ))}

          {!isLoading && warrantyClaims.length === 0 && !showForm && (
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
              <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No warranty claims yet</h3>
              <p className="text-gray-500">Start by adding your first warranty claim</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedClaim && (
            <CallLogList warrantyClaim={selectedClaim} />
          )}
        </div>
      </div>
    </div>
  );
}