import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle, Save } from "lucide-react";

export default function CallLogForm({ onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    caller_name: "",
    call_date: new Date().toISOString().slice(0, 16),
    call_type: "customer_inquiry",
    duration_minutes: "",
    notes: "",
    action_taken: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 space-y-3 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="caller_name">Caller Name *</Label>
        <Input
          id="caller_name"
          value={formData.caller_name}
          onChange={(e) => setFormData({...formData, caller_name: e.target.value})}
          required
          placeholder="Who made the call?"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="call_date">Date & Time *</Label>
          <Input
            id="call_date"
            type="datetime-local"
            value={formData.call_date}
            onChange={(e) => setFormData({...formData, call_date: e.target.value})}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            type="number"
            value={formData.duration_minutes}
            onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || ""})}
            placeholder="15"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="call_type">Call Type *</Label>
        <Select
          value={formData.call_type}
          onValueChange={(value) => setFormData({...formData, call_type: value})}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer_inquiry">Customer Inquiry</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="resolution">Resolution</SelectItem>
            <SelectItem value="escalation">Escalation</SelectItem>
            <SelectItem value="parts_order">Parts Order</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Call details..."
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="action_taken">Action Taken</Label>
        <Textarea
          id="action_taken"
          value={formData.action_taken}
          onChange={(e) => setFormData({...formData, action_taken: e.target.value})}
          placeholder="What action was taken?"
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
        >
          <XCircle className="w-3 h-3 mr-1" />
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
      </div>
    </form>
  );
}