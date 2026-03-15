
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoreHorizontal, Calendar, Home, Flag, CheckCircle2, Edit, Trash2, Eye, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus, TaskPriority } from '@/types/task';
import type { StaffMember } from '@/types/staff';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { useTranslation } from 'react-i18next';

interface TaskCardProps {
  task: Task;
  assignee: StaffMember | null;
  onEdit: (task: Task) => void;
  onViewDetails: (task: Task) => void;
  isSelected: boolean;
  onSelect: () => void;
}

export default function TaskCard({ task, assignee, onEdit, onViewDetails, isSelected, onSelect }: TaskCardProps) {
  const { user } = useAuth();
  const { t } = useTranslation('pages/housekeeping/daily-tasks/content');
  const canManage = user?.permissions?.teamWorkspace ?? false;
  
  const priorityStyles: Record<TaskPriority, string> = {
    'Low': 'bg-blue-100 text-blue-800 border-blue-200',
    'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'High': 'bg-orange-100 text-orange-800 border-orange-200',
    'Urgent': 'bg-red-100 text-red-800 border-red-200',
  };

  const statusStyles: Record<TaskStatus, string> = {
    'Open': 'bg-gray-100 text-gray-800',
    'In Progress': 'bg-blue-500 text-white',
    'Completed': 'bg-green-500 text-white',
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!canManage && user?.id !== task.assigned_to_uid && user?.role !== task.assigned_to_role) {
        toast({ title: t('toasts.permission_denied.title'), description: t('toasts.permission_denied.status_description'), variant: "destructive" });
        return;
    }
    
    const batch = writeBatch(db);
    const taskRef = doc(db, 'tasks', task.id);
    
    const updatePayload: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedByUid: user?.id,
        updatedByName: user?.name,
    };

    if (newStatus === 'Completed') {
        updatePayload.completedByUid = user?.id;
        updatePayload.completedByName = user?.name;
        updatePayload.completedByRole = user?.role;
        updatePayload.completedAt = serverTimestamp();
    } else if (task.status === 'Completed' && newStatus !== 'Completed') {
        updatePayload.completedByUid = null;
        updatePayload.completedByName = null;
        updatePayload.completedByRole = null;
        updatePayload.completedAt = null;
    }

    batch.update(taskRef, updatePayload);

    let roomUpdated = false;
    if (newStatus === 'Completed' && task.room_id) {
        const roomRef = doc(db, 'rooms', task.room_id);
        batch.update(roomRef, { status: 'Clean' });
        roomUpdated = true;
    }

    try {
        await batch.commit();
        let successMessage = t('toasts.status_update.description', { status: t(`task_statuses.${newStatus.toLowerCase().replace(' ', '_')}`) });
        if (roomUpdated) {
            successMessage += ` ${t('toasts.status_update.room_updated_message', { roomName: task.roomName || '' })}`;
        }
        toast({ title: t('toasts.success_title'), description: successMessage });
    } catch(err) {
        toast({ title: t('toasts.error_title'), description: t('toasts.status_update.error'), variant: "destructive" });
    }
  };
  
  const handleDelete = async () => {
    if (!canManage) {
        toast({ title: t('toasts.permission_denied.title'), description: t('toasts.permission_denied.delete_description'), variant: "destructive" });
        return;
    }
    if (!confirm(t('confirm_delete'))) return;
    try {
        await deleteDoc(doc(db, 'tasks', task.id));
        toast({ title: t('toasts.success_title'), description: t('toasts.task_deleted.description') });
    } catch (err) {
        toast({ title: t('toasts.error_title'), description: t('toasts.task_deleted.error'), variant: "destructive" });
    }
  };

  return (
    <div className="relative">
      <div 
        className={cn(
          "absolute top-2 left-2 z-10",
          !canManage && "hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={t('task_card.select_aria_label', { title: task.title })}
        />
      </div>
      <Card 
        className={cn(
            "flex flex-col h-full transition-all",
            canManage && "cursor-pointer",
            isSelected ? "ring-2 ring-primary ring-offset-2" : "shadow-sm hover:shadow-md"
        )}
        onClick={canManage ? onSelect : undefined}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className={cn(canManage && "pl-6")}>
            <CardTitle>{task.title}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">{task.description}</CardDescription>
          </div>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewDetails(task)}>
                      <Eye className="mr-2 h-4 w-4" /> {t('task_card.actions.view')}
                  </DropdownMenuItem>
                  {canManage && (
                      <>
                          <DropdownMenuItem onClick={() => onEdit(task)}>
                              <Edit className="mr-2 h-4 w-4" /> {t('task_card.actions.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> {t('task_card.actions.delete')}
                          </DropdownMenuItem>
                      </>
                  )}
              </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-4 flex-grow">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                  <Flag className="h-4 w-4" />
                  <span>{t('task_card.priority_label')}:</span>
                  <Badge variant="outline" className={cn(priorityStyles[task.priority])}>{t(`task_priorities.${task.priority.toLowerCase()}`)}</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t('task_card.status_label')}:</span>
                  <Badge className={cn('text-white', statusStyles[task.status])}>{t(`task_statuses.${task.status.toLowerCase().replace(' ', '_')}`)}</Badge>
              </div>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                  <Home className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                      {task.roomName ? t('task_card.room_location', { name: task.roomName }) : t('task_card.property_wide_location')}
                  </span>
              </div>
               {task.due_date && (
                  <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>{format(task.due_date.toDate(), 'PP')}</span>
                  </div>
              )}
            </div>

            {(task.roomTypeName || (task.floor && task.floor !== 'N/A')) && (
                <div className="pl-6 text-xs flex items-center gap-2">
                  {task.roomTypeName && (<span>{task.roomTypeName}</span>)}
                  {(task.roomTypeName && task.floor && task.floor !== 'N/A') && <span>&bull;</span>}
                  {task.floor && task.floor !== 'N/A' && (<span>{t('task_card.floor_label', { floor: task.floor })}</span>)}
                </div>
            )}
          </div>
           {task.status !== 'Completed' && task.updatedAt && task.updatedByName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t">
                  <RefreshCw className="h-3 w-3" />
                  <span>{t('task_card.last_update', { name: task.updatedByName })}</span>
              </div>
          )}
           {task.status === 'Completed' && task.completedAt && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-2 border-t">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{t('task_card.completed_by', { name: task.completedByName || 'Unknown', role: task.completedByRole ? `(${task.completedByRole})` : '', date: format(task.completedAt.toDate(), 'PP') })}</span>
              </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between items-center bg-muted/50 p-3">
          <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{t('task_card.assigned_to_label')}:</p>
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger>
                          <Avatar className="h-7 w-7">
                              <AvatarImage src={assignee?.profile_picture} />
                              <AvatarFallback>{assignee ? assignee.fullName.charAt(0) : task.assignedToRoleDisplay?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                          <p>{assignee ? assignee.fullName : t('task_card.role_tooltip', { role: task.assignedToRoleDisplay })}</p>
                      </TooltipContent>
                  </Tooltip>
              </TooltipProvider>
               <span className="text-sm font-medium">{assignee ? assignee.fullName : task.assignedToRoleDisplay}</span>
          </div>
          
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">{t('task_card.update_status_button')}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleStatusChange('Open')} disabled={task.status === 'Open'}>{t('task_statuses.open')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('In Progress')} disabled={task.status === 'In Progress'}>{t('task_statuses.in_progress')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange('Completed')} disabled={task.status === 'Completed'}>{t('task_statuses.completed')}</DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    </div>
  );
}
