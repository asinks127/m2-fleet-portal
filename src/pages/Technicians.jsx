import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import TechCard from "../components/technicians/TechCard";
import TechForm from "../components/technicians/TechForm";

export default function Technicians() {
  const [showForm, setShowForm] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const queryClient = useQueryClient();

  const { data: technicians = [], isLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list('-created_date'),
  });

  const normalizeName = (name) =>
    (name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Technician.create({
      ...data,
      normalized_name: normalizeName(data.full_name),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      setShowForm(false);
      setEditingTech(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Technician.update(id, {
      ...data,
      normalized_name: normalizeName(data.full_name),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      setShowForm(false);
      setEditingTech(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Technician.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });

  const handleSubmit = (data) => {
    if (editingTech) {
      updateMutation.mutate({ id: editingTech.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (tech) => {
    setEditingTech(tech);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to remove this technician?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Technicians</h1>
          <p className="text-gray-500 mt-1">Manage your field service team</p>
        </div>
        <Button
          onClick={() => {
            setEditingTech(null);
            setShowForm(!showForm);
          }}
          className="bg-blue-600 hover:bg-blue-700 shadow-md ripple"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Technician
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <TechForm
              technician={editingTech}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingTech(null);
              }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {technicians.map((tech) => (
            <TechCard
              key={tech.id}
              technician={tech}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </AnimatePresence>
      </div>

      {!isLoading && technicians.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No technicians yet</h3>
          <p className="text-gray-500">Get started by adding your first technician</p>
        </div>
      )}
    </div>
  );
}