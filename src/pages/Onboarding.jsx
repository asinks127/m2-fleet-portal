import React, { useState } from 'react';
import { User } from '@/api/entities.js';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Building2, AlertCircle, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils/index.js';

export default function Onboarding() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    business: '',
    ein: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await User.updateMyUserData({
        ...formData,
        onboardingCompleted: true,
      });
      // Navigate to the main contractor dashboard after successful onboarding
      navigate(createPageUrl('ContractorDashboard'));
    } catch (err) {
      console.error('Error saving onboarding data:', err);
      setError('Failed to save your information. Please check the details and try again.');
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <Card>
          <CardHeader className="text-center">
            <Building2 className="w-12 h-12 mx-auto text-blue-600 mb-2" />
            <CardTitle className="text-2xl font-bold">Welcome to M2 Fleet</CardTitle>
            <CardDescription>Please complete your profile to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Business & Contact Information */}
              <div className="space-y-4">
                 <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Business Information</h3>
                 <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="business">Business Name *</Label>
                        <Input id="business" value={formData.business} onChange={handleInputChange} required />
                    </div>
                    <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input id="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
                    </div>
                 </div>
                 <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="ein">EIN (Employer ID Number) *</Label>
                        <Input id="ein" value={formData.ein} onChange={handleInputChange} required />
                    </div>
                 </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Mailing Address</h3>
                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <Input id="address" value={formData.address} onChange={handleInputChange} required />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" value={formData.city} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input id="state" value={formData.state} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP Code *</Label>
                    <Input id="zip" value={formData.zip} onChange={handleInputChange} required />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Emergency Contact</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergencyContactName">Contact Full Name *</Label>
                    <Input id="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor="emergencyContactPhone">Contact Phone Number *</Label>
                    <Input id="emergencyContactPhone" type="tel" value={formData.emergencyContactPhone} onChange={handleInputChange} required />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSaving ? 'Saving...' : 'Complete Profile & Continue'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}