
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TaskCard from './task-card';
import type { Task, TaskStatus } from '@/types/task';
import { taskStatuses } from '@/types/task';
import type { StaffMember } from '@/types/staff';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import TaskDetailModal from './task-detail-modal';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Icons } from '../icons';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { writeBatch, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';


interface TaskListProps {
  tasks: Task[];
  staffList: StaffMember[];
  onEditTask: (task: Task) => void;
}

export default function TaskList({ tasks, staffList, onEditTask }: TaskListProps) {
    const { user } = useAuth();
    const [viewingTask, setViewingTask] = useState<Task | null>(null);
    const [selectedRowIds, setSelectedRowIds] = useState(new Set<string>());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const searchParams = useSearchParams();
    const { t } = useTranslation(['pages/housekeeping/daily-tasks/content', 'pages/team-workspace/bulk-actions']);

    const canManage = user?.permissions?.teamWorkspace ?? false;

    const tasksWithAssignee = useMemo(() => {
        return tasks
            .map(task => {
                const assignee = task.assigned_to_uid ? staffList.find(s => s.id === task.assigned_to_uid) : null;
                return {
                    ...task,
                    assignee,
                };
            });
    }, [tasks, staffList]);
    
    const myTasks = useMemo(() => {
        const openOrInProgressTasks = tasksWithAssignee.filter(task => task.status !== 'Completed');
        return openOrInProgressTasks.sort((a,b) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0));
    }, [tasksWithAssignee]);
    
    const completedTasks = useMemo(() => {
        return tasksWithAssignee
            .filter(task => task.status === 'Completed')
            .sort((a,b) => (b.completedAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0));
    }, [tasksWithAssignee]);

    const handleViewDetails = (task: Task) => {
        setViewingTask(task);
    };

    useEffect(() => {
        const taskIdToView = searchParams.get('view');
        if (taskIdToView) {
            const task = tasks.find(t => t.id === taskIdToView);
            if (task) {
                handleViewDetails(task);
            }
        }
    }, [searchParams, tasks]);

    const handleRowSelect = (taskId: string) => {
      setSelectedRowIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(taskId)) {
          newSet.delete(taskId);
        } else {
          newSet.add(taskId);
        }
        return newSet;
      });
    };

    const handleSelectAllForList = (taskIds: string[], checked: boolean) => {
      setSelectedRowIds(prev => {
        const newSet = new Set(prev);
        if (checked) {
          taskIds.forEach(id => newSet.add(id));
        } else {
          taskIds.forEach(id => newSet.delete(id));
        }
        return newSet;
      });
    };
    
    const confirmBulkStatusChange = async (taskIds: string[], status: TaskStatus) => {
        setIsLoading(true);
        const batch = writeBatch(db);
        taskIds.forEach(id => {
            const taskRef = doc(db, 'tasks', id);
            batch.update(taskRef, { status, updatedAt: serverTimestamp(), updatedByUid: user?.id, updatedByName: user?.name });
        });
        
        try {
            await batch.commit();
            toast({ title: t('toasts.success_title'), description: t('toasts.bulk_status_update.description', { count: taskIds.length, status: t(`task_statuses.${status.toLowerCase().replace(' ', '_')}`) })});
        } catch(err) {
            toast({ title: t('toasts.error_title'), description: t('toasts.bulk_status_update.error'), variant: "destructive" });
        } finally {
            setIsLoading(false);
            setSelectedRowIds(new Set());
        }
    };

    const handleBulkDelete = async () => {
        setIsLoading(true);
        const batch = writeBatch(db);
        selectedRowIds.forEach(id => {
            const taskRef = doc(db, 'tasks', id);
            batch.delete(taskRef);
        });

        try {
            await batch.commit();
            toast({ title: t('toasts.success_title'), description: t('toasts.bulk_delete.description', { count: selectedRowIds.size })});
        } catch (error) {
            toast({ title: t('toasts.error_title'), description: t('toasts.bulk_delete.error'), variant: "destructive"});
        } finally {
            setIsLoading(false);
            setIsDeleteDialogOpen(false);
            setSelectedRowIds(new Set());
        }
    };
    
    const renderTaskList = (taskList: (Task & { assignee: StaffMember | null })[], listName: string) => {
        if (taskList.length === 0) {
            return <p className="text-center text-muted-foreground py-10">{t('task_list.no_tasks')}</p>;
        }
        const allInListSelected = taskList.length > 0 && taskList.every(t => selectedRowIds.has(t.id));

        return (
             <div className="space-y-4">
                {taskList.length > 0 && canManage && (
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id={`select-all-${listName}`}
                            checked={allInListSelected}
                            onCheckedChange={(checked) => handleSelectAllForList(taskList.map(t => t.id), Boolean(checked))}
                        />
                        <Label htmlFor={`select-all-${listName}`} className="text-sm font-normal">{t('task_list.select_all')}</Label>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {taskList.map(task => (
                        <TaskCard 
                            key={task.id} 
                            task={task} 
                            assignee={task.assignee} 
                            onEdit={onEditTask}
                            onViewDetails={handleViewDetails}
                            isSelected={selectedRowIds.has(task.id)}
                            onSelect={() => handleRowSelect(task.id)}
                        />
                    ))}
                </div>
            </div>
        );
    };

    const viewingTaskWithAssignee = viewingTask ? tasksWithAssignee.find(t => t.id === viewingTask.id) : null;
    const numSelected = selectedRowIds.size;

    return (
        <>
            {numSelected > 0 && canManage && (
                <div className="mb-4 flex items-center justify-between p-3 bg-muted/50 rounded-lg border animate-in fade-in-50">
                    <p className="text-sm font-medium">{t('pages/team-workspace/bulk-actions:selected_text', { count: numSelected })}</p>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">{t('pages/team-workspace/bulk-actions:button_text')} <Icons.DropdownArrow className="ml-2 h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Icons.Edit className="mr-2 h-4 w-4" /> {t('pages/team-workspace/bulk-actions:change_status')}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        {taskStatuses.map(status => (
                                            <DropdownMenuItem key={status} onClick={() => confirmBulkStatusChange(Array.from(selectedRowIds), status)}>
                                                {t('pages/team-workspace/bulk-actions:mark_as', { status: t(`task_statuses.${status.toLowerCase().replace(' ', '_')}`) })}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                                <Icons.Trash className="mr-2 h-4 w-4" /> {t('pages/team-workspace/bulk-actions:delete_selected')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
            <Tabs defaultValue="to_do" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="to_do">{t('tabs.to_do', { count: myTasks.length })}</TabsTrigger>
                    <TabsTrigger value="completed">{t('tabs.completed', { count: completedTasks.length })}</TabsTrigger>
                </TabsList>
                <TabsContent value="to_do" className="mt-4">
                    {renderTaskList(myTasks, 'to_do')}
                </TabsContent>
                <TabsContent value="completed" className="mt-4">
                    {renderTaskList(completedTasks, 'completed')}
                </TabsContent>
            </Tabs>
            
            <TaskDetailModal 
                isOpen={!!viewingTask} 
                onClose={() => setViewingTask(null)} 
                task={viewingTask}
                assignee={viewingTaskWithAssignee?.assignee}
            />
            
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                           {t('delete_dialog.description', { count: selectedRowIds.size })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>{t('buttons.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} disabled={isLoading}>
                            {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                            {t('buttons.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
