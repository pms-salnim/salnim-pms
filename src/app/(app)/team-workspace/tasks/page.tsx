
"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Icons } from "@/components/icons";
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlusCircle } from 'lucide-react';

import type { Task } from '@/types/task';
import type { StaffMember } from '@/types/staff';
import type { Room } from '@/types/room';
import type { RoomType } from '@/types/roomType';

import TaskList from '@/components/team-workspace/task-list';
import { useTranslation } from 'react-i18next';

const TaskForm = dynamic(() => import('@/components/team-workspace/task-form'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>,
  ssr: false,
});


export default function DailyTasksPage() {
  const { user, isLoadingAuth } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { t } = useTranslation('pages/housekeeping/daily-tasks/content');

  const canManage = user?.permissions?.housekeeping;

  useEffect(() => {
    if (!user?.propertyId) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    let listenersCount = 4;
    const doneLoading = () => {
        listenersCount--;
        if (listenersCount <= 0) setIsLoading(false);
    }
    
    // Fetch non-task data
    onSnapshot(query(collection(db, "staff"), where("propertyId", "==", user.propertyId)), (snapshot) => { setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember))); doneLoading(); });
    onSnapshot(query(collection(db, "rooms"), where("propertyId", "==", user.propertyId)), (snapshot) => { setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room))); doneLoading(); });
    onSnapshot(query(collection(db, "roomTypes"), where("propertyId", "==", user.propertyId)), (snapshot) => { setRoomTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomType))); doneLoading(); });
    
    // Fetch tasks assigned to housekeeping role
    const tasksQuery = query(collection(db, "tasks"), where("property_id", "==", user.propertyId), where("assigned_to_role", "==", "housekeeping"), orderBy("createdAt", "desc"));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task)));
        doneLoading();
    }, (error) => {
        console.error("Error fetching housekeeping tasks:", error);
        toast({ title: t('toasts.error_fetching_tasks.title'), description: t('toasts.error_fetching_tasks.description'), variant: "destructive" });
        doneLoading();
    });

    return () => unsubTasks();

  }, [user?.propertyId, t]);

  const handleOpenModal = (task: Task | null = null) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  if (isLoadingAuth || isLoading) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  if (!canManage) {
    return (
      <Alert variant="destructive">
        <Icons.AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('access_denied.title')}</AlertTitle>
        <AlertDescription>
          {t('access_denied.description')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-4">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
                    {t('title')}
                </h1>
                <p className="text-sm text-muted-foreground">
                   {t('description')}
                </p>
            </div>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                     <Button onClick={() => handleOpenModal()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> {t('create_task_button')}
                     </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                    <Suspense fallback={<div className="h-48 flex items-center justify-center"><Icons.Spinner className="h-6 w-6 animate-spin" /></div>}>
                        <DialogHeader>
                            <DialogTitle>{editingTask ? t('edit_modal.title') : t('create_modal.title')}</DialogTitle>
                            <DialogDescription>
                                {editingTask ? t('edit_modal.description') : t('create_modal.description')}
                            </DialogDescription>
                        </DialogHeader>
                        <TaskForm 
                            onClose={handleCloseModal} 
                            initialTask={editingTask}
                            staffList={staff}
                            roomList={rooms}
                            roomTypes={roomTypes}
                        />
                    </Suspense>
                </DialogContent>
            </Dialog>
        </div>
        <TaskList tasks={tasks} staffList={staff} onEditTask={handleOpenModal} />
    </div>
  );
}
