"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  DollarSign,
  AlertOctagon,
  Zap,
  Home,
  Filter,
  Plus,
  Edit,
  X,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaintenanceRequest, MaintenanceRequestStatus } from '@/types/maintenance';
import type { Room, CleaningStatus, OccupancyStatus } from '@/types/room';
import type { FirestoreUser } from '@/types/firestoreUser';
import { formatDistanceToNow, format } from 'date-fns';

interface MaintenanceWithRoom extends MaintenanceRequest {
  room?: Room;
  assignedToName?: string;
  estimatedCost?: number;
  actualCost?: number;
  laborHours?: number;
  resolutionNotes?: string;
}

const maintenanceCategories = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Furniture',
  'Appliances',
  'Flooring',
  'Walls',
  'Windows',
  'Doors',
  'Linen',
  'Other',
];

export default function MaintenanceEngineeringPage() {
  const { user, isLoadingAuth } = useAuth();

  // State
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceWithRoom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<FirestoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MaintenanceRequestStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal
  const [selectedIssue, setSelectedIssue] = useState<MaintenanceWithRoom | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit form
  const [editStatus, setEditStatus] = useState<MaintenanceRequestStatus>('Pending');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('unassigned');
  const [editNotes, setEditNotes] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editLaborHours, setEditLaborHours] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const canManage = user?.permissions?.housekeeping;

  // Get property ID
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  // Fetch maintenance requests
  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const requestsQuery = query(
      collection(db, 'maintenanceRequests'),
      where('propertyId', '==', propertyId),
      orderBy('createdAt', 'desc')
    );

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const requests = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as MaintenanceWithRoom));
      setMaintenanceRequests(requests);
      setIsLoading(false);
    });

    return () => unsubRequests();
  }, [propertyId]);

  // Fetch rooms
  useEffect(() => {
    if (!propertyId) return;

    const roomsQuery = query(collection(db, 'rooms'), where('propertyId', '==', propertyId));

    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      setRooms(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Room)));
    });

    return () => unsubRooms();
  }, [propertyId]);

  // Fetch staff
  useEffect(() => {
    if (!propertyId) return;

    const staffQuery = query(collection(db, 'staff'), where('propertyId', '==', propertyId));

    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      setStaff(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreUser)));
    });

    return () => unsubStaff();
  }, [propertyId]);

  // Enrich maintenance requests with room data
  const enrichedRequests = useMemo(() => {
    return maintenanceRequests.map((req) => {
      const room = rooms.find((r) => r.id === req.roomId);
      const assignedStaff = staff.find((s) => s.id === req.assignedTo);
      return {
        ...req,
        room,
        assignedToName: assignedStaff?.name,
      };
    });
  }, [maintenanceRequests, rooms, staff]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return enrichedRequests.filter((req) => {
      // Search
      if (searchQuery && !req.roomName.includes(searchQuery) && !req.issue.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;

      // Priority filter (inferred from status)
      if (priorityFilter !== 'all') {
        const isOrgent = req.status === 'Pending';
        if (priorityFilter === 'urgent' && !isOrgent) return false;
        if (priorityFilter === 'normal' && isOrgent) return false;
      }

      // Category filter (inferred from issue)
      if (categoryFilter !== 'all') {
        const hasCategory = maintenanceCategories.some(
          (cat) => cat.toLowerCase() === categoryFilter && req.issue.toLowerCase().includes(cat.toLowerCase())
        );
        if (!hasCategory) return false;
      }

      return true;
    });
  }, [enrichedRequests, searchQuery, statusFilter, priorityFilter, categoryFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const pending = enrichedRequests.filter((r) => r.status === 'Pending').length;
    const inProgress = enrichedRequests.filter((r) => r.status === 'In Progress').length;
    const resolved = enrichedRequests.filter((r) => r.status === 'Resolved').length;
    const oooRooms = rooms.filter((r) => r.cleaningStatus === 'out_of_order').length;

    const totalCost = enrichedRequests.reduce((sum, r) => sum + (r.actualCost || 0), 0);

    return { pending, inProgress, resolved, oooRooms, totalCost };
  }, [enrichedRequests, rooms]);

  const handleOpenEdit = (issue: MaintenanceWithRoom) => {
    setSelectedIssue(issue);
    setEditStatus(issue.status);
    setEditAssignedTo(issue.assignedTo || 'unassigned');
    setEditNotes(issue.resolutionNotes || '');
    setEditCost((issue.actualCost || '').toString());
    setEditLaborHours((issue.laborHours || '').toString());
    setIsEditModalOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedIssue) return;

    setIsUpdating(true);
    try {
      const updateData: any = {
        status: editStatus,
        resolutionNotes: editNotes,
      };

      // Handle assignedTo - convert 'unassigned' to empty string for unassigned maintenance requests
      if (editAssignedTo === 'unassigned') {
        updateData.assignedTo = '';
      } else if (editAssignedTo) {
        updateData.assignedTo = editAssignedTo;
      }

      if (editCost) {
        updateData.actualCost = parseFloat(editCost);
      }

      if (editLaborHours) {
        updateData.laborHours = parseFloat(editLaborHours);
      }

      if (editStatus === 'Resolved' && !selectedIssue.resolvedAt) {
        updateData.resolvedAt = Timestamp.now();
      }

      await updateDoc(doc(db, 'maintenanceRequests', selectedIssue.id), updateData);

      // If resolved, update room cleaning status to dirty (staff needs to clean if it was marked OOO due to maintenance)
      if (editStatus === 'Resolved' && selectedIssue.room?.cleaningStatus === 'out_of_order') {
        await updateDoc(doc(db, 'rooms', selectedIssue.roomId), {
          cleaningStatus: 'dirty' as CleaningStatus,
          lastStatusUpdate: Timestamp.now(),
        });
      }

      toast({ title: 'Success', description: 'Maintenance request updated' });
      setIsEditModalOpen(false);
      setSelectedIssue(null);
    } catch (error) {
      console.error('Error updating request:', error);
      toast({ title: 'Error', description: 'Failed to update request', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: MaintenanceRequestStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <Badge className="gap-1 bg-red-600">
            <AlertCircle size={12} />
            Pending
          </Badge>
        );
      case 'In Progress':
        return (
          <Badge className="gap-1 bg-blue-600">
            <Zap size={12} />
            In Progress
          </Badge>
        );
      case 'Resolved':
        return (
          <Badge className="gap-1 bg-green-600">
            <CheckCircle2 size={12} />
            Resolved
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDuration = (createdAt: Timestamp, resolvedAt?: Timestamp) => {
    const created = createdAt.toDate();
    const resolved = resolvedAt ? resolvedAt.toDate() : new Date();
    const hours = Math.round((resolved.getTime() - created.getTime()) / (1000 * 60 * 60));
    return hours > 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`;
  };

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Spinner className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>You do not have permission to access maintenance management.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Maintenance & Engineering</h1>
          <p className="text-slate-600 mt-2">Track and manage property maintenance issues</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.pending}</h3>
            </div>
            <div className="p-2 rounded-lg bg-red-50">
              <AlertCircle size={18} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.inProgress}</h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <Zap size={18} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resolved</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.resolved}</h3>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Out of Order</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">{kpis.oooRooms}</h3>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <AlertOctagon size={18} className="text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500 transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Cost</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-800">${kpis.totalCost.toFixed(0)}</h3>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <DollarSign size={18} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-4 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search room or issue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MaintenanceRequestStatus | 'all')}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent (Pending)</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {maintenanceCategories.map((cat) => (
                <SelectItem key={cat} value={cat.toLowerCase()}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <Wrench className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No issues found</h3>
            <p className="text-slate-600">Adjust your filters to find issues</p>
          </div>
        ) : (
          filteredRequests.map((issue) => (
            <div
              key={issue.id}
              className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-slate-900">{issue.roomName}</span>
                      {getStatusBadge(issue.status)}
                      {issue.status === 'Pending' && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle size={12} />
                          URGENT
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{issue.issue}</p>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {format(issue.createdAt.toDate(), 'MMM dd, yyyy')}
                      </div>
                      {issue.assignedToName && (
                        <div className="flex items-center gap-1">
                          <Wrench size={14} />
                          {issue.assignedToName}
                        </div>
                      )}
                      {issue.status === 'Resolved' && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Clock size={14} />
                          {formatDuration(issue.createdAt, issue.resolvedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleOpenEdit(issue)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Edit size={16} />
                    Edit
                  </Button>
                </div>

                {/* Additional Info Row */}
                <div className="flex items-center gap-4 pt-3 border-t border-slate-200 text-sm">
                  {issue.actualCost && (
                    <div className="flex items-center gap-1 text-slate-700 font-medium">
                      <DollarSign size={14} />
                      ${issue.actualCost.toFixed(2)}
                    </div>
                  )}
                  {issue.laborHours && (
                    <div className="flex items-center gap-1 text-slate-700 font-medium">
                      <Clock size={14} />
                      {issue.laborHours}h labor
                    </div>
                  )}
                  {issue.resolutionNotes && (
                    <div className="text-slate-600 italic">
                      {issue.resolutionNotes.substring(0, 50)}...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Request - {selectedIssue?.roomName}</DialogTitle>
            <DialogDescription>{selectedIssue?.issue}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* Issue Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as MaintenanceRequestStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Actual Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  placeholder="0.00"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="laborHours">Labor Hours</Label>
                <Input
                  id="laborHours"
                  type="number"
                  placeholder="0"
                  value={editLaborHours}
                  onChange={(e) => setEditLaborHours(e.target.value)}
                  step="0.5"
                />
              </div>
            </div>

            {/* Resolution Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Resolution Notes</Label>
              <Textarea
                id="notes"
                placeholder="Document what was done to resolve this issue..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
              <p><strong>Created:</strong> {format(selectedIssue?.createdAt.toDate() || new Date(), 'MMM dd, yyyy HH:mm')}</p>
              {selectedIssue?.resolvedAt && (
                <p><strong>Resolved:</strong> {format(selectedIssue.resolvedAt.toDate(), 'MMM dd, yyyy HH:mm')}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUpdating ? (
                <>
                  <Icons.Spinner className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
