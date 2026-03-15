import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Loader2, AlertTriangle, UserX, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';

export default function MissingEmergencyContacts() {
  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState([]);
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allUsers = await (await supabase.from('User').select('*') /* TODO: restore sorting/limit '-created_date', 1000 */).data;
      
      const activeContractors = allUsers.filter(user =>
        user.active && user.email && (
          user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
          user.email.toLowerCase().includes('.contractor@smcinstallations.com')
        )
      );

      setContractors(activeContractors);

      const missingContacts = activeContractors.filter(user => 
        !user.emergencyContactName || 
        !user.emergencyContactPhone
      );

      setMissing(missingContacts);
    } catch (error) {
      console.error('Error loading contractors:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Missing Emergency Contacts</h1>
        <p className="text-gray-600 mt-1">Active contractors without complete emergency contact information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Active Contractors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{contractors.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Missing Emergency Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{missing.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {contractors.length > 0 ? Math.round(((contractors.length - missing.length) / contractors.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {missing.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{missing.length} contractor{missing.length !== 1 ? 's' : ''}</strong> {missing.length !== 1 ? 'are' : 'is'} missing emergency contact information. Please follow up with them to complete their profiles.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-600" />
            Contractors Missing Emergency Contacts ({missing.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {missing.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserX className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium">All contractors have complete emergency contact information! ✓</p>
            </div>
          ) : (
            <div className="space-y-3">
              {missing.map(contractor => (
                <div key={contractor.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link 
                        to={createPageUrl(`ContractorProfile?id=${contractor.id}`)}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {contractor.displayName || contractor.business || contractor.full_name || 'N/A'}
                      </Link>
                      {contractor.project && (
                        <Badge variant="outline">{contractor.project}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {contractor.email}
                      </span>
                      {contractor.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contractor.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    {!contractor.emergencyContactName && (
                      <Badge variant="destructive" className="text-xs">No Name</Badge>
                    )}
                    {!contractor.emergencyContactPhone && (
                      <Badge variant="destructive" className="text-xs">No Phone</Badge>
                    )}
                    {!contractor.emergencyContactEmail && (
                      <Badge className="bg-orange-100 text-orange-800 text-xs">No Email</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}