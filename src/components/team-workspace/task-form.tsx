
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { doc, addDoc, updateDoc, serverTimestamp, Timestamp, collection } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

import type { Task, TaskPriority, TaskStatus } from '@/types/task';
import { taskPriorities, taskStatuses } from '@/types/task';
import type { StaffMember, StaffRole } from '@/types/staff';
import { staffRoles } from '@/types/staff';
import type { Room } from '@/types/room';
import type { RoomType } from '@/types/roomType';

interface TaskFormProps {
  onClose: () => void;
  initialTask: Task | null;
  staffList: StaffMember[];
  roomList?: Room[];
  roomTypes?: RoomType[];
}

type AssigneeType = 'role' | 'user';

export default function TaskForm({ onClose, initialTask, staffList, roomList = [], roomTypes = [] }: TaskFormProps) {
  const { user } = useAuth();
  const { t } = useTranslation('pages/housekeeping/daily-tasks/content');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeType, setAssigneeType] = useState<AssigneeType>('role');
  const [assignedToRole, setAssignedToRole] = useState<StaffRole | ''>('');
  const [assignedToUid, setAssignedToUid] = useState<string>('');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  
  const filteredRooms = useMemo(() => {
    if (!selectedRoomTypeId) return [];
    return roomList.filter(room => room.roomTypeId === selectedRoomTypeId);
  }, [selectedRoomTypeId, roomList]);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description || '');
      setPriority(initialTask.priority);

      const initialRoom = roomList.find(r => r.id === initialTask.room_id);
      setSelectedRoomTypeId(initialRoom?.roomTypeId || '');
      setRoomId(initialTask.room_id || '');

      setDueDate(initialTask.due_date ? initialTask.due_date.toDate() : undefined);
      if (initialTask.assigned_to_uid) {
        setAssigneeType('user');
        setAssignedToUid(initialTask.assigned_to_uid);
        setAssignedToRole('');
      } else {
        setAssigneeType('role');
        setAssignedToRole(initialTask.assigned_to_role as StaffRole || '');
        setAssignedToUid('');
      }
    } else {
      setTitle(''); setDescription(''); setPriority('Medium'); setRoomId(''); setDueDate(undefined); setAssigneeType('role'); setAssignedToRole(''); setAssignedToUid(''); setSelectedRoomTypeId('');
    }
  }, [initialTask, roomList]);

  const handleRoomTypeChange = (roomTypeId: string) => {
    setSelectedRoomTypeId(roomTypeId);
    setRoomId(''); // Reset room selection when type changes
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !priority || (assigneeType === 'role' && !assignedToRole) || (assigneeType === 'user' && !assignedToUid)) {
        toast({ title: t('toasts.validation_error.title'), description: t('toasts.validation_error.task_form_description'), variant: "destructive" });
        return;
    }
    
    const assignedToDetails = assigneeType === 'user'
      ? { assigned_to_uid: assignedToUid, assigned_to_role: null, assignedToName: staffList.find(s => s.id === assignedToUid)?.fullName, assignedToRoleDisplay: null }
      : { assigned_to_uid: null, assigned_to_role: assignedToRole, assignedToName: null, assignedToRoleDisplay: assignedToRole };
      
    const taskData: Partial<Task> = {
        title,
        description,
        ...assignedToDetails,
        room_id: roomId || null,
        roomName: roomList.find(r => r.id === roomId)?.name || null,
        roomTypeName: roomTypes.find(rt => rt.id === selectedRoomTypeId)?.name || null,
        floor: roomList.find(r => r.id === roomId)?.floor || null,
        priority,
        status: initialTask?.status || 'Open',
        due_date: dueDate ? Timestamp.fromDate(dueDate) : null,
        updatedAt: serverTimestamp() as Timestamp,
    };
    
    try {
        if (initialTask) {
            const taskRef = doc(db, 'tasks', initialTask.id);
            await updateDoc(taskRef, taskData);
            toast({ title: t('toasts.success_title'), description: t('toasts.task_updated.description') });
        } else {
            const fullTaskData = {
                ...taskData,
                property_id: user?.propertyId,
                created_by_uid: user?.id,
                createdByName: user?.name,
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(db, 'tasks'), fullTaskData);
            toast({ title: t('toasts.success_title'), description: t('toasts.task_created.description') });
        }
        onClose();
    } catch (error) {
        console.error("Error saving task:", error);
        toast({ title: t('toasts.error_title'), description: t('toasts.task_created.error'), variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-1">
        <Label htmlFor="taskTitle">{t('form.title_label')} <span className="text-destructive">*</span></Label>
        <Input id="taskTitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="taskDescription">{t('form.description_label')}</Label>
        <Textarea id="taskDescription" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t('form.assign_to_label')} <span className="text-destructive">*</span></Label>
        <RadioGroup value={assigneeType} onValueChange={(v) => setAssigneeType(v as AssigneeType)} className="flex gap-4">
            <div className="flex items-center space-x-2"><RadioGroupItem value="role" id="assign_role" /><Label htmlFor="assign_role" className="font-normal">{t('form.assign_to_role')}</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="user" id="assign_user" /><Label htmlFor="assign_user" className="font-normal">{t('form.assign_to_user')}</Label></div>
        </RadioGroup>
      </div>
       {assigneeType === 'role' ? (
         <div className="space-y-1">
            <Select value={assignedToRole} onValueChange={(v) => setAssignedToRole(v as StaffRole)}>
              <SelectTrigger><SelectValue placeholder={t('form.select_role_placeholder')} /></SelectTrigger>
              <SelectContent>{staffRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
         </div>
      ) : (
        <div className="space-y-1">
            <Select value={assignedToUid} onValueChange={setAssignedToUid}>
                <SelectTrigger><SelectValue placeholder={t('form.select_user_placeholder')} /></SelectTrigger>
                <SelectContent>{staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent>
            </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="taskRoomType">{t('form.room_type_label')}</Label>
           <Select value={selectedRoomTypeId} onValueChange={handleRoomTypeChange}>
              <SelectTrigger id="taskRoomType"><SelectValue placeholder={t('form.select_room_type_placeholder')} /></SelectTrigger>
              <SelectContent>{roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}</SelectContent>
            </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="taskRoom">{t('form.room_label')}</Label>
           <Select value={roomId} onValueChange={setRoomId} disabled={!selectedRoomTypeId || filteredRooms.length === 0}>
              <SelectTrigger id="taskRoom"><SelectValue placeholder={!selectedRoomTypeId ? t('form.select_type_first_placeholder') : t('form.select_room_placeholder')} /></SelectTrigger>
              <SelectContent>{filteredRooms.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true})).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="taskPriority">{t('form.priority_label')}</Label>
           <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger id="taskPriority"><SelectValue placeholder={t('form.priority_placeholder')} /></SelectTrigger>
              <SelectContent>{taskPriorities.map(p => <SelectItem key={p} value={p}>{t(`task_priorities.${p.toLowerCase()}`)}</SelectItem>)}</SelectContent>
            </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="taskDueDate">{t('form.due_date_label')}</Label>
          <Popover>
              <PopoverTrigger asChild>
                  <Button id="taskDueDate" variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, "PPP") : <span>{t('form.due_date_placeholder')}</span>}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} /></PopoverContent>
          </Popover>
        </div>
      </div>

      <DialogFooter className="pt-4">
        <DialogClose asChild><Button type="button" variant="outline">{t('buttons.cancel')}</Button></DialogClose>
        <Button type="submit">{t('buttons.save_task')}</Button>
      </DialogFooter>
    </form>
  );
}
