import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminOnboardingStatus() {
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const users = await base44.entities.User.list();
      // Filter to only include users with the contractor role logic (assuming they have business, project or they are just users)
      const contractors = users.filter(u => u.role === 'user' && u.email && !u.email.endsWith('@velociti.com'));
      setTechs(contractors);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTechs = techs.filter(t => 
    (t.full_name || t.displayName || t.email)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Completed': return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'In Progress': return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1"/> In Progress</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1"/> Pending</Badge>;
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contractor Onboarding Status</h1>
        <p className="text-gray-600 mt-1">Track the onboarding progress of all technicians in the system.</p>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <Search className="w-5 h-5 text-gray-400" />
        <Input 
          placeholder="Search technicians..." 
          className="border-none shadow-none focus-visible:ring-0 text-base"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold">Technician</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Onboarding Status</th>
                <th className="px-6 py-4 font-semibold">Completion Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTechs.map(tech => (
                <tr key={tech.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{tech.full_name || tech.displayName || 'Unknown'}</td>
                  <td className="px-6 py-4 text-gray-500">{tech.email}</td>
                  <td className="px-6 py-4">{getStatusBadge(tech.onboardingStatus)}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {tech.signedOnboardingDate ? format(new Date(tech.signedOnboardingDate), 'MMM d, yyyy h:mm a') : '-'}
                  </td>
                </tr>
              ))}
              {filteredTechs.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No technicians found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}