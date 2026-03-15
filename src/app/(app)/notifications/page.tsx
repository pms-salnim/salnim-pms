
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Notification } from '@/types/notification';
import { toast } from '@/hooks/use-toast';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'new_reservation':
      return <Icons.CalendarCheck className="h-5 w-5 text-blue-500" />;
    case 'payment_received':
      return <Icons.CreditCard className="h-5 w-5 text-green-500" />;
    case 'cancellation':
      return <Icons.XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Icons.Notification className="h-5 w-5 text-gray-500" />;
  }
};

export default function NotificationsPage() {
  const { user, isLoadingAuth } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!user?.propertyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, "notifications"),
      where("propertyId", "==", user.propertyId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as Notification));
      setNotifications(fetchedNotifications);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.propertyId]);
  
  // Reset selection when page or items per page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, itemsPerPage]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      const notifDocRef = doc(db, "notifications", notification.id);
      await updateDoc(notifDocRef, { read: true });
    }
    if (notification.type === 'new_reservation' && notification.relatedDocId) {
      router.push(`/reservations/all?view=${notification.relatedDocId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.propertyId) return;

    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
      const docRef = doc(db, "notifications", n.id);
      batch.update(docRef, { read: true });
    });
    await batch.commit();
  };
  
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
        batch.delete(doc(db, "notifications", id));
    });
    
    try {
        await batch.commit();
        toast({ title: "Success", description: `${selectedIds.size} notification(s) deleted.` });
        setSelectedIds(new Set());
    } catch (error) {
        toast({ title: "Error", description: "Failed to delete selected notifications.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
        setIsDeleteDialogOpen(false);
    }
  };

  const { paginatedItems, totalPages, paginatedIds } = useMemo(() => {
    const firstPageIndex = (currentPage - 1) * itemsPerPage;
    const lastPageIndex = firstPageIndex + itemsPerPage;
    const items = notifications.slice(firstPageIndex, lastPageIndex);
    return {
      paginatedItems: items,
      totalPages: Math.ceil(notifications.length / itemsPerPage),
      paginatedIds: items.map(n => n.id),
    };
  }, [notifications, currentPage, itemsPerPage]);

  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1) };
  const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1) };

  const handleRowSelect = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };
  
  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
        setSelectedIds(new Set([...selectedIds, ...paginatedIds]));
    } else {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            paginatedIds.forEach(id => newSet.delete(id));
            return newSet;
        });
    }
  };
  
  const hasUnread = notifications.some(n => !n.read);
  const isAllOnPageSelected = paginatedIds.length > 0 && paginatedIds.every(id => selectedIds.has(id));

  if (isLoadingAuth) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            All Notifications
          </h1>
          <p className="text-muted-foreground">
            View, track, and manage every notification sent or received within your property’s system, including booking updates, guest messages, payment alerts, housekeeping tasks, and system-generated notices.
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
             <CardTitle>Notification Feed</CardTitle>
             <Button onClick={handleMarkAllAsRead} disabled={!hasUnread || isLoading} variant="link" size="sm">
               Mark all as read
             </Button>
          </div>
          <CardDescription>Select notifications to perform bulk actions or click to view details.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 p-3 mb-4 bg-muted/50 border rounded-lg">
                <p className="text-sm font-medium">{selectedIds.size} selected</p>
                <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Icons.Trash className="mr-2 h-4 w-4" />
                    Delete Selected
                </Button>
            </div>
          )}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Icons.Spinner className="h-8 w-8 animate-spin" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-1 border rounded-md">
              <div className="flex items-center p-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={isAllOnPageSelected}
                  onCheckedChange={(checked) => handleSelectAllOnPage(Boolean(checked))}
                  className="mx-2"
                />
                <label htmlFor="select-all" className="text-sm font-medium">Select all on page</label>
              </div>
              {paginatedItems.map((notification, index) => (
                <div 
                  key={notification.id}
                  className={cn(
                    "flex items-center gap-4 p-2 transition-colors border-b last:border-b-0",
                    !notification.read && "bg-blue-50 dark:bg-blue-900/20",
                    selectedIds.has(notification.id) && "bg-blue-100 dark:bg-blue-900/40"
                  )}
                >
                  <Checkbox
                    id={`select-${notification.id}`}
                    checked={selectedIds.has(notification.id)}
                    onCheckedChange={() => handleRowSelect(notification.id)}
                    className="mx-2"
                  />
                  <div className="flex-grow cursor-pointer" onClick={() => handleNotificationClick(notification)}>
                    <div className="flex items-start gap-3">
                        <NotificationIcon type={notification.type} />
                        <div className="flex-grow">
                          <p className="font-semibold text-sm">{notification.title}</p>
                          <p className="text-sm text-muted-foreground">{notification.description}</p>
                          <p className="text-xs text-muted-foreground/80 mt-1">
                            {formatDistanceToNow((notification.createdAt as Timestamp).toDate(), { addSuffix: true })}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2.5 w-2.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" aria-label="Unread"></div>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center bg-muted/50 rounded-md">
                <Icons.Notification className="w-16 h-16 text-muted-foreground" data-ai-hint="notification bell"/>
                <p className="mt-4 font-semibold">No notifications yet</p>
                <p className="text-sm text-muted-foreground">New activity from your property will appear here.</p>
            </div>
          )}
        </CardContent>
         {totalPages > 1 && (
          <CardFooter className="flex items-center justify-end space-x-6 p-4 border-t">
              <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                      value={`${itemsPerPage}`}
                      onValueChange={(value) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                      }}
                  >
                      <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={`${itemsPerPage}`} />
                      </SelectTrigger>
                      <SelectContent side="top">
                          {[10, 25, 50, 100].map((pageSize) => (
                              <SelectItem key={pageSize} value={`${pageSize}`}>
                                  {pageSize}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next</Button>
              </div>
          </CardFooter>
        )}
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedIds.size} notification(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} disabled={isProcessing}>
                {isProcessing && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
