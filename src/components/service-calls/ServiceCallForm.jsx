import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle, Save, Loader2 } from "lucide-react";
import { base44 } from "@/api/warrantyClient";

export default function ServiceCallForm({ serviceCall, technicians, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(serviceCall || {
    technician_id: "",
    technician_name: "",
    customer_name: "",
    service_address: "",
    start_address: "",
    service_date: new Date().toISOString().split('T')[0],
    miles_driven: 0,
    service_type: "repair",
    status: "scheduled",
    notes: ""
  });

  const [calculating, setCalculating] = useState(false);

  const handleTechChange = (techId) => {
    const tech = technicians.find(t => t.id === techId);
    setFormData({
      ...formData,
      technician_id: techId,
      technician_name: tech?.full_name || ""
    });
  };

  const calculateMileage = async () => {
    if (!formData.start_address || !formData.service_address) return;
    
    setCalculating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate the driving distance in miles between these two addresses:
Start: ${formData.start_address}
End: ${formData.service_address}

Return only the numeric distance value (e.g., 15.3).`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            miles: { type: "number" }
          }
        }
      });
      
      if (result.miles) {
        setFormData({...formData, miles_driven: Math.round(result.miles * 10) / 10});
      }
    } catch (error) {
      console.error("Error calculating mileage:", error);
    }
    setCalculating(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="material-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <CardTitle>{serviceCall ? 'Edit Service Call' : 'New Service Call'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="technician">Technician *</Label>
              <Select
                value={formData.technician_id}
                onValueChange={handleTechChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                required
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="service_address">Service Address *</Label>
              <Input
                id="service_address"
                value={formData.service_address}
                onChange={(e) => setFormData({...formData, service_address: e.target.value})}
                required
                placeholder="123 Main St, City, State ZIP"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="start_address">Start Address (for mileage)</Label>
              <Input
                id="start_address"
                value={formData.start_address}
                onChange={(e) => setFormData({...formData, start_address: e.target.value})}
                placeholder="Office or home address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="miles_driven">Miles Driven</Label>
              <div className="flex gap-2">
                <Input
                  id="miles_driven"
                  type="number"
                  step="0.1"
                  value={formData.miles_driven}
                  onChange={(e) => setFormData({...formData, miles_driven: parseFloat(e.target.value) || 0})}
                  placeholder="0.0"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={calculateMileage}
                  disabled={!formData.start_address || !formData.service_address || calculating}
                >
                  {calculating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Calculate'
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_date">Service Date *</Label>
              <Input
                id="service_date"
                type="date"
                value={formData.service_date}
                onChange={(e) => setFormData({...formData, service_date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type</Label>
              <Select
                value={formData.service_type}
                onValueChange={(value) => setFormData({...formData, service_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="warranty">Warranty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes about this service call"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t p-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="ripple"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 ripple"
          >
            <Save className="w-4 h-4 mr-2" />
            {serviceCall ? 'Update' : 'Create'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}