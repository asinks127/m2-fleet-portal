import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/lib/AuthContext.jsx';
import { User } from '@/api/entities.js';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Loader2, ArrowLeft, User as UserIcon, DollarSign, CheckCircle, AlertTriangle, FolderKanban, Info, FileSignature } from 'lucide-react';
import { createPageUrl } from '@/utils/index.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import CallLogDialog from '../components/qc/CallLogDialog';
import QCInspectionDialog from '../components/qc/QCInspectionDialog';
import VeloFeedbackTab from '../components/profile/VeloFeedbackTab';
import PerformanceAdjustmentsTab from '../components/profile/PerformanceAdjustmentsTab';
import ContractorDocumentsTab from '../components/profile/ContractorDocumentsTab';
import ActivityHistoryTab from '../components/profile/ActivityHistoryTab';
import ReviewDocumentsTab from '../components/dashboard/ReviewDocumentsTab';

const adminEmailsList = [
    'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
    'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com'
];

export default function ContractorProfile() {
  const location = useLocation();
  const { user: authUser } = useAuth(); // Get user from AuthContext (handles demo mode)
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isContractorProfile, setIsContractorProfile] = useState(true);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [showCallLogDialog, setShowCallLogDialog] = useState(false);
  const [activityKey, setActivityKey] = useState(0);

  const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

  // Get return path from URL to preserve filters when navigating back
  const params = new URLSearchParams(location.search);
  const returnToPath = params.get('returnTo');

  const getUserId = useCallback(() => {
    const params = new URLSearchParams(location.search);
    return params.get('id');
  }, [location.search]);
  
  const loadUser = useCallback(async (userId, loggedInUser = null) => {
    setIsLoading(true);
    setError(null);
    try {
      let userData;
      
      try {
        const users = await User.filter({ id: userId });
        if (users && users.length > 0) {
          userData = users[0];
        }
      } catch (listError) {
        console.error('Error loading user by ID:', listError);
      }
      
      // Fallback if not found or error
      if (!userData) {
        // Fallback 1: if looking up self, use loggedInUser directly
        if (loggedInUser && userId === loggedInUser.id) {
          userData = loggedInUser;
        } else if (loggedInUser && userId === loggedInUser.id) {
          // Fallback 2: if logged in and looking up self, use auth user data
          userData = loggedInUser;
        } else {
          // Fallback 3: try querying by id directly via Supabase
          const { data: sbUser, error: sbError } = await supabase
            .from('User')
            .select('*')
            .eq('id', userId)
            .single();
          if (sbUser && !sbError) {
            userData = sbUser;
          }
        }
      }
      
      if (!userData) {
        // Fallback 4: use the logged-in user's data if nothing else worked
        if (loggedInUser) {
          userData = loggedInUser;
        } else {
          throw new Error('Unable to load user data.');
        }
      }
      
      if (userData) {
        console.log('Loaded user data:', userData);
        setUser(userData);

        const email = (userData.email || '').toLowerCase();
        const specialContractorEmails = ['tjserota@gmail.com'];
        const isContractor = email.includes('.contractor@') || specialContractorEmails.includes(email);
        setIsContractorProfile(isContractor);
        
        setFormData({
          displayName: userData.displayName || userData.full_name || '',
          business: userData.business || '',
          phone: userData.phone || '',
          email: userData.email || '',
          project: userData.project || '',
          location: userData.location || '',
          weeklyPay: userData.weeklyPay || '',
          startDate: userData.startDate ? userData.startDate.split('T')[0] : '',
          endDate: userData.endDate ? userData.endDate.split('T')[0] : '',
          m2PM: userData.m2PM || '',
          veloPM: userData.veloPM || '',
          qcAssignment: userData.qcAssignment || '',
          active: userData.active !== false,
          shadowingStatus: userData.shadowingStatus || 'not_started',
          shadowingStartDate: userData.shadowingStartDate ? userData.shadowingStartDate.split('T')[0] : '',
          shadowingEndDate: userData.shadowingEndDate ? userData.shadowingEndDate.split('T')[0] : '',
          emergencyContactName: userData.emergencyContactName || '',
          emergencyContactPhone: userData.emergencyContactPhone || '',
          emergencyContactEmail: userData.emergencyContactEmail || '',
        });
      } else {
        setError("Contractor not found.");
      }
    } catch (err) {
      console.error("Failed to load user:", err);
      setError(`An error occurred while fetching contractor details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchAndSetUser = async () => {
      try {
        const { data: { user: loggedInUser } } = await supabase.auth.getUser();
        setCurrentUser(loggedInUser);

        const userIdFromUrl = getUserId();
        const targetUserId = userIdFromUrl || loggedInUser.id;
        
        if (targetUserId) {
          await loadUser(targetUserId, loggedInUser);
        } else {
          setError("Could not determine user to load.");
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Could not fetch initial data:", err);
        setError("You must be logged in to view a profile.");
        setIsLoading(false);
      }
    };
    
    fetchAndSetUser();
  }, [getUserId, loadUser]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    console.log(`Updating ${id} to:`, value);
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleSelectChange = (id, value) => {
    console.log(`Updating ${id} to:`, value);
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    const userIdToUpdate = getUserId() || currentUser?.id;

    // Check required fields before submitting
    if (isContractorProfile && !getUserId()) { // Only for contractors editing their own profile
      const missingFields = [];
      if (!formData.displayName || String(formData.displayName).trim() === '') {
        missingFields.push('Display Name');
      }
      if (!formData.business || String(formData.business).trim() === '') {
        missingFields.push('Business Name');
      }
      if (!formData.phone || String(formData.phone).trim() === '') {
        missingFields.push('Phone Number');
      }
      if (!formData.emergencyContactName || String(formData.emergencyContactName).trim() === '') {
        missingFields.push('Emergency Contact Name');
      }
      if (!formData.emergencyContactPhone || String(formData.emergencyContactPhone).trim() === '') {
        missingFields.push('Emergency Contact Phone');
      }
      
      if (missingFields.length > 0) {
        setError(`Please fill out these required fields: ${missingFields.join(', ')}`);
        setIsSaving(false);
        return;
      }
    }

    try {
      console.log('Submitting form data:', formData);
      
      const updateData = {};
      Object.keys(formData).forEach(key => {
        if (key === 'qcAssignment') {
            updateData[key] = formData[key] === 'null' ? null : formData[key];
        } else if (formData[key] !== '' && formData[key] !== null && formData[key] !== undefined) {
          updateData[key] = formData[key];
        }
      });
      
      updateData.profileComplete = true;
      
      console.log('Clean update data:', updateData);
      
      await User.update(userIdToUpdate, updateData);
      
      setSuccess("Profile updated successfully!");
      
      await loadUser(userIdToUpdate, currentUser);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(`An error occurred while saving: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogSuccess = () => {
    setShowCallLogDialog(false);
    setShowInspectionDialog(false);
    setActivityKey(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-screen">
        <div className="flex flex-col items-center space-y-2">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
          <span className="text-lg text-gray-700">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto mt-10">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Profile</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!user && !isLoading) {
    return (
      <div className="p-6 text-center">
        <Card className="max-w-md mx-auto mt-10">
          <CardContent className="p-8">
            <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Not Available</h2>
            <p className="text-gray-600">Contractor profile could not be loaded or does not exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const authorizedDocEmails = [
    'lena@m2fleetcom.com', 
    'orville@m2fleetcom.com', 
    'austin@m2fleetcom.com', 
    'erica@m2fleetcom.com', 
    'lowell@m2fleetcom.com', 
    'jason@m2fleetcom.com'
  ];
  const canViewDocuments = currentUser?.email && authorizedDocEmails.includes(currentUser.email.toLowerCase());

  return (
    <div className="p-6 space-y-6">
      {getUserId() && (
        <Link to={returnToPath || createPageUrl('TechRoster')}>
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Roster</Button>
        </Link>
      )}
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className={`grid w-full ${
          getUserId() 
            ? (canViewDocuments ? 'grid-cols-6' : 'grid-cols-5') // Admin viewing another user
            : 'grid-cols-3' // Contractor viewing their own profile
        }`}>
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
          
          {/* Only show these tabs if an admin is viewing another user's profile */}
          {getUserId() && (
            <>
              <TabsTrigger value="activity">Activity & QC</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="velo_feedback">Velo PM Feedback</TabsTrigger>
              <TabsTrigger value="signatures">
                  <FileSignature className="w-4 h-4 mr-2"/>
                  Signatures
              </TabsTrigger>
              {canViewDocuments && (
                <TabsTrigger value="documents">
                    <FolderKanban className="w-4 h-4 mr-2"/>
                    Documents
                </TabsTrigger>
              )}
              <TabsTrigger value="settings">Admin Settings</TabsTrigger>
            </>
          )}
          
          {/* Show tabs for contractors viewing their own profile */}
          {!getUserId() && (
            <>
              <TabsTrigger value="signatures">
                  <FileSignature className="w-4 h-4 mr-2"/>
                  Signatures
              </TabsTrigger>
              <TabsTrigger value="documents">
                  <FolderKanban className="w-4 h-4 mr-2"/>
                  Documents
              </TabsTrigger>
              <TabsTrigger value="emergency">Emergency Contact</TabsTrigger>
            </>
          )}
        </TabsList>
        
        <TabsContent value="profile">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <UserIcon className="w-8 h-8" />
                <span>{user?.displayName || user?.full_name || user?.email || 'Contractor Profile'}</span>
              </CardTitle>
              <CardDescription>
                {getUserId() 
                  ? `Edit the profile details for this contractor below. Current email: ${user?.email || 'N/A'}`
                  : "Update your profile information below. Fields marked with * are required."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Show required fields alert for contractors editing their own profile */}
              {!getUserId() && isContractorProfile && (
                <Alert className="mb-6 border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Important:</strong> Please complete all required fields (*) below to access all portal features. This includes your Display Name, Business Name, Phone Number, and Emergency Contact information.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* General Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">General Information</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="displayName">Display Name *</Label>
                      <Input 
                        id="displayName" 
                        value={formData.displayName} 
                        onChange={handleInputChange} 
                        placeholder="Enter display name"
                        required
                      />
                    </div>
                    {isContractorProfile && (
                      <div>
                        <Label htmlFor="business">
                          Business Name *
                        </Label>
                        <Input 
                          id="business" 
                          value={formData.business} 
                          onChange={handleInputChange} 
                          placeholder="Enter your business name"
                          required={isContractorProfile && !getUserId()}
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" value={formData.email} disabled />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed.</p>
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input 
                        id="phone" 
                        type="tel" 
                        value={formData.phone} 
                        onChange={handleInputChange} 
                        placeholder="Enter phone number"
                        required
                      />
                    </div>
                  </div>
                </div>

                {isContractorProfile && (
                  <>
                    {/* Project Details */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold border-b pb-2">Project Details</h3>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="project">Project *</Label>
                            <Input 
                              id="project" 
                              value={formData.project} 
                              onChange={handleInputChange} 
                              placeholder="Enter project name"
                              required={isContractorProfile}
                            />
                        </div>
                        <div>
                            <Label htmlFor="location">Work Location</Label>
                            <Input id="location" value={formData.location} onChange={handleInputChange} />
                        </div>
                        <div>
                            <Label htmlFor="m2PM">M2 Project Manager</Label>
                            <Input 
                              id="m2PM" 
                              value={formData.m2PM} 
                              onChange={handleInputChange} 
                              placeholder="Enter M2 PM name"
                            />
                        </div>
                        <div>
                            <Label htmlFor="veloPM">Velo Project Manager</Label>
                            <Input 
                              id="veloPM" 
                              value={formData.veloPM} 
                              onChange={handleInputChange} 
                              placeholder="Enter Velo PM name"
                            />
                        </div>
                        {/* Only show QC assignment if admin is viewing */}
                        {getUserId() && (
                          <div>
                              <Label htmlFor="qcAssignment">QC Assignment</Label>
                              <Select onValueChange={(val) => handleSelectChange('qcAssignment', val === 'null' ? null : val)} value={formData.qcAssignment === null ? 'null' : (formData.qcAssignment || '')}>
                                  <SelectTrigger><SelectValue placeholder="Select QC Manager" /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="null">No Assignment</SelectItem>
                                      <SelectItem value="Ryan Miller">Ryan Miller</SelectItem>
                                      <SelectItem value="Chance Hoffman">Chance Hoffman</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shadowing Status - Only visible to admin when viewing another user's profile */}
                    {getUserId() && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold border-b pb-2">Shadowing & Onboarding</h3>
                        <div className="grid md:grid-cols-3 gap-6">
                          <div>
                            <Label htmlFor="shadowingStatus">Shadowing Status</Label>
                            <Select onValueChange={(val) => handleSelectChange('shadowingStatus', val)} value={formData.shadowingStatus}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="shadowingStartDate">Shadowing Start Date</Label>
                            <Input
                              id="shadowingStartDate"
                              type="date"
                              value={formData.shadowingStartDate}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div>
                            <Label htmlFor="shadowingEndDate">Expected End Date</Label>
                            <Input
                              id="shadowingEndDate"
                              type="date"
                              value={formData.shadowingEndDate}
                              onChange={handleInputChange}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Contract & Pay - Show pay info for contractors AND for admins viewing */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold border-b pb-2">Contract & Pay</h3>
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* Show weekly pay field for contractors editing their own profile OR admins viewing */}
                        <div>
                            <Label htmlFor="weeklyPay">
                              Weekly Pay Target
                            </Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input 
                                  id="weeklyPay" 
                                  value={formData.weeklyPay} 
                                  onChange={handleInputChange} 
                                  className="pl-9"
                                  placeholder="Enter weekly pay target"
                                  type="number"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input id="startDate" type="date" value={formData.startDate} onChange={handleInputChange} />
                        </div>
                        <div>
                            <Label htmlFor="endDate">Contract End Date</Label>
                            <Input id="endDate" type="date" value={formData.endDate} onChange={handleInputChange} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Emergency Contact - Always show in profile tab for both contractors and admins */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Emergency Contact</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="emergencyContactName">Contact Full Name *</Label>
                      <Input 
                        id="emergencyContactName" 
                        value={formData.emergencyContactName} 
                        onChange={handleInputChange}
                        required={isContractorProfile && !getUserId()}
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContactPhone">Contact Phone *</Label>
                      <Input 
                        id="emergencyContactPhone" 
                        type="tel" 
                        value={formData.emergencyContactPhone} 
                        onChange={handleInputChange}
                        required={isContractorProfile && !getUserId()}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="emergencyContactEmail">Contact Email</Label>
                      <Input 
                        id="emergencyContactEmail" 
                        type="email" 
                        value={formData.emergencyContactEmail} 
                        onChange={handleInputChange} 
                      />
                    </div>
                  </div>
                </div>

                {/* Status - Only visible to admin editing another user */}
                {getUserId() && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Status</h3>
                      <div>
                          <Label htmlFor="active">Contractor Status</Label>
                          <Select onValueChange={(val) => handleSelectChange('active', val === 'true')} value={String(formData.active)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="true">Active</SelectItem>
                                  <SelectItem value="false">Inactive</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-4 items-center">
                  {error && (
                    <Alert variant="destructive" className="w-full max-w-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert className="w-full max-w-sm border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">{success}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Contact Tab - Only for contractors viewing their own profile */}
        {!getUserId() && (
          <>
            <TabsContent value="signatures">
                <Card className="mt-4">
                    <CardContent className="p-4">
                        {user && <ReviewDocumentsTab user={user} />}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="documents">
                <Card className="mt-4">
                    <CardContent className="p-4">
                        {user && <ContractorDocumentsTab contractor={user} />}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="emergency">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Emergency Contact Information</CardTitle>
                  <CardDescription>Please provide emergency contact details.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="emergencyContactName">Contact Full Name</Label>
                        <Input 
                          id="emergencyContactName" 
                          value={formData.emergencyContactName} 
                          onChange={handleInputChange} 
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                        <Input 
                          id="emergencyContactPhone" 
                          type="tel" 
                          value={formData.emergencyContactPhone} 
                          onChange={handleInputChange} 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="emergencyContactEmail">Contact Email</Label>
                        <Input 
                          id="emergencyContactEmail" 
                          type="email" 
                          value={formData.emergencyContactEmail} 
                          onChange={handleInputChange} 
                        />
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex justify-end gap-4 items-center">
                      {error && (
                        <Alert variant="destructive" className="w-full max-w-sm">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      {success && (
                        <Alert className="w-full max-w-sm border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">{success}</AlertDescription>
                        </Alert>
                      )}
                      <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Emergency Contact
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}

        {/* Admin-only tabs */}
        {getUserId() && (
          <>
            <TabsContent value="activity">
               <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Activity & QC History</CardTitle>
                  <CardDescription>Recent performance and quality control interactions.</CardDescription>
                </CardHeader>
                <CardContent>
                    {user && <ActivityHistoryTab key={activityKey} userId={user.id} />}
                    {getUserId() && ( 
                      <div className="mt-4 flex gap-2">
                        <Button onClick={() => setShowCallLogDialog(true)}>Log Call</Button>
                        <Button onClick={() => setShowInspectionDialog(true)}>Record QC Inspection</Button>
                      </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              {user && getUserId() && (
                <PerformanceAdjustmentsTab 
                  contractor={user} 
                  onUpdate={() => loadUser(getUserId() || currentUser?.id, currentUser)}
                />
              )}
            </TabsContent>

            <TabsContent value="velo_feedback">
                {user && getUserId() && <VeloFeedbackTab technicianId={user.id} />}
            </TabsContent>

            <TabsContent value="signatures">
                <Card className="mt-4">
                    <CardContent className="p-4">
                        {user && <ReviewDocumentsTab user={user} />}
                    </CardContent>
                </Card>
            </TabsContent>

            {canViewDocuments && (
                <TabsContent value="documents">
                    <Card className="mt-4">
                        <CardContent className="p-4">
                            {user && <ContractorDocumentsTab contractor={user} />}
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
            
            <TabsContent value="settings">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Admin Settings</CardTitle>
                  <CardDescription>Manage administrative settings for this contractor.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">Additional admin settings will be available here.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      {user && showCallLogDialog && (
        <CallLogDialog 
          isOpen={showCallLogDialog} 
          onClose={() => setShowCallLogDialog(false)} 
          technician={user}
          onSuccess={handleDialogSuccess}
        />
      )}

      {user && showInspectionDialog && (
        <QCInspectionDialog 
          isOpen={showInspectionDialog} 
          onClose={() => setShowInspectionDialog(false)} 
          technician={user}
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  );
}