import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { XCircle, Save } from "lucide-react";

export default function WarrantyForm({ warrantyClaim, technicians, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(warrantyClaim || {
    claim_number: "",
    technician_id: "",
    technician_name: "",
    customer_name: "",
    product_description: "",
    issue_description: "",
    return_required: false,
    status: "pending",
    claim_date: new Date().toISOString().split('T')[0],
    resolution: "",
    resolution_date: ""
  });

  const handleTechChange = (techId) => {
    const tech = technicians.find(t => t.id === techId);
    setFormData({
      ...formData,
      technician_id: techId,
      technician_name: tech?.full_name || ""
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="material-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <CardTitle>{warrantyClaim ? 'Edit Warranty Claim' : 'New Warranty Claim'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="claim_number">Claim Number</Label>
              <Input
                id="claim_number"
                value={formData.claim_number}
                onChange={(e) => setFormData({...formData, claim_number: e.target.value})}
                placeholder="WC-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="technician">Technician</Label>
              <Select
                value={formData.technician_id}
                onValueChange={handleTechChange}
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
            <div className="space-y-2">
              <Label htmlFor="claim_date">Claim Date *</Label>
              <Input
                id="claim_date"
                type="date"
                value={formData.claim_date}
                onChange={(e) => setFormData({...formData, claim_date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="product_description">Product Description *</Label>
              <Input
                id="product_description"
                value={formData.product_description}
                onChange={(e) => setFormData({...formData, product_description: e.target.value})}
                required
                placeholder="Product details"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="issue_description">Issue Description *</Label>
              <Textarea
                id="issue_description"
                value={formData.issue_description}
                onChange={(e) => setFormData({...formData, issue_description: e.target.value})}
                required
                placeholder="Describe the issue"
                rows={3}
              />
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="return_required"
                checked={formData.return_required}
                onCheckedChange={(checked) => setFormData({...formData, return_required: checked})}
              />
              <Label htmlFor="return_required" className="cursor-pointer">
                Return Required
              </Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Textarea
                id="resolution"
                value={formData.resolution}
                onChange={(e) => setFormData({...formData, resolution: e.target.value})}
                placeholder="How was this resolved?"
                rows={3}
              />
            </div>
            {formData.resolution && (
              <div className="space-y-2">
                <Label htmlFor="resolution_date">Resolution Date</Label>
                <Input
                  id="resolution_date"
                  type="date"
                  value={formData.resolution_date}
                  onChange={(e) => setFormData({...formData, resolution_date: e.target.value})}
                />
              </div>
            )}
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
            {warrantyClaim ? 'Update' : 'Create'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}