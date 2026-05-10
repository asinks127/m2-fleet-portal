import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { exportTechRoster } from '@/functions.js';
import { User } from '@/api/entities.js';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import {
  Users,
  Search,
  PlusCircle,
  AlertCircle,
  Loader2,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  UserPlus,
  UserCheck,
  Download,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Shield,
  FileText,
  Clock,
  ClipboardList,
  HardDriveUpload
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import ExpandedContractorRow from '../components/roster/ExpandedContractorRow';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

// Custom hook for debounced value
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function TechRoster() {
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role: 'contractor',
    project: 'M2',
    m2PM: '',
    veloPM: '',
    active: true
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Get initial state from URL params
  const getInitialFilters = useCallback(() => {
    const params = new URLSearchParams(location.search);
    return {
      searchTerm: params.get('search') || '',
      statusFilter: params.get('status') || 'active',
      projectFilter: params.get('project') || 'all',
      m2PmFilter: params.get('m2pm') || 'all',
      veloPmFilter: params.get('velopm') || 'all',
      sortConfig: params.get('sort') || 'name_asc',
      showAdmins: params.get('admins') === 'true',
      smartFilter: params.get('smartFilter') || 'all'
    };
  }, [location.search]);

  const initialFilters = useMemo(() => getInitialFilters(), [getInitialFilters]);
  
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm);
  const [statusFilter, setStatusFilter] = useState(initialFilters.statusFilter);
  const [projectFilter, setProjectFilter] = useState(initialFilters.projectFilter);
  const [m2PmFilter, setM2PmFilter] = useState(initialFilters.m2PmFilter);
  const [veloPmFilter, setVeloPmFilter] = useState(initialFilters.veloPmFilter);
  const [sortConfig, setSortConfig] = useState(initialFilters.sortConfig);
  const [showAdmins, setShowAdmins] = useState(initialFilters.showAdmins);
  const [smartFilter, setSmartFilter] = useState(initialFilters.smartFilter);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [selectedTechForDeactivation, setSelectedTechForDeactivation] = useState(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingDocuments, setIsSyncingDocuments] = useState(false);

  // Debounce the search term - only filter after user stops typing for 300ms
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Update URL when filters change
  const updateURL = useCallback((newFilters) => {
    const params = new URLSearchParams();

    if (newFilters.searchTerm) params.set('search', newFilters.searchTerm);
    if (newFilters.statusFilter !== 'active') params.set('status', newFilters.statusFilter);
    if (newFilters.projectFilter !== 'all') params.set('project', newFilters.projectFilter);
    if (newFilters.m2PmFilter !== 'all') params.set('m2pm', newFilters.m2PmFilter);
    if (newFilters.veloPmFilter !== 'all') params.set('velopm', newFilters.veloPmFilter);
    if (newFilters.sortConfig !== 'name_asc') params.set('sort', newFilters.sortConfig);
    if (newFilters.showAdmins) params.set('admins', 'true');
    if (newFilters.smartFilter !== 'all') params.set('smartFilter', newFilters.smartFilter);

    const newURL = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    navigate(newURL, { replace: true });
  }, [location.pathname, navigate]);

  const calculateTenure = (startDate) => {
    if (!startDate) return 'N/A';
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = now - start;
    if (diffTime < 0) return 'Not Started'; // Future date
    
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    
    if (years > 0) return `${years}y ${months}m`;
    if (months > 0) return `${months}m`;
    return `${diffDays}d`;
  };

  // Helper function to update both state and URL
  const updateFilters = useCallback((updates) => {
    const newFilters = {
      searchTerm,
      statusFilter,
      projectFilter,
      m2PmFilter,
      veloPmFilter,
      sortConfig,
      showAdmins,
      smartFilter,
      ...updates
    };

    if (updates.searchTerm !== undefined) setSearchTerm(updates.searchTerm);
    if (updates.statusFilter !== undefined) setStatusFilter(updates.statusFilter);
    if (updates.projectFilter !== undefined) setProjectFilter(updates.projectFilter);
    if (updates.m2PmFilter !== undefined) setM2PmFilter(updates.m2PmFilter);
    if (updates.veloPmFilter !== undefined) setVeloPmFilter(updates.veloPmFilter);
    if (updates.sortConfig !== undefined) setSortConfig(updates.sortConfig);
    if (updates.showAdmins !== undefined) setShowAdmins(updates.showAdmins);
    if (updates.smartFilter !== undefined) setSmartFilter(updates.smartFilter);

    updateURL(newFilters);
    setExpandedRows(new Set()); // Collapse all rows on filter change
  }, [searchTerm, statusFilter, projectFilter, m2PmFilter, veloPmFilter, sortConfig, showAdmins, smartFilter, updateURL]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allUsers = await User.list();
      setUsers(allUsers || []);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load the tech roster.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedTechForDeactivation || !deactivationReason.trim()) {
      setError('Please provide a reason for deactivation.');
      return;
    }

    setIsDeactivating(true);
    setError(null);

    try {
      await User.update(selectedTechForDeactivation.id, {
        active: false,
        inactiveDate: new Date().toISOString(),
        inactiveReason: deactivationReason.trim()
      });

      setShowDeactivateDialog(false);
      setSelectedTechForDeactivation(null);
      setDeactivationReason('');
      loadUsers();
    } catch (err) {
      console.error('Error deactivating tech:', err);
      setError('Failed to deactivate technician.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const response = await exportTechRoster();
      
      if (response.status === 200) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tech-roster-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        throw new Error('Failed to export roster data');
      }
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export roster data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSyncDocumentsToDrive = async () => {
    setIsSyncingDocuments(true);
    try {
      toast.info("Initiating document sync to Google Drive. This may take a moment.");
      const response = await /* FIXME: Unconverted base44 call */ supabase.functions.invoke('syncContractorDocumentsToDrive');
      if (response && response.data && response.data.success) {
        toast.success(`Document sync completed. Processed ${response.data.count} documents.`);
      } else {
        toast.error("Document sync finished with potential issues.");
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error("An error occurred during document sync.");
    } finally {
      setIsSyncingDocuments(false);
    }
  };

  const handleCreateUser = async () => {
    const email = newUser.email.trim().toLowerCase();
    const fullName = newUser.full_name.trim();
    if (!email || !fullName) {
      setError('Email and full name are required.');
      return;
    }

    setIsCreatingUser(true);
    setError(null);
    try {
      const displayName = fullName;
      const role = newUser.role;
      const payload = {
        email,
        full_name: fullName,
        displayName,
        active: true,
        project: newUser.project || 'M2',
        m2PM: newUser.m2PM || null,
        veloPM: newUser.veloPM || null,
        user_metadata: { role }
      };
      await User.create(payload);
      setIsAddUserDialogOpen(false);
      setNewUser({
        email: '',
        full_name: '',
        role: 'contractor',
        project: 'M2',
        m2PM: '',
        veloPM: '',
        active: true
      });
      await loadUsers();
      toast.success('User added successfully.');
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err?.message || 'Failed to create user.');
      toast.error('Failed to add user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Function to toggle row expansion
  const toggleRowExpansion = (userId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const projectOptions = useMemo(() => {
    try {
      if (!Array.isArray(users)) return ['all'];
      const projectList = users
        .map(u => u && u.project ? String(u.project) : null)
        .filter(p => p && p.trim() !== '');
      return ['all', ...Array.from(new Set(projectList)).sort()];
    } catch (err) {
      return ['all'];
    }
  }, [users]);

  const m2PmOptions = useMemo(() => {
    try {
      if (!Array.isArray(users)) return ['all'];
      const pmList = users
        .map(u => u && u.m2PM ? String(u.m2PM) : null)
        .filter(p => p && p.trim() !== '');
      return ['all', ...Array.from(new Set(pmList)).sort()];
    } catch (err) {
      return ['all'];
    }
  }, [users]);

  const veloPmOptions = useMemo(() => {
    try {
      if (!Array.isArray(users)) return ['all'];
      const pmList = users
        .map(u => u && u.veloPM ? String(u.veloPM) : null)
        .filter(p => p && p.trim() !== '');
      return ['all', ...Array.from(new Set(pmList)).sort()];
    } catch (err) {
      return ['all'];
    }
  }, [users]);

  // Use debounced search term for filtering
  const filteredUsers = useMemo(() => {
    const adminEmailsList = [
      'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
      'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com',
      'rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com'
    ];

    let currentFilteredUsers = Array.isArray(users) ? users.filter(user => {
      if (!user || !user.id) return false;
      const email = String(user.email || '').toLowerCase();
      const isContractor = email.includes('.contractor@m2fleetcom.com') || email.includes('.contractor@smcinstallations.com') || email === 'tjserota@gmail.com';
      const isAdminUser = adminEmailsList.includes(email);
      // Only include users who are contractors OR recognized admins.
      // Further filtering for showAdmins will happen later.
      return isContractor || isAdminUser;
    }) : [];

    // Filter by status
    if (statusFilter !== 'all') {
      currentFilteredUsers = currentFilteredUsers.filter(u => {
        const isActive = u.data?.active ?? u.active ?? true;
        return isActive === (statusFilter === 'active');
      });
    }

    // Filter by project
    if (projectFilter !== 'all') {
      currentFilteredUsers = currentFilteredUsers.filter(u => String(u.project || '') === projectFilter);
    }
    
    // Filter by M2 PM
    if (m2PmFilter !== 'all') {
      currentFilteredUsers = currentFilteredUsers.filter(u => String(u.m2PM || '') === m2PmFilter);
    }

    // Filter by Velo PM
    if (veloPmFilter !== 'all') {
      currentFilteredUsers = currentFilteredUsers.filter(u => String(u.veloPM || '') === veloPmFilter);
    }
    
    // Filter by search term
    if (debouncedSearchTerm) {
      const lowercasedTerm = debouncedSearchTerm.toLowerCase();
      currentFilteredUsers = currentFilteredUsers.filter(user =>
        (user.display_name?.toLowerCase() || '').includes(lowercasedTerm) ||
        (user.full_name?.toLowerCase() || '').includes(lowercasedTerm) ||
        (user.project?.toLowerCase() || '').includes(lowercasedTerm) ||
        (user.email?.toLowerCase() || '').includes(lowercasedTerm)
      );
    }

    // Smart Filters
    if (smartFilter !== 'all') {
      const today = new Date();
      currentFilteredUsers = currentFilteredUsers.filter(user => {
        switch (smartFilter) {
          case 'at_risk':
            return (Number(user.velocitiScore) < 80) || (Number(user.avgQcScore) < 85);
          case 'missing_invoice':
            return !user.lastInvoiceDate;
          case 'expiring_docs':
            if (user.endDate) {
              const endDate = new Date(user.endDate || user.shadowingEndDate || user.updated_at || user.created_at);
              const daysUntilExpiry = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
              return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
            }
            return false;
          case 'low_performance':
            return (Number(user.velocitiScore) < 70) || (Number(user.avgQcScore) < 75);
          case 'shadowing':
            return user.shadowingStatus === 'in_progress';
          case 'new_hires':
            if (user.startDate) {
              const startDate = new Date(user.startDate);
              const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
              return daysSinceStart >= 0 && daysSinceStart <= 30;
            }
            return false;
          case 'missing_compliance':
              // Assuming a boolean field `hasComplianceDocs` or similar, or checking for specific missing documents
              // For now, let's assume `user.isMissingCompliance` is a property
              return user.isMissingCompliance === true;
          case 'needs_review':
              // Assuming a boolean field `needsInvoiceReview` is available on the user object
              return user.needsInvoiceReview === true;
          default:
            return true;
        }
      });
    }

    // Hide admins unless explicitly shown
    if (!showAdmins) {
      currentFilteredUsers = currentFilteredUsers.filter(u => !adminEmailsList.includes(u.email?.toLowerCase()));
    }

    // Sort the users
    const [key, direction] = sortConfig.split('_');
    const sortedUsers = [...currentFilteredUsers].sort((a, b) => {
      let valA, valB;

      if (key === 'name') {
        valA = a.displayName || a.full_name || a.email || '';
        valB = b.displayName || b.full_name || b.email || '';
      } else if (key === 'endDate') {
        valA = a.endDate ? new Date(a.endDate || a.shadowingEndDate || a.updated_at || a.created_at).getTime() : 0;
        valB = b.endDate ? new Date(b.endDate || b.shadowingEndDate || b.updated_at || b.created_at).getTime() : 0;
      } else if (key === 'startDate') {
        valA = a.startDate ? new Date(a.startDate).getTime() : 0;
        valB = b.startDate ? new Date(b.startDate).getTime() : 0;
      } else {
        valA = a[key] || '';
        valB = b[key] || '';
      }

      let comparison = 0;
      if (key === 'endDate' || key === 'startDate') {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return sortedUsers;

  }, [users, debouncedSearchTerm, statusFilter, projectFilter, m2PmFilter, veloPmFilter, sortConfig, showAdmins, smartFilter]);

  const StatusBadge = ({ isActive }) => {
    const active = isActive !== false;
    return (
      <Badge variant={active ? 'default' : 'secondary'} className={active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
        {active ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  const ShadowingBadge = ({ user }) => {
    const status = user.shadowingStatus || 'not_started';

    if (status === 'not_started') return null;

    const colors = {
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[status]}>
        {status === 'in_progress' ? 'Shadowing' :
         status === 'completed' ? 'Shadowing Complete' : 'Shadowing Failed'}
      </Badge>
    );
  };

  const startShadowing = async (userId) => {
    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 14);

      await User.update(userId, {
        shadowingStatus: 'in_progress',
        shadowingStartDate: today.toISOString().split('T')[0],
        shadowingEndDate: endDate.toISOString().split('T')[0]
      });

      loadUsers();
    } catch (error) {
      console.error('Error starting shadowing:', error);
    }
  };

  const ScoreBadge = ({ score, type }) => {
    const numScore = Number(score) || 0;
    let color = 'bg-gray-100 text-gray-800';
    if (type === 'velociti') {
      if (numScore >= 90) color = 'bg-green-100 text-green-800';
      else if (numScore >= 70) color = 'bg-yellow-100 text-yellow-800';
      else color = 'bg-red-100 text-red-800';
    }
    return <Badge className={color}>{numScore}</Badge>;
  };

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>{error}</p>
          <Button onClick={loadUsers} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8" />
            <span>Tech Roster</span>
          </h1>
          <p className="text-gray-600 mt-1">View and manage all contractor profiles and performance metrics. Click any row to see details.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
            <Link to={createPageUrl('ShadowingDashboard')}>
                <Button variant="outline">
                  <UserCheck className="w-4 h-4 mr-2" />
                  View Shadowing Dashboard
                </Button>
            </Link>
            <Link to={createPageUrl('BulkInvite')}>
                <Button variant="outline">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Bulk Invite Techs
                </Button>
            </Link>
            <Button
              variant="outline"
              onClick={handleSyncDocumentsToDrive}
              disabled={isSyncingDocuments}
            >
              {isSyncingDocuments ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <HardDriveUpload className="w-4 h-4 mr-2" />
                  Sync Docs to Drive
                </>
              )}
            </Button>
            <Button onClick={() => setIsAddUserDialogOpen(true)}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Add New Tech
            </Button>
        </div>
      </div>

      {/* Smart Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={smartFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'all' })}
        >
          All Contractors
        </Button>
        <Button
          variant={smartFilter === 'at_risk' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'at_risk' })}
          className={smartFilter === 'at_risk' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'border-orange-200 text-orange-700 hover:bg-orange-50'}
        >
          <AlertCircle className="w-4 h-4 mr-1" />
          At Risk
        </Button>
        <Button
          variant={smartFilter === 'missing_invoice' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'missing_invoice' })}
          className={smartFilter === 'missing_invoice' ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-red-200 text-red-700 hover:bg-red-50'}
        >
          <FileText className="w-4 h-4 mr-1" />
          Missing Invoice
        </Button>
        <Button
          variant={smartFilter === 'expiring_docs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'expiring_docs' })}
          className={smartFilter === 'expiring_docs' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50'}
        >
          <Clock className="w-4 h-4 mr-1" />
          Expiring Soon
        </Button>
        <Button
          variant={smartFilter === 'low_performance' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'low_performance' })}
          className={smartFilter === 'low_performance' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-purple-200 text-purple-700 hover:bg-purple-50'}
        >
          <TrendingUp className="w-4 h-4 mr-1" />
          Low Performance
        </Button>
        <Button
          variant={smartFilter === 'shadowing' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'shadowing' })}
          className={smartFilter === 'shadowing' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}
        >
          <UserCheck className="w-4 h-4 mr-1" />
          Shadowing
        </Button>
        <Button
          variant={smartFilter === 'new_hires' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'new_hires' })}
          className={smartFilter === 'new_hires' ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-green-200 text-green-700 hover:bg-green-50'}
        >
          <Users className="w-4 h-4 mr-1" />
          New Hires (30d)
        </Button>
        <Button
          variant={smartFilter === 'missing_compliance' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'missing_compliance' })}
          className={smartFilter === 'missing_compliance' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}
        >
          <Shield className="w-4 h-4 mr-1" />
          Missing Compliance
        </Button>
        <Button
          variant={smartFilter === 'needs_review' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilters({ smartFilter: 'needs_review' })}
          className={smartFilter === 'needs_review' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'border-rose-200 text-rose-700 hover:bg-rose-50'}
        >
          <ClipboardList className="w-4 h-4 mr-1" />
          Needs Review
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex flex-col lg:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search by name, email, or business..."
            value={searchTerm}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
            className="pl-9"
          />
          {searchTerm !== debouncedSearchTerm && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={statusFilter} onValueChange={(value) => updateFilters({ statusFilter: value })}>
            <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={projectFilter} onValueChange={(value) => updateFilters({ projectFilter: value })}>
            <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
            <SelectContent>
              {projectOptions.map(project => (
                <SelectItem key={project} value={project}>
                  {project === 'all' ? 'All Projects' : project}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={m2PmFilter} onValueChange={(value) => updateFilters({ m2PmFilter: value })}>
            <SelectTrigger><SelectValue placeholder="Filter by M2 PM" /></SelectTrigger>
            <SelectContent>
              {m2PmOptions.map(pm => (
                <SelectItem key={pm} value={pm}>
                  {pm === 'all' ? 'All M2 PMs' : pm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={veloPmFilter} onValueChange={(value) => updateFilters({ veloPmFilter: value })}>
            <SelectTrigger><SelectValue placeholder="Filter by Velo PM" /></SelectTrigger>
            <SelectContent>
              {veloPmOptions.map(pm => (
                <SelectItem key={pm} value={pm}>
                  {pm === 'all' ? 'All Velo PMs' : pm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={sortConfig} onValueChange={(value) => updateFilters({ sortConfig: value })}>
            <SelectTrigger><SelectValue placeholder="Sort by..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="startDate_desc">Start Date (Newest)</SelectItem>
              <SelectItem value="startDate_asc">Start Date (Oldest)</SelectItem>
              <SelectItem value="endDate_desc">End Date (Newest)</SelectItem>
              <SelectItem value="endDate_asc">End Date (Oldest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto">
          <Button
            variant={showAdmins ? "default" : "outline"}
            onClick={() => updateFilters({ showAdmins: !showAdmins })}
            className="w-full lg:w-auto"
          >
            {showAdmins ? "Hide" : "Show"} Admin Users
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
            <p className="mt-2 text-gray-600">Loading roster...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Business</TableHead> {/* New column */}
                  <TableHead>Project</TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead>Contract End</TableHead>
                  <TableHead>Weekly Pay</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? filteredUsers.map(user => {
                  if (!user || !user.id) return null;
                  const isExpanded = expandedRows.has(user.id);
                  
                  return (
                    <React.Fragment key={user.id}>
                      <TableRow className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRowExpansion(user.id)}>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>
                            <Link
                                to={`${createPageUrl('ContractorProfile')}?id=${user.id}&returnTo=${encodeURIComponent(location.pathname + location.search)}`}
                                className="font-medium text-gray-900 hover:underline"
                            >
                                {user.full_name || user.display_name || user.email || user.email || 'No Name'}
                            </Link>
                            <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {user.phone || ''}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {user.location || user.business || 'N/A'}
                              </div>
                            </div>
                        </TableCell>
                        <TableCell>{user.project || 'N/A'}</TableCell> {/* New cell */}
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.project || 'N/A'}</div>
                            <div className="text-sm text-gray-500">M2 PM: {user.m2PM || 'N/A'}</div>
                            <div className="text-sm text-gray-500">Velo PM: {user.veloPM || 'N/A'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {calculateTenure(user.startDate)}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {user.startDate ? new Date(user.startDate).toLocaleDateString() : (user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {user.endDate ? new Date(user.endDate).toLocaleDateString() : (user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.endDate && (new Date(user.endDate || user.shadowingEndDate || user.updated_at || user.created_at) < new Date()) ? 'Contract Ended' : 'Contract Active'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {user.weeklyPay ? `$${user.weeklyPay}` : 'N/A'}
                            </div>
                            <div className="text-sm text-gray-500">
                              Weekly Target
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Velociti:</span>
                              <ScoreBadge score={user.velocitiScore || 0} type="velociti" />
                            </div>
                            <div className="text-xs text-gray-500">
                              QC Avg: {user.avgQcScore || 0}
                            </div>
                            <div className="text-xs text-gray-500">
                              Velo Survey: {user.veloSurveyFeedback || 'Not rated'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <StatusBadge isActive={user.active} />
                            <ShadowingBadge user={user} />
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <Link to={createPageUrl(`ContractorProfile?id=${user.id}`)}>
                                <Button variant="outline" size="sm">
                                  Edit Profile
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTechForDeactivation(user);
                                  setShowDeactivateDialog(true);
                                }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                Deactivate
                              </Button>
                            </div>
                            {(!user.shadowingStatus || user.shadowingStatus === 'not_started') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startShadowing(user.id)}
                                className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                              >
                                <UserCheck className="w-3 h-3 mr-1" />
                                Start Shadowing
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-gray-50 p-0"> {/* colSpan adjusted to 9 */}
                            <ExpandedContractorRow user={user} onUpdate={loadUsers} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24 text-gray-500"> {/* colSpan adjusted to 9 */}
                      No contractors found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new portal user record. You can set contractor, PM, QC, or admin role now.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                placeholder="name@company.com"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="new-user-fullname">Full Name</Label>
              <Input
                id="new-user-fullname"
                placeholder="Full name"
                value={newUser.full_name}
                onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="pm">Project Manager</SelectItem>
                    <SelectItem value="qc">QC</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project</Label>
                <Select value={newUser.project} onValueChange={(value) => setNewUser(prev => ({ ...prev, project: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M2">M2</SelectItem>
                    <SelectItem value="SMC">SMC</SelectItem>
                    <SelectItem value="VELOCITI">VELOCITI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-user-m2pm">M2 PM</Label>
                <Input
                  id="new-user-m2pm"
                  placeholder="Optional"
                  value={newUser.m2PM}
                  onChange={(e) => setNewUser(prev => ({ ...prev, m2PM: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="new-user-velopm">Velo PM</Label>
                <Input
                  id="new-user-velopm"
                  placeholder="Optional"
                  value={newUser.veloPM}
                  onChange={(e) => setNewUser(prev => ({ ...prev, veloPM: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)} disabled={isCreatingUser}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={isCreatingUser}>
              {isCreatingUser ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              You are about to deactivate <strong>{selectedTechForDeactivation?.displayName || selectedTechForDeactivation?.full_name}</strong>.
              They will be moved to the inactive technicians list.
            </p>
            <div>
              <Label htmlFor="deactivationReason">Reason for Deactivation *</Label>
              <Textarea
                id="deactivationReason"
                placeholder="Please provide a reason for deactivating this technician..."
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeactivateDialog(false);
                setSelectedTechForDeactivation(null);
                setDeactivationReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={isDeactivating || !deactivationReason.trim()}
              variant="destructive"
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deactivating...
                </>
              ) : (
                'Deactivate Technician'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}