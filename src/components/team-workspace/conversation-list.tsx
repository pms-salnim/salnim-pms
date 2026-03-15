
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, doc } from 'firebase/firestore';
import type { StaffMember } from '@/types/staff';
import type { Conversation } from '@/types/conversation';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Icons } from '../icons';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Paperclip } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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


interface ConversationListProps {
  onSelectConversation: (conversationId: string | null) => void;
}

interface DisplayListItem {
    id: string;
    type: 'conversation' | 'staff';
    name: string;
    profilePicture?: string;
    subtext: string;
    timestamp: Date | null;
    unreadCount?: number;
    hasAttachment?: boolean;
}

export default function ConversationList({ onSelectConversation }: ConversationListProps) {
  const { user } = useAuth();
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user?.propertyId) return;
    setIsLoading(true);

    const staffQuery = query(collection(db, "staff"), where("propertyId", "==", user.propertyId));
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember));
      setAllStaff(staffList);
    });

    const convQuery = query(
      collection(db, "conversations"),
      where("property_id", "==", user.propertyId),
      where("participants", "array-contains", user.id),
      orderBy("updatedAt", "desc")
    );
    const unsubConv = onSnapshot(convQuery, (snapshot) => {
      const convList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      setConversations(convList);
      setIsLoading(false);
    });

    return () => {
      unsubStaff();
      unsubConv();
    };
  }, [user?.id, user?.propertyId]);

  const handleSelect = async (staffMember: StaffMember) => {
    if (!user) return;
    if (user.id === staffMember.id) return;

    const existingConversation = conversations.find(c => 
        c.participants.length === 2 && 
        c.participants.includes(user.id) && 
        c.participants.includes(staffMember.id)
    );

    if (existingConversation) {
        onSelectConversation(existingConversation.id);
        setActiveConversationId(existingConversation.id);
    } else {
        const currentUserAsStaff = allStaff.find(s => s.id === user.id);
        const newConversationData = {
            participants: [user.id, staffMember.id],
            participantDetails: {
                [user.id]: { 
                    fullName: user.name || 'User',
                    profilePicture: currentUserAsStaff?.profile_picture || '' 
                },
                [staffMember.id]: { 
                    fullName: staffMember.fullName || 'Staff',
                    profilePicture: staffMember.profile_picture || ''
                }
            },
            property_id: user.propertyId,
            unreadCounts: {
                [user.id]: 0,
                [staffMember.id]: 0,
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'conversations'), newConversationData);
        onSelectConversation(docRef.id);
        setActiveConversationId(docRef.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
        setConversationToDelete(conversation);
        setIsDeleteDialogOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!conversationToDelete) return;
    setIsDeleting(true);
    try {
        const functions = getFunctions(app, 'europe-west1');
        const deleteConversation = httpsCallable(functions, 'deleteConversation');
        await deleteConversation({ conversationId: conversationToDelete.id });
        toast({ title: "Conversation Deleted" });
        if (activeConversationId === conversationToDelete.id) {
            onSelectConversation(null);
            setActiveConversationId(null);
        }
    } catch (error: any) {
        console.error("Error deleting conversation:", error);
        toast({ title: "Error", description: error.message || "Could not delete conversation.", variant: "destructive" });
    } finally {
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
        setConversationToDelete(null);
    }
  };

  const displayList = useMemo(() => {
    const participantIdsInConversations = new Set(
      conversations.flatMap(c => c.participants)
    );
    
    const conversationItems: DisplayListItem[] = conversations.map(c => {
      const otherParticipantId = c.participants.find(p => p !== user?.id);
      if (!otherParticipantId) return null;
      const details = c.participantDetails[otherParticipantId];
      const unreadCount = c.unreadCounts?.[user?.id || ''] || 0;
      return {
        id: c.id,
        type: 'conversation',
        name: details?.fullName || 'Unknown User',
        profilePicture: details?.profilePicture,
        subtext: c.lastMessage?.text || 'No messages yet.',
        timestamp: c.updatedAt?.toDate() || (c.createdAt ? c.createdAt.toDate() : null),
        unreadCount,
        hasAttachment: c.lastMessage?.hasAttachment || false,
      };
    }).filter((item): item is DisplayListItem => item !== null);

    const staffItems: DisplayListItem[] = allStaff
      .filter(s => s.id !== user?.id && !participantIdsInConversations.has(s.id))
      .map(s => ({
        id: s.id,
        type: 'staff',
        name: s.fullName,
        profilePicture: s.profile_picture,
        subtext: s.role,
        timestamp: null,
      }));

    const combinedList = [...conversationItems, ...staffItems];

    if (!searchTerm) {
      return { conversationItems, staffItems };
    }

    const filtered = combinedList.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return {
        conversationItems: filtered.filter(i => i.type === 'conversation'),
        staffItems: filtered.filter(i => i.type === 'staff'),
    };
  }, [conversations, allStaff, user?.id, searchTerm]);

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <Input 
              placeholder="Search or start new chat..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
              <div className="flex justify-center items-center h-full">
                  <Icons.Spinner className="h-6 w-6 animate-spin" />
              </div>
          ) : (
              <div className="p-2 space-y-1">
                  {displayList.conversationItems.length > 0 && (
                      <div className="space-y-1">
                          <h4 className="px-2 py-1 text-xs font-semibold text-muted-foreground">Conversations</h4>
                          {displayList.conversationItems.map(item => {
                              const handleClick = () => {
                                  onSelectConversation(item.id);
                                  setActiveConversationId(item.id);
                              };
                              return (
                                  <div key={item.id} onClick={handleClick} className={cn("group flex items-center gap-3 p-2 rounded-lg cursor-pointer", activeConversationId === item.id ? "bg-muted" : "hover:bg-muted/50")}>
                                      <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={item.profilePicture} alt={item.name} /><AvatarFallback>{item.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{item.name}</p>
                                        <div className="flex items-center gap-1">
                                            {item.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                                            <p className="text-xs text-muted-foreground truncate">{item.subtext}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <div className="flex flex-col items-end gap-1">
                                            {item.timestamp && <p className="text-xs text-muted-foreground self-start whitespace-nowrap">{formatDistanceToNow(item.timestamp, { addSuffix: true })}</p>}
                                            {item.unreadCount && item.unreadCount > 0 && (
                                                <Badge className="h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground">{item.unreadCount}</Badge>
                                            )}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0" onClick={e => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent onClick={e => e.stopPropagation()}>
                                                <DropdownMenuItem className="text-destructive" onClick={(e) => handleDeleteClick(e, item.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Conversation
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
                  {displayList.staffItems.length > 0 && (
                      <div className="space-y-1 pt-2">
                          <Separator />
                          <h4 className="px-2 py-1 text-xs font-semibold text-muted-foreground pt-2">All Staff</h4>
                          {displayList.staffItems.map(item => {
                            const handleClick = () => {
                                  const staffMember = allStaff.find(s => s.id === item.id);
                                  if (staffMember) handleSelect(staffMember);
                            };
                            return (
                                  <div key={item.id} onClick={handleClick} className={cn("flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50")}>
                                      <Avatar className="h-10 w-10"><AvatarImage src={item.profilePicture} alt={item.name} /><AvatarFallback>{item.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                                      <div className="flex-1 truncate"><p className="font-semibold text-sm">{item.name}</p><p className="text-xs text-muted-foreground capitalize">{item.subtext}</p></div>
                                  </div>
                            )
                          })}
                      </div>
                  )}
              </div>
          )}
        </ScrollArea>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the entire conversation and all its messages. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
                    {isDeleting && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
