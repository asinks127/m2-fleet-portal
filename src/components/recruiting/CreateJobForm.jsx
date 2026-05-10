import React, { useState } from 'react';
import { JobOpening } from '@/api/entities.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Loader2, AlertCircle } from 'lucide-react';

export default function CreateJobForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    employmentType: 'Contractor',
    description: '',
    requirements: '',
    benefits: '',
    salary: '',
    status: 'Open'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // Build full description with requirements and benefits
      const fullDescription = `
${formData.description}

REQUIREMENTS:
${formData.requirements}

BENEFITS & COMPENSATION:
${formData.benefits}
${formData.salary ? `\nSalary: ${formData.salary}` : ''}
      `.trim();

      await JobOpening.create({
        title: formData.title,
        department: formData.department,
        location: formData.location,
        employmentType: formData.employmentType,
        description: fullDescription,
        status: formData.status
      });

      onSuccess();
    } catch (err) {
      console.error('Error creating job:', err);
      setError('Failed to create job opening. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Job Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g., Field Technician"
            required
          />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={formData.department}
            onChange={handleInputChange}
            placeholder="e.g., Operations"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="e.g., Colorado Springs, CO"
          />
        </div>
        <div>
          <Label htmlFor="employmentType">Employment Type</Label>
          <Select value={formData.employmentType} onValueChange={(value) => handleSelectChange('employmentType', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Contractor">Contractor</SelectItem>
              <SelectItem value="Full-time">Full-time</SelectItem>
              <SelectItem value="Part-time">Part-time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="salary">Salary/Pay Range</Label>
        <Input
          id="salary"
          value={formData.salary}
          onChange={handleInputChange}
          placeholder="e.g., $800-1200/week, $25-30/hour"
        />
      </div>

      <div>
        <Label htmlFor="description">Job Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={4}
          placeholder="Describe the role, responsibilities, and what the candidate will be doing..."
          required
        />
      </div>

      <div>
        <Label htmlFor="requirements">Requirements & Qualifications</Label>
        <Textarea
          id="requirements"
          value={formData.requirements}
          onChange={handleInputChange}
          rows={3}
          placeholder="List required skills, experience, certifications, etc..."
        />
      </div>

      <div>
        <Label htmlFor="benefits">Benefits & What We Offer</Label>
        <Textarea
          id="benefits"
          value={formData.benefits}
          onChange={handleInputChange}
          rows={3}
          placeholder="Health insurance, flexible schedule, growth opportunities, etc..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isSaving ? 'Creating...' : 'Create Job'}
        </Button>
      </div>
    </form>
  );
}