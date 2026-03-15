
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Task, TaskPriority, TaskStatus } from '@/types/task';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Home, Calendar, Flag, User, Users, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import type { StaffMember } from '@/types/staff';
import { useTranslation } from 'react-i18next';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  assignee?: StaffMember | null; // Pass assignee details if available
}

export default function TaskDetailModal({ isOpen, onClose, task, assignee }: TaskDetailModalProps) {
    const { t } = useTranslation('pages/housekeeping/daily-tasks/content');
    if (!task) return null;

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

    const DetailRow = ({ icon, label, children }: { icon: React.ElementType, label: string, children: React.ReactNode }) => (
        <div className="grid grid-cols-3 items-start gap-2">
            <div className="flex items-center gap-2 font-medium col-span-1">
                {React.createElement(icon, { className: "h-4 w-4 text-muted-foreground" })}
                <span>{label}</span>
            </div>
            <div className="col-span-2 text-muted-foreground">{children}</div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8">{task.title}</DialogTitle>
                    <DialogDescription>
                        {t('view_modal.created_by', { name: task.createdByName, date: task.createdAt ? format(task.createdAt.toDate(), 'PP') : '' })}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <section className="space-y-3">
                        {task.description && <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap">{task.description}</p>}
                        
                        <DetailRow icon={Flag} label={t('view_modal.priority_label')}>
                            <Badge variant="outline" className={cn(priorityStyles[task.priority])}>{t(`task_priorities.${task.priority.toLowerCase()}`)}</Badge>
                        </DetailRow>

                        <DetailRow icon={CheckCircle2} label={t('view_modal.status_label')}>
                            <Badge className={cn('text-white', statusStyles[task.status])}>{t(`task_statuses.${task.status.toLowerCase().replace(' ', '_')}`)}</Badge>
                        </DetailRow>

                        {task.due_date && (
                           <DetailRow icon={Calendar} label={t('view_modal.due_date_label')}>
                                {format(task.due_date.toDate(), 'PP')}
                            </DetailRow>
                        )}

                        <DetailRow icon={Home} label={t('view_modal.location_label')}>
                            {task.roomName ? t('view_modal.room_location', { name: task.roomName }) : t('view_modal.property_wide_location')}
                        </DetailRow>
                    </section>

                    <Separator />

                    <section className="space-y-3">
                        <h3 className="text-md font-semibold text-foreground">{t('view_modal.assignment_title')}</h3>
                         <DetailRow icon={User} label={t('view_modal.assigned_to_label')}>
                             <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={assignee?.profile_picture} />
                                    <AvatarFallback>{assignee ? assignee.fullName.charAt(0) : task.assignedToRoleDisplay?.charAt(0) || '?'}</AvatarFallback>
                                </Avatar>
                                <span>{assignee ? assignee.fullName : t('view_modal.role_assignment', { role: task.assignedToRoleDisplay })}</span>
                             </div>
                        </DetailRow>
                    </section>
                    
                    {(task.status === 'Completed' || task.updatedByName) && <Separator />}

                    <section className="space-y-3">
                      <h3 className="text-md font-semibold text-foreground">{t('view_modal.activity_title')}</h3>
                       {task.status === 'Completed' && task.completedAt && (
                          <DetailRow icon={CheckCircle2} label={t('view_modal.completed_label')}>
                                {t('view_modal.completed_by', { name: task.completedByName || 'N/A', role: task.completedByRole ? `(${task.completedByRole})` : '', date: format(task.completedAt.toDate(), 'PP p') })}
                          </DetailRow>
                       )}
                       {task.updatedAt && task.updatedByName && (
                          <DetailRow icon={RefreshCw} label={t('view_modal.last_update_label')}>
                              {t('view_modal.last_update_by', { name: task.updatedByName, date: format(task.updatedAt.toDate(), 'PP p') })}
                          </DetailRow>
                       )}
                    </section>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">{t('buttons.close')}</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
