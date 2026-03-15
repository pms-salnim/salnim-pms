
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import type { Task } from '@/types/task';
import type { StaffMember } from '@/types/staff';
import type { Room } from '@/types/room';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import TaskList from '@/components/team-workspace/task-list';
import TaskForm from '@/components/team-workspace/task-form';
import { PlusCircle } from 'lucide-react';
import type { RoomType } from '@/types/roomType';
import { toast } from '@/hooks/use-toast';

export default function TasksPage() {
    const { user, isLoadingAuth } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const canManageTasks = user?.permissions?.teamWorkspace ?? false;

    useEffect(() => {
        if (!user?.propertyId || !user.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
    
        const unsubscribers: (() => void)[] = [];
    
        // Fetch non-task data
        unsubscribers.push(onSnapshot(query(collection(db, "staff"), where("propertyId", "==", user.propertyId)), (snapshot) => {
            setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember)));
        }));
        unsubscribers.push(onSnapshot(query(collection(db, "rooms"), where("propertyId", "==", user.propertyId)), (snapshot) => {
            setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
        }));
        unsubscribers.push(onSnapshot(query(collection(db, "roomTypes"), where("propertyId", "==", user.propertyId)), (snapshot) => {
            setRoomTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomType)));
        }));
    
        // Admins and managers with the permission see all tasks for the property
        if (canManageTasks) {
            const tasksQuery = query(collection(db, "tasks"), where("property_id", "==", user.propertyId), orderBy("createdAt", "desc"));
            unsubscribers.push(onSnapshot(tasksQuery, (snapshot) => {
                setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching admin tasks:", error);
                toast({ title: "Error", description: "Could not fetch tasks.", variant: "destructive"});
                setIsLoading(false);
            }));
        } else {
            // Other staff see tasks assigned to their role OR their specific user ID
            const roleQuery = query(collection(db, "tasks"), where("property_id", "==", user.propertyId), where("assigned_to_role", "==", user.role));
            const userQuery = query(collection(db, "tasks"), where("property_id", "==", user.propertyId), where("assigned_to_uid", "==", user.id));
            
            let roleTasks: Task[] | null = null;
            let userTasks: Task[] | null = null;
    
            const combineAndSetTasks = () => {
                if (roleTasks !== null && userTasks !== null) {
                    const combined = new Map<string, Task>();
                    [...roleTasks, ...userTasks].forEach(task => combined.set(task.id, task));
                    setTasks(Array.from(combined.values()).sort((a,b) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0)));
                    setIsLoading(false);
                }
            };
    
            unsubscribers.push(onSnapshot(roleQuery, (snapshot) => {
                roleTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
                combineAndSetTasks();
            }, (error) => {
                console.error("Error fetching role tasks:", error);
                roleTasks = [];
                combineAndSetTasks();
            }));
    
            unsubscribers.push(onSnapshot(userQuery, (snapshot) => {
                userTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
                combineAndSetTasks();
            }, (error) => {
                console.error("Error fetching user tasks:", error);
                userTasks = [];
                combineAndSetTasks();
            }));
        }
    
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    
    }, [user, canManageTasks]);

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

    if (!user?.permissions?.teamWorkspace) {
        return (
             <div className="flex flex-col h-full">
                <header className="sticky top-0 z-10 p-4 md:px-8 border-b bg-card">
                     <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Task Management</h1>
                     <p className="text-sm text-muted-foreground">Easily manage day-to-day operations by creating detailed tasks, assigning them to specific team members or roles, and tracking their progress in real time.</p>
                </header>
                <div className="flex-1 p-4 md:p-6 flex items-center justify-center">
                    <Alert className="max-w-md">
                        <Icons.CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>All Clear!</AlertTitle>
                        <AlertDescription>You have no tasks assigned to you or your role at the moment.</AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <header className="sticky top-0 z-10 p-4 md:px-8 border-b bg-card flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
                        Task Management
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Easily manage day-to-day operations by creating detailed tasks, assigning them to specific team members or roles, and tracking their progress in real time.
                    </p>
                </div>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                         <Button onClick={() => handleOpenModal()} disabled={!canManageTasks}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Task
                         </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                            <DialogDescription>
                                {editingTask ? 'Update the details of the task.' : 'Fill in the details to assign a new task.'}
                            </DialogDescription>
                        </DialogHeader>
                        <TaskForm 
                            onClose={handleCloseModal} 
                            initialTask={editingTask}
                            staffList={staff}
                            roomList={rooms}
                            roomTypes={roomTypes}
                        />
                    </DialogContent>
                </Dialog>
            </header>
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <TaskList tasks={tasks} staffList={staff} onEditTask={handleOpenModal} />
            </div>
        </div>
    );
}
