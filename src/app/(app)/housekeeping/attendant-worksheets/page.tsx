"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Zap,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Camera,
  Flag,
  Home,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Room, CleaningStatus, OccupancyStatus } from '@/types/room';
import type { RoomType } from '@/types/roomType';
import type { Reservation } from '@/types/reservation';
import type { FirestoreUser } from '@/types/firestoreUser';

interface AssignedTask {
  id: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  status: 'assigned' | 'in-progress' | 'completed' | 'inspected';
  priority: 'normal' | 'high' | 'urgent';
  estimatedTime: number; // minutes
  actualStartTime?: Timestamp;
  actualEndTime?: Timestamp;
  checklist: ChecklistItem[];
  completedChecks: string[];
  notes?: string;
  assignedTo: string;
  assignedAt: Timestamp;
  reservation?: Reservation;
  roomStatus?: RoomStatus;
}

interface ChecklistItem {
  id: string;
  task: string;
  category: string;
}

export default function AttendantWorksheetsPage() {
  const { user, isLoadingAuth } = useAuth();

  // State
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<AssignedTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<AssignedTask[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimingTask, setIsClaimingTask] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Current task tracking
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Modals
  const [selectedTask, setSelectedTask] = useState<AssignedTask | null>(null);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Expanded tasks
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const canWork = user?.permissions?.housekeeping;

  // Get property ID
  useEffect(() => {
    if (user?.propertyId) {
      setPropertyId(user.propertyId);
    }
  }, [user]);

  // Fetch assigned tasks for current user
  useEffect(() => {
    if (!propertyId || !user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Query 1: User's assigned tasks
    const assignedTasksQuery = query(
      collection(db, 'housekeepingTasks'),
      where('propertyId', '==', propertyId),
      where('assignedTo', '==', user.id),
      where('status', 'in', ['assigned', 'in-progress'])
    );

    const unsubAssigned = onSnapshot(assignedTasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          assignedAt: data.assignedAt,
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,
          checklist: data.checklist || [],
          completedChecks: data.completedChecks || [],
        } as AssignedTask;
      });
      setAssignedTasks(tasks);
    });

    // Query 2: Unassigned tasks (available to claim)
    const unassignedTasksQuery = query(
      collection(db, 'housekeepingTasks'),
      where('propertyId', '==', propertyId),
      where('assignedTo', '==', ''),
      where('status', 'in', ['assigned', 'in-progress'])
    );

    const unsubUnassigned = onSnapshot(unassignedTasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          assignedAt: data.assignedAt,
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,
          checklist: data.checklist || [],
          completedChecks: data.completedChecks || [],
        } as AssignedTask;
      });
      setUnassignedTasks(tasks);
      setIsLoading(false);
    });

    return () => {
      unsubAssigned();
      unsubUnassigned();
    };
  }, [propertyId, user?.id]);

  // Fetch completed tasks
  useEffect(() => {
    if (!propertyId || !user?.id) return;

    const completedTasksQuery = query(
      collection(db, 'housekeepingTasks'),
      where('propertyId', '==', propertyId),
      where('assignedTo', '==', user.id),
      where('status', '==', 'completed')
    );

    const unsubCompleted = onSnapshot(completedTasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          assignedAt: data.assignedAt,
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,
          checklist: data.checklist || [],
          completedChecks: data.completedChecks || [],
        } as AssignedTask;
      });
      setCompletedTasks(tasks);
    });

    return () => unsubCompleted();
  }, [propertyId, user?.id]);

  // Fetch room types
  useEffect(() => {
    if (!propertyId) return;

    const roomTypesQuery = query(collection(db, 'roomTypes'), where('propertyId', '==', propertyId));
    const unsubRoomTypes = onSnapshot(roomTypesQuery, (snapshot) => {
      setRoomTypes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RoomType)));
    });

    return () => unsubRoomTypes();
  }, [propertyId]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTimerRunning && activeTaskId) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTimerRunning, activeTaskId]);

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Get checklist for room type
  const getChecklistForRoomType = (roomTypeId: string): ChecklistItem[] => {
    const roomType = roomTypes.find((rt) => rt.id === roomTypeId);
    if (!roomType || !roomType.cleaningChecklist) {
      return [
        { id: '1', task: 'Dust surfaces', category: 'Cleaning' },
        { id: '2', task: 'Vacuum/sweep floor', category: 'Cleaning' },
        { id: '3', task: 'Clean bathroom', category: 'Bathroom' },
        { id: '4', task: 'Change linens', category: 'Linens' },
        { id: '5', task: 'Restock amenities', category: 'Amenities' },
        { id: '6', task: 'Final walkthrough', category: 'QA' },
      ];
    }
    return roomType.cleaningChecklist;
  };

  const handleStartTask = async (taskId: string) => {
    const task = assignedTasks.find((t) => t.id === taskId);
    if (!task) return;

    setActiveTaskId(taskId);
    setElapsedTime(0);
    setIsTimerRunning(true);

    try {
      // Update task status to in-progress
      await updateDoc(doc(db, 'housekeepingTasks', taskId), {
        status: 'in-progress',
        actualStartTime: Timestamp.now(),
      });

      // Update room cleaning status to in_progress
      await updateDoc(doc(db, 'rooms', task.roomId), {
        cleaningStatus: 'in_progress' as CleaningStatus,
        lastStatusUpdate: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Task started' });
    } catch (error) {
      console.error('Error starting task:', error);
      toast({ title: 'Error', description: 'Failed to start task', variant: 'destructive' });
      setActiveTaskId(null);
      setIsTimerRunning(false);
    }
  };

  const handlePauseResume = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleReset = () => {
    setElapsedTime(0);
    setIsTimerRunning(false);
  };

  const handleCompleteTask = async (task: AssignedTask) => {
    try {
      await updateDoc(doc(db, 'housekeepingTasks', task.id), {
        status: 'completed',
        actualEndTime: Timestamp.now(),
      });

      // Update room cleaning status only - never touch occupancyStatus
      await updateDoc(doc(db, 'rooms', task.roomId), {
        cleaningStatus: 'clean' as CleaningStatus,
        lastStatusUpdate: Timestamp.now(),
      });

      setActiveTaskId(null);
      setIsTimerRunning(false);
      setElapsedTime(0);
      toast({ title: 'Success', description: `Room ${task.roomNumber} marked as cleaned` });
    } catch (error) {
      console.error('Error completing task:', error);
      toast({ title: 'Error', description: 'Failed to complete task', variant: 'destructive' });
    }
  };

  const handleClaimTask = async (taskId: string) => {
    if (!user?.id) return;

    setIsClaimingTask(taskId);
    try {
      await updateDoc(doc(db, 'housekeepingTasks', taskId), {
        assignedTo: user.id,
        assignedAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Task claimed! Added to your assignments.' });
    } catch (error) {
      console.error('Error claiming task:', error);
      toast({ title: 'Error', description: 'Failed to claim task', variant: 'destructive' });
    } finally {
      setIsClaimingTask(null);
    }
  };

  const handleToggleCheckItem = async (taskId: string, itemId: string) => {
    const task = assignedTasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedChecks = task.completedChecks.includes(itemId)
      ? task.completedChecks.filter((id) => id !== itemId)
      : [...task.completedChecks, itemId];

    try {
      await updateDoc(doc(db, 'housekeepingTasks', taskId), {
        completedChecks: updatedChecks,
      });
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  const handleReportIssue = async () => {
    if (!selectedTask || !issueDescription.trim()) return;

    setIsSubmittingIssue(true);
    try {
      await addDoc(collection(db, 'maintenanceRequests'), {
        propertyId,
        roomId: selectedTask.roomId,
        roomName: selectedTask.roomNumber,
        issue: issueDescription.trim(),
        status: 'Pending',
        reportedBy: user?.id,
        reportedByName: user?.name,
        createdAt: Timestamp.now(),
      });

      toast({ title: 'Success', description: 'Issue reported to maintenance' });
      setIsIssueModalOpen(false);
      setIssueDescription('');
      setSelectedTask(null);
    } catch (error) {
      console.error('Error reporting issue:', error);
      toast({ title: 'Error', description: 'Failed to report issue', variant: 'destructive' });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle size={12} />
            Assigned
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge className="gap-1 bg-blue-600">
            <Zap size={12} />
            In Progress
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="gap-1 bg-green-600">
            <CheckCircle2 size={12} />
            Completed
          </Badge>
        );
      case 'inspected':
        return (
          <Badge className="gap-1 bg-purple-600">
            <CheckCircle2 size={12} />
            Inspected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const sortedTasks = useMemo(() => {
    return [...assignedTasks].sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
             (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
    });
  }, [assignedTasks]);

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Spinner className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canWork) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>You do not have permission to access housekeeping tasks.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Attendant Worksheets</h1>
          <p className="text-slate-600 mt-2">Your assigned cleaning tasks</p>
        </div>
      </div>

      {/* Active Task Timer (if any) */}
      {activeTaskId && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Active Task</p>
              <h2 className="text-2xl font-bold mt-1">
                {assignedTasks.find((t) => t.id === activeTaskId)?.roomNumber}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{formatTime(elapsedTime)}</div>
              <p className="text-sm text-blue-100 mt-2">Elapsed Time</p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={handlePauseResume}
              variant="secondary"
              className="gap-2"
              size="sm"
            >
              {isTimerRunning ? (
                <>
                  <PauseCircle size={16} />
                  Pause
                </>
              ) : (
                <>
                  <PlayCircle size={16} />
                  Resume
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="secondary"
              className="gap-2"
              size="sm"
            >
              <RotateCcw size={16} />
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* Tasks Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Available</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-800">
            {unassignedTasks.length}
          </h3>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-800">
            {assignedTasks.filter((t) => t.status === 'assigned').length}
          </h3>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In Progress</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-800">
            {assignedTasks.filter((t) => t.status === 'in-progress').length}
          </h3>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-800">
            {completedTasks.length}
          </h3>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Today</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-800">
            {assignedTasks.length + completedTasks.length}
          </h3>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-[2px]',
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            )}
          >
            Active Tasks
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-xs">
              {assignedTasks.length + unassignedTasks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={cn(
              'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-[2px]',
              activeTab === 'completed'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            )}
          >
            Completed Tasks
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-xs">
              {completedTasks.length}
            </span>
          </button>
        </div>

        {/* Active Tasks Tab */}
        {activeTab === 'active' && (
          <div className="space-y-6">
        {unassignedTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-6 bg-green-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-slate-900">Available Tasks</h2>
              <span className="text-sm font-medium text-slate-500">({unassignedTasks.length})</span>
            </div>
            
            {unassignedTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-lg border border-green-200 bg-green-50 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Task Header */}
                <div
                  onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                  className="p-4 cursor-pointer hover:bg-green-100 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-slate-900">{task.roomNumber}</span>
                        <span className="text-sm text-slate-600">{task.roomTypeName}</span>
                        <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="gap-1 bg-green-100 text-green-800">
                          <AlertCircle size={12} />
                          Available
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">Est. Time: {task.estimatedTime} min</p>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      {expandedTaskId === task.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* Task Details (Expanded) */}
                {expandedTaskId === task.id && (
                  <div className="border-t border-green-200 p-4 space-y-4 bg-white">
                    {/* Notes if any */}
                    {task.notes && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-600 uppercase">Notes</p>
                        <p className="text-sm text-slate-700">{task.notes}</p>
                      </div>
                    )}

                    {/* Checklist Preview */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 uppercase">Cleaning Items</p>
                      <div className="space-y-1">
                        {getChecklistForRoomType(task.roomTypeId).slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <Square size={16} className="text-slate-400" />
                            <span className="text-slate-700">{item.task}</span>
                          </div>
                        ))}
                        {getChecklistForRoomType(task.roomTypeId).length > 3 && (
                          <p className="text-xs text-slate-600 mt-2">+{getChecklistForRoomType(task.roomTypeId).length - 3} more items</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-green-200">
                      <Button
                        onClick={() => handleClaimTask(task.id)}
                        disabled={isClaimingTask === task.id}
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        {isClaimingTask === task.id ? (
                          <>
                            <Icons.Spinner className="h-4 w-4 animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} />
                            Claim Task
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedTask(task);
                          setIsIssueModalOpen(true);
                        }}
                        variant="outline"
                        className="gap-2"
                        size="sm"
                      >
                        <Flag size={14} />
                        Report Issue
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Your Tasks Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-6 bg-blue-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-slate-900">Your Tasks</h2>
            <span className="text-sm font-medium text-slate-500">({assignedTasks.length})</span>
          </div>

          {assignedTasks.length === 0 && unassignedTasks.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <Home className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No tasks available</h3>
              <p className="text-slate-600">Check back soon for new cleaning tasks</p>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <Home className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No assigned tasks</h3>
              <p className="text-slate-600">Claim available tasks to get started</p>
            </div>
          ) : (
            sortedTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Task Header */}
                <div
                  onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-slate-900">{task.roomNumber}</span>
                        <span className="text-sm text-slate-600">{task.roomTypeName}</span>
                        <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </Badge>
                        {getStatusBadge(task.status)}
                      </div>
                      <p className="text-sm text-slate-600">Est. Time: {task.estimatedTime} min</p>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      {expandedTaskId === task.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* Task Details (Expanded) */}
                {expandedTaskId === task.id && (
                  <div className="border-t border-slate-200 p-4 space-y-4 bg-slate-50">
                    {/* Guest Info */}
                    {task.reservation && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-600 uppercase">Guest</p>
                        <p className="text-sm text-slate-900">{task.reservation.guestName}</p>
                      </div>
                    )}

                    {/* Checklist Preview */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 uppercase">Checklist Progress</p>
                      <div className="space-y-1">
                        {getChecklistForRoomType(task.roomTypeId).slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            {task.completedChecks.includes(item.id) ? (
                              <CheckCircle2 size={16} className="text-green-600" />
                            ) : (
                              <AlertCircle size={16} className="text-slate-400" />
                            )}
                            <span className={task.completedChecks.includes(item.id) ? 'line-through text-slate-500' : 'text-slate-700'}>
                              {item.task}
                            </span>
                          </div>
                        ))}
                        {getChecklistForRoomType(task.roomTypeId).length > 3 && (
                          <p className="text-xs text-slate-600 mt-2">+{getChecklistForRoomType(task.roomTypeId).length - 3} more items</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                      {task.status === 'assigned' && (
                        <Button
                          onClick={() => handleStartTask(task.id)}
                          className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
                          size="sm"
                        >
                          <PlayCircle size={14} />
                          Start Task
                        </Button>
                      )}

                      {task.status === 'in-progress' && (
                        <Button
                          onClick={() => {
                            setSelectedTask(task);
                            setIsChecklistModalOpen(true);
                          }}
                          className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
                          size="sm"
                        >
                          <CheckSquare size={14} />
                          View Checklist
                        </Button>
                      )}

                      {task.status === 'in-progress' && (
                        <Button
                          onClick={() => handleCompleteTask(task)}
                          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                          size="sm"
                        >
                          <CheckCircle2 size={14} />
                          Complete
                        </Button>
                      )}

                      <Button
                        onClick={() => {
                          setSelectedTask(task);
                          setIsIssueModalOpen(true);
                        }}
                        variant="outline"
                        className="gap-2"
                        size="sm"
                      >
                        <Flag size={14} />
                        Issue
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        </div>
        )}

        {/* Completed Tasks Tab */}
        {activeTab === 'completed' && (
          <div className="space-y-3">
            {completedTasks.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No completed tasks yet</h3>
                <p className="text-slate-600">Complete tasks will appear here</p>
              </div>
            ) : (
              completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Task Header */}
                  <div
                    onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    className="p-4 cursor-pointer hover:bg-emerald-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold text-slate-900">{task.roomNumber}</span>
                          <span className="text-sm text-slate-600">{task.roomTypeName}</span>
                          <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </Badge>
                          {getStatusBadge(task.status)}
                        </div>
                        <p className="text-sm text-slate-600">Est. Time: {task.estimatedTime} min</p>
                        {task.actualStartTime && task.actualEndTime && (
                          <p className="text-xs text-emerald-600 mt-1">
                            Completed in {Math.round((task.actualEndTime.toMillis() - task.actualStartTime.toMillis()) / 60000)} minutes
                          </p>
                        )}
                      </div>
                      <button className="text-slate-400 hover:text-slate-600">
                        {expandedTaskId === task.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Task Details (Expanded) */}
                  {expandedTaskId === task.id && (
                    <div className="border-t border-emerald-200 p-4 space-y-4 bg-white">
                      {/* Guest Info */}
                      {task.reservation && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-600 uppercase">Guest</p>
                          <p className="text-sm text-slate-900">{task.reservation.guestName}</p>
                        </div>
                      )}

                      {/* Checklist Summary */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase">Checklist Completed</p>
                        <div className="space-y-1">
                          {getChecklistForRoomType(task.roomTypeId).slice(0, 3).map((item) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              <span className="line-through text-slate-500">{item.task}</span>
                            </div>
                          ))}
                          {getChecklistForRoomType(task.roomTypeId).length > 3 && (
                            <p className="text-xs text-slate-600 mt-2">+{getChecklistForRoomType(task.roomTypeId).length - 3} more items</p>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {task.notes && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-600 uppercase">Notes</p>
                          <p className="text-sm text-slate-700">{task.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Checklist Modal */}
      <Dialog open={isChecklistModalOpen} onOpenChange={setIsChecklistModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cleaning Checklist - {selectedTask?.roomNumber}</DialogTitle>
            <DialogDescription>{selectedTask?.roomTypeName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedTask && getChecklistForRoomType(selectedTask.roomTypeId).map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggleCheckItem(selectedTask.id, item.id)}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                {selectedTask.completedChecks.includes(item.id) ? (
                  <CheckSquare size={20} className="text-green-600 flex-shrink-0 mt-1" />
                ) : (
                  <Square size={20} className="text-slate-400 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <p className={cn(
                    'text-sm font-medium',
                    selectedTask.completedChecks.includes(item.id) ? 'line-through text-slate-500' : 'text-slate-900'
                  )}>
                    {item.task}
                  </p>
                  <p className="text-xs text-slate-600">{item.category}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsChecklistModalOpen(false)} className="flex-1">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Modal */}
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Issue - {selectedTask?.roomNumber}</DialogTitle>
            <DialogDescription>Let management know about any problems</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              placeholder="Describe the issue (e.g., broken lamp, water leak, stain on carpet)..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={5}
              className="resize-none"
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsIssueModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleReportIssue}
                disabled={isSubmittingIssue || !issueDescription.trim()}
                className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
              >
                {isSubmittingIssue ? (
                  <>
                    <Icons.Spinner className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag size={16} />
                    Report Issue
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
