"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icons } from '@/components/icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, RefreshCw, Paperclip, Send, ExternalLink, Smile, Bot, Search, Filter, Clock, X, Plus, Pin, PinOff, Trash } from 'lucide-react';
import { collection, query as firestoreQuery, orderBy, limit as firestoreLimit, getDocs, where } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { doc as firestoreDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { format, isToday, isYesterday } from 'date-fns';
import { GuestPortalConversation, GuestPortalMessage } from './types';

const fetchApi = async (payload: any) => {
  if (!auth.currentUser) return null;
  try {
    const res = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, authToken: await auth.currentUser.getIdToken() })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => null);
      console.warn('fetchApi non-ok response', { status: res.status, statusText: res.statusText, body: text });
      return null;
    }
    try {
      return await res.json();
    } catch (err) {
      console.warn('fetchApi failed to parse JSON', err);
      return null;
    }
  } catch (err) {
    console.warn('fetchApi network/error', err);
    return null;
  }
};

type StatusFilter = 'all' | 'checked-in' | 'confirmed' | 'checked-out';

export default function GuestPortalChatView({ statusFilter = 'all' }: { statusFilter?: StatusFilter }) {
  const { user, property } = useAuth();
  const [conversations, setConversations] = useState<GuestPortalConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<GuestPortalConversation | null>(null);
  const [messages, setMessages] = useState<GuestPortalMessage[]>([]);
  const [conversationMessages, setConversationMessages] = useState<{[key: string]: GuestPortalMessage[]}>({});
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastMessageCheck, setLastMessageCheck] = useState<Date>(new Date());
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const [isConversationJustOpened, setIsConversationJustOpened] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSeenMessageIdRef = useRef<string | null>(null);

  const scrollToBottom = (force = false) => {
    // Only scroll if:
    // 1. Explicitly forced (user action like sending message or clicking indicator)
    // 2. User is already at bottom AND conversation was just opened
    if (!force && !isConversationJustOpened) {
      return;
    }
    
    // Use requestAnimationFrame to ensure the DOM has updated
    requestAnimationFrame(() => {
      if (messagesEndRef.current && scrollAreaRef.current) {
        // Scroll within the ScrollArea viewport, not the whole page
        const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollArea) {
          scrollArea.scrollTop = scrollArea.scrollHeight;
          setIsAtBottom(true);
          setUnseenMessageCount(0);
          // update last seen id to the latest message
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.id) lastSeenMessageIdRef.current = lastMsg.id;
        } else {
          // Fallback: scroll the messagesEndRef into view within its container
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end',
            inline: 'nearest'
          });
          setIsAtBottom(true);
          setUnseenMessageCount(0);
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.id) lastSeenMessageIdRef.current = lastMsg.id;
        }
      }
    });
  };

  const checkScrollPosition = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        const threshold = 100; // pixels from bottom to consider "at bottom"
        const scrollTop = scrollArea.scrollTop;
        const scrollHeight = scrollArea.scrollHeight;
        const clientHeight = scrollArea.clientHeight;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const atBottom = distanceFromBottom <= threshold;
        
        console.log('Scroll position check:', { scrollTop, scrollHeight, clientHeight, distanceFromBottom, atBottom, threshold });
        
        setIsAtBottom(atBottom);
        if (atBottom) {
          console.log('At bottom - clearing unseen count');
          setUnseenMessageCount(0);
        }
      }
    }
  }, []);

  const convertTimestamp = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    try {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate();
        return isNaN(date.getTime()) ? new Date() : date;
      }
      if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return isNaN(date.getTime()) ? new Date() : date;
      }
      if (timestamp._seconds) {
        const date = new Date(timestamp._seconds * 1000);
        return isNaN(date.getTime()) ? new Date() : date;
      }
      if (timestamp instanceof Date) {
        return isNaN(timestamp.getTime()) ? new Date() : timestamp;
      }
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      return new Date();
    }
  };

  const formatDateLabel = (timestamp: any) => {
    const date = convertTimestamp(timestamp);
    let label = format(date, 'dd/MM/yyyy');
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    const time = format(date, 'h:mm a');
    return { label, time };
  };

  const formatSnippetTime = (timestamp: any) => {
    const date = convertTimestamp(timestamp);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  const sortMessages = (msgs: any[] = []) => {
    return msgs.slice().sort((a: any, b: any) => {
      const ta = Number(a?.timestampMs ?? convertTimestamp(a?.timestamp).getTime() ?? 0);
      const tb = Number(b?.timestampMs ?? convertTimestamp(b?.timestamp).getTime() ?? 0);
      if (ta === tb) {
        const ia = String(a?.id || '');
        const ib = String(b?.id || '');
        if (ia < ib) return -1;
        if (ia > ib) return 1;
        return 0;
      }
      return ta - tb; // oldest first
    });
  };

  const sortConversationsByRecent = (convs: any[] = []) => {
    return convs.slice().sort((a: any, b: any) => {
      // Pinned first
      const pa = a?.pinned ? 1 : 0;
      const pb = b?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = Number(a?.lastMessageTimestampMs ?? a?.lastMessage?.timestampMs ?? (a?.lastMessage ? convertTimestamp(a.lastMessage.timestamp).getTime() : (a?.updatedAt ? convertTimestamp(a.updatedAt).getTime() : (a?.createdAt ? convertTimestamp(a.createdAt).getTime() : 0))));
      const tb = Number(b?.lastMessageTimestampMs ?? b?.lastMessage?.timestampMs ?? (b?.lastMessage ? convertTimestamp(b.lastMessage.timestamp).getTime() : (b?.updatedAt ? convertTimestamp(b.updatedAt).getTime() : (b?.createdAt ? convertTimestamp(b.createdAt).getTime() : 0))));
      if (ta === tb) {
        const ia = String(a?.id || '');
        const ib = String(b?.id || '');
        if (ia < ib) return -1;
        if (ia > ib) return 1;
        return 0;
      }
      return tb - ta; // most recent first
    });
  };

  const loadConversations = useCallback(async () => {
    if (!user || !property) return;
    setIsLoading(true);
    const result = await fetchApi({ action: 'getConversations', data: { propertyId: property.id } });
    const fetchedConversations = result?.conversations || [];
    // Enrich conversations with reservationNumber where possible
    const enrich = async (convs: any[]) => {
      return await Promise.all(convs.map(async (c: any) => {
        try {
          if (c.reservationId) {
            const info = await getReservationInfo(c.reservationId);
            return { ...c, reservationNumber: info.reservationNumber || c.reservationNumber, reservationStatus: info.reservationStatus || c.reservationStatus };
          }
        } catch (err) {
          console.warn('Failed to load reservation for conversation', c.id, err);
        }
        return { ...c };
      }));
    };

    const enriched = await enrich(fetchedConversations);
    setConversations(sortConversationsByRecent(enriched));
    
    // Load last message for each conversation for preview
    const messageMap: {[key: string]: GuestPortalMessage[]} = {};
    for (const conv of fetchedConversations) {
      try {
        const messagesResult = await fetchApi({ 
          action: 'getMessages', 
          data: { conversationId: conv.id, propertyId: property.id, limit: 1 } 
        });
        if (messagesResult?.messages?.length > 0) {
          messageMap[conv.id] = messagesResult.messages;
        }
      } catch (err) {
        // ignore individual failures
      }
    }
    setConversationMessages(messageMap);
    setIsLoading(false);
  }, [user, property]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user || !property) return;
    const result = await fetchApi({ action: 'getMessages', data: { conversationId, propertyId: property.id } });
    setMessages(sortMessages(result?.messages || []));
    // Only scroll to bottom if conversation was just opened
    if (isConversationJustOpened) {
      setTimeout(() => {
        scrollToBottom(true);
        // Clear the "just opened" flag after initial scroll
        setTimeout(() => setIsConversationJustOpened(false), 500);
      }, 100);
    }
    // Initialize last seen id to the last message when loading conversation
    const msgs = result?.messages || [];
    const last = msgs[msgs.length - 1];
    lastSeenMessageIdRef.current = last?.id || null;
  }, [user, property, isConversationJustOpened]);

  const checkForNewMessages = useCallback(async () => {
    if (!user || !property) return;
    
    try {
      // Check for updated conversations (which includes unread counts)
      const result = await fetchApi({ 
        action: 'getConversations', 
        data: { propertyId: property.id } 
      });
      
      if (result?.conversations) {
        let updatedConversations = result.conversations;
        // Enrich updated conversations with reservationNumber
        try {
          updatedConversations = await Promise.all((updatedConversations || []).map(async (c: any) => {
                try {
                  if (c.reservationId) {
                    const info = await getReservationInfo(c.reservationId);
                    return { ...c, reservationNumber: info.reservationNumber || c.reservationNumber, reservationStatus: info.reservationStatus || c.reservationStatus };
                  }
                } catch (err) {
                  console.warn('Failed to enrich conversation reservation', c.id, err);
                }
            return { ...c };
          }));
        } catch (err) {
          console.warn('Failed to enrich updated conversations', err);
        }
        
        // Merge updatedConversations with current state to avoid overwriting live reservationStatus
        setConversations(prev => {
          const merged = (updatedConversations || []).map((uc: any) => {
            const existing = prev.find(p => p.id === uc.id) || {};
            return {
              ...existing,
              ...uc,
              reservationNumber: uc.reservationNumber || existing.reservationNumber,
              reservationStatus: uc.reservationStatus || existing.reservationStatus,
            };
          });
          const sorted = sortConversationsByRecent(merged);
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(sorted);
          if (hasChanges) {
            setLastMessageCheck(new Date());
            return sorted;
          }
          return prev;
        });
        
        // If currently viewing a conversation, refresh its messages
        if (selectedConversation) {
          const updatedConv = updatedConversations.find((c: any) => c.id === selectedConversation.id);
          if (updatedConv) {
            // Check if there might be new messages by comparing timestamps or counts
            const shouldRefreshMessages = true; // Always refresh for now to ensure real-time updates
            
            if (shouldRefreshMessages) {
              const messagesResult = await fetchApi({ 
                action: 'getMessages', 
                data: { conversationId: selectedConversation.id, propertyId: property.id } 
              });
              
              if (messagesResult?.messages) {
                const newMessages = sortMessages(messagesResult.messages);
                
                // Check current scroll position before updating messages
                let currentIsAtBottom = isAtBottom;
                if (scrollAreaRef.current) {
                  const scrollArea = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
                  if (scrollArea) {
                    const threshold = 100;
                    const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
                    currentIsAtBottom = distanceFromBottom <= threshold;
                    console.log('🔍 Polling scroll check:', { distanceFromBottom, currentIsAtBottom, threshold });
                  }
                }
                
                setMessages(prev => {
                  // Compare arrays to detect any changes
                  const messagesChanged = JSON.stringify(prev) !== JSON.stringify(newMessages);
                  const lengthIncreased = newMessages.length > prev.length;
                  const newMessageCount = newMessages.length - prev.length;
                  
                  console.log('📱 Real message polling check:', {
                    messagesChanged,
                    lengthIncreased,
                    prevLength: prev.length,
                    newLength: newMessages.length,
                    newMessageCount,
                    currentIsAtBottom,
                    isConversationJustOpened
                  });
                  
                  if (messagesChanged) {
                    console.log('🔄 Real messages changed - updating conversation view');
                    
                    // Determine how many truly new messages arrived since lastSeen
                    let realNewMessageCount = 0;
                    const lastSeenId = lastSeenMessageIdRef.current;
                    if (lengthIncreased) {
                      // If length increased, compute difference based on lastSeenId if available
                      if (lastSeenId) {
                        const lastIndex = newMessages.findIndex(m => m.id === lastSeenId);
                        if (lastIndex >= 0) {
                          realNewMessageCount = newMessages.length - (lastIndex + 1);
                        } else {
                          // fallback to length diff
                          realNewMessageCount = newMessageCount;
                        }
                      } else {
                        realNewMessageCount = newMessageCount;
                      }
                      console.log('📈 Length increased - computed new messages:', realNewMessageCount);
                    } else if (newMessages.length === prev.length && newMessages.length > 0) {
                      // Same length but content changed - check if the last message id changed
                      const lastOld = prev[prev.length - 1];
                      const lastNew = newMessages[newMessages.length - 1];
                      if (lastOld?.id !== lastNew?.id) {
                        realNewMessageCount = 1;
                        console.log('🆕 Last message ID changed - treating as new message');
                      }
                    }

                    if (realNewMessageCount > 0) {
                      console.log('🔥 REAL NEW MESSAGES DETECTED:', realNewMessageCount);
                      // Use the current scroll position we just checked
                      if (!currentIsAtBottom && !isConversationJustOpened) {
                        console.log('✅ Real messages + user scrolled up - incrementing unseen count by:', realNewMessageCount);
                        setUnseenMessageCount(count => {
                          const newCount = count + realNewMessageCount;
                          console.log('📈 Real messages - Unseen count updated from', count, 'to', newCount);
                          return newCount;
                        });
                      } else {
                        console.log('⬇️ Real messages + user at bottom - not incrementing unseen count');
                        // If user at bottom, update lastSeen to newest
                        const lastNew = newMessages[newMessages.length - 1];
                        if (lastNew?.id) lastSeenMessageIdRef.current = lastNew.id;
                      }
                    }
                    
                    return newMessages;
                  }
                  
                  return prev;
                });
              }
            }
          }
        }
        
        // Also update conversation-specific messages for previews (fetch latest message for each updated conversation)
        const messageMap: {[key: string]: any[]} = {};
        for (const conv of updatedConversations) {
          try {
            const messagesResult = await fetchApi({ 
              action: 'getMessages', 
              data: { conversationId: conv.id, propertyId: property.id, limit: 1 } 
            });
            if (messagesResult?.messages?.length > 0) {
              messageMap[conv.id] = messagesResult.messages;
            }
          } catch (error) {
            // Silently continue if individual conversation fails
            console.warn(`Failed to load messages for conversation ${conv.id}:`, error);
          }
        }
        
        setConversationMessages(prev => {
          const hasMessageChanges = JSON.stringify(prev) !== JSON.stringify(messageMap);
          return hasMessageChanges ? { ...prev, ...messageMap } : prev;
        });
      }
    } catch (error) {
      // Silently handle errors to avoid spamming console
      // Only log if it's not a "Request failed" error (which might be expected)
      if (error instanceof Error && !error.message.includes('Request failed')) {
        console.warn('Failed to check for new messages:', error);
      }
    }
  }, [user, property, selectedConversation, scrollToBottom]);

  useEffect(() => {
    // Set up real-time polling every 3 seconds
    const interval = setInterval(checkForNewMessages, 3000);
    return () => clearInterval(interval);
  }, [checkForNewMessages]);

  // Set up scroll listener
  useEffect(() => {
    const scrollArea = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollArea) {
      scrollArea.addEventListener('scroll', checkScrollPosition);
      return () => scrollArea.removeEventListener('scroll', checkScrollPosition);
    }
  }, [selectedConversation, checkScrollPosition]);

  const handleConversationSelect = async (conversation: GuestPortalConversation) => {
    setSelectedConversation(conversation);
    setIsConversationJustOpened(true);
    setIsAtBottom(true);
    setUnseenMessageCount(0);
    
    // Mark conversation as read if it has unread messages
    if (conversation.unreadCount > 0) {
      // Update local state immediately for better UX
      setConversations(prev => 
        prev.map(c => 
          c.id === conversation.id 
            ? { ...c, unreadCount: 0 }
            : c
        )
      );
      
      // Make API call to mark as read on server
      try {
        await fetchApi({ 
          action: 'markAsRead', 
          data: { 
            conversationId: conversation.id, 
            propertyId: property?.id 
          } 
        });
      } catch (error) {
        console.error('Failed to mark conversation as read:', error);
      }
    }
  };

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversation) return;
    // If this is a local placeholder (not yet created on server), don't attempt to fetch messages
    if (typeof selectedConversation.id === 'string' && selectedConversation.id.startsWith('local-')) return;
    loadMessages(selectedConversation.id);
    // Don't use loadMessages for polling as it forces scroll
    // The checkForNewMessages function handles real-time updates
  }, [selectedConversation, loadMessages]);

  const validateFile = (file: File) => {
    const max = 10 * 1024 * 1024;
    const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.size > max) return 'File size must not exceed 10MB';
    if (!ok.includes(file.type)) return 'Only PDF and images are allowed';
    return null;
  };

  const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file);
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; const err = validateFile(f); if (err) return toast({ title: 'Invalid file', description: err, variant: 'destructive' }); setSelectedFile(f);
  };

  const handleSendFile = async () => {
    if (!selectedFile || !selectedConversation) return; setSending(true);
      try {
        const dataUrl = await toDataUrl(selectedFile);
        const result = await fetchApi({ action: 'sendMessage', data: { conversationId: selectedConversation.id, message: '', propertyId: property?.id, fileAttachment: { fileName: selectedFile.name, fileType: selectedFile.type, fileSize: selectedFile.size, fileData: dataUrl } } });
        if (result?.message) setMessages((m) => sortMessages([...m, result.message]));
      setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => scrollToBottom(true), 100);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to send file', variant: 'destructive' });
    } finally { setSending(false); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;
    setSending(true);

    // If conversation is a local placeholder, attempt to create it on the server first
    let convId = selectedConversation.id;
    if (typeof convId === 'string' && convId.startsWith('local-')) {
      try {
        const res = await fetchApi({ action: 'startConversation', data: { propertyId: property?.id, reservationId: selectedConversation.reservationId, source: 'communication' } });
        const conv = res?.conversation;
        if (conv) {
          // enrich and replace local conversation in state
          const info = await getReservationInfo(selectedConversation.reservationId);
          const final = { ...conv, reservationNumber: info.reservationNumber || selectedConversation.reservationNumber, reservationStatus: info.reservationStatus || selectedConversation.reservationStatus };
          setConversations(prev => [final, ...prev.filter(p => p.id !== final.id && p.id !== selectedConversation.id)]);
          setSelectedConversation(final);
          convId = final.id;
        } else {
          // couldn't create on server - add a local pending message and bail
          const pending = {
            id: `local-msg-${Date.now()}`,
            message: newMessage.trim(),
            senderType: 'property',
            timestamp: new Date(),
            timestampMs: Date.now(),
            pending: true
          } as any;
          setMessages(m => sortMessages([...m, pending]));
          setNewMessage('');
          setSending(false);
          setTimeout(() => scrollToBottom(true), 100);
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          return;
        }
      } catch (err) {
        console.warn('Failed to create conversation before send', err);
      }
    }

    // Now send message if we have a server conversation id
    if (convId && !String(convId).startsWith('local-')) {
      const result = await fetchApi({ action: 'sendMessage', data: { conversationId: convId, message: newMessage.trim(), propertyId: property?.id } });
      if (result?.message) {
        setMessages((m) => sortMessages([...m, result.message]));
        setNewMessage('');
        setTimeout(() => scrollToBottom(true), 100);
      } else {
        // If send failed, add pending message locally
        const pending = {
          id: `local-msg-${Date.now()}`,
          message: newMessage.trim(),
          senderType: 'property',
          timestamp: new Date(),
          timestampMs: Date.now(),
          pending: true
        } as any;
        setMessages(m => sortMessages([...m, pending]));
        setNewMessage('');
        setTimeout(() => scrollToBottom(true), 100);
      }
    }

    setSending(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim().toLowerCase() === 'exit') {
        setSelectedConversation(null);
        setNewMessage('');
        return;
      }
      handleSendMessage();
    }
  };

  // Search state for conversations
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationItemsPerPage, setConversationItemsPerPage] = useState(15);
  const [conversationPage, setConversationPage] = useState(1);

  // New message modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [recentReservations, setRecentReservations] = useState<any[]>([]);
  const [reservationSearch, setReservationSearch] = useState('');

  const matchesSearch = (c: any, q: string) => {
    if (!q) return true;
    const s = q.trim().toLowerCase();
    const parts = [c.guestName, c.roomName, c.roomType, c.reservationNumber].filter(Boolean).map((v: any) => String(v).toLowerCase());
    return parts.some(p => p.includes(s));
  };

  const normalizeStatus = (s: any) => {
    if (!s) return '';
    const str = String(s).toLowerCase();
    if (str.includes('checked') && str.includes('in')) return 'checked-in';
    if (str.includes('checked') && str.includes('out')) return 'checked-out';
    if (str.includes('confirm')) return 'confirmed';
    return str.replace(/[_\s]+/g, '-');
  };

  // Cache for reservation info (number + status) to avoid repeated Firestore reads
  const reservationCacheRef = useRef<Map<string, { reservationNumber: string | null; reservationStatus: string | null }>>(new Map());

  const getReservationInfo = async (reservationId?: string) => {
    if (!reservationId) return { reservationNumber: null, reservationStatus: null };
    const cache = reservationCacheRef.current;
    if (cache.has(reservationId)) return cache.get(reservationId) || { reservationNumber: null, reservationStatus: null };
    try {
      const rDoc = await getDoc(firestoreDoc(db, 'reservations', reservationId));
      if (rDoc.exists()) {
        const data: any = rDoc.data();
        const num = data?.reservationNumber || data?.reservationId || reservationId;
        const status = data?.status || data?.reservationStatus || null;
        const info = { reservationNumber: num, reservationStatus: status };
        cache.set(reservationId, info);
        return info;
      }
    } catch (err) {
      console.warn('Failed to fetch reservation', reservationId, err);
    }
    const empty = { reservationNumber: null, reservationStatus: null };
    cache.set(reservationId, empty);
    return empty;
  };

  const fetchRecentReservations = useCallback(async () => {
    if (!property) return;
    try {
      const c = collection(db, 'reservations');
      const q = firestoreQuery(c, where('propertyId', '==', property.id), orderBy('createdAt', 'desc'), firestoreLimit(10));
      const snap = await getDocs(q);
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setRecentReservations(items);
    } catch (err) {
      console.warn('Failed to fetch recent reservations', err);
      setRecentReservations([]);
    }
  }, [property]);

  useEffect(() => {
    if (isNewModalOpen) fetchRecentReservations();
  }, [isNewModalOpen, fetchRecentReservations]);

  useEffect(() => {
    setConversationPage(1);
  }, [searchQuery, statusFilter]);

  const matchesReservationSearch = (r: any, q: string) => {
    if (!q) return true;
    const s = q.trim().toLowerCase();
    const parts = [r.guestFullName || r.guestName || `${r.guestFirstName || ''} ${r.guestLastName || ''}`, r.roomNumber || r.roomName || r.roomType, r.roomType, r.reservationNumber].filter(Boolean).map((v:any) => String(v).toLowerCase());
    return parts.some(p => p.includes(s));
  };

  const handleStartConversation = async (reservation: any) => {
    if (!property) return;
    // If a conversation already exists for this reservation, open it instead
    const existingConv = conversations.find(c => c.reservationId === reservation.id || (reservation.reservationNumber && c.reservationNumber === reservation.reservationNumber));
    if (existingConv) {
      setSelectedConversation(existingConv);
      setIsNewModalOpen(false);
      // Load messages for existing conversation if it has a server id
      try { if (existingConv.id) await loadMessages(existingConv.id); } catch (err) { /* ignore */ }
      return;
    }

    try {
      // Attempt to start conversation on server; include source so backend knows origin
      const res = await fetchApi({ action: 'startConversation', data: { propertyId: property.id, reservationId: reservation.id, source: 'communication' } });
      const conv = res?.conversation;
      if (conv) {
        // If server returned a conversation that matches an existing local one, open the local one
        const already = conversations.find(c => c.id === conv.id || c.reservationId === conv.reservationId || (conv.reservationNumber && c.reservationNumber === conv.reservationNumber));
        if (already) {
          setSelectedConversation(already);
          setIsNewModalOpen(false);
          try { if (already.id) await loadMessages(already.id); } catch (err) { /* ignore */ }
          return;
        }
        // enrich with known reservation info
        const info = await getReservationInfo(reservation.id);
        const final = { ...conv, reservationNumber: info.reservationNumber || reservation.reservationNumber, reservationStatus: info.reservationStatus || reservation.status || reservation.reservationStatus };
        setConversations(prev => [final, ...prev.filter(p => p.id !== final.id)]);
        setSelectedConversation(final);
        setIsNewModalOpen(false);
        // load messages for new conversation
        if (final.id) loadMessages(final.id);
        return;
      }
    } catch (err) {
      console.warn('Failed to create conversation via API, falling back to local open', err);
    }

    // Fallback: open a local conversation object (server may create later)
    const localConv = {
      id: `local-${reservation.id}`,
      guestName: reservation.guestFullName || reservation.guestName || `${reservation.guestFirstName || ''} ${reservation.guestLastName || ''}`.trim() || 'Guest',
      reservationId: reservation.id,
      reservationNumber: reservation.reservationNumber || null,
      reservationStatus: reservation.status || reservation.reservationStatus || null,
      roomName: reservation.roomNumber || reservation.roomName || '',
      roomType: reservation.roomType || '',
      unreadCount: 0,
    };
    setConversations(prev => [localConv, ...prev.filter(p => p.id !== localConv.id)]);
    setSelectedConversation(localConv);
    setIsNewModalOpen(false);
  };

  const handleTogglePinned = async (conv: any) => {
    try {
      const desired = !conv.pinned;
      const res = await fetchApi({ action: 'setPinned', data: { conversationId: conv.id, propertyId: property?.id, pinned: desired } });
      if (res && res.success !== false) {
        setConversations(prev => sortConversationsByRecent(prev.map(c => c.id === conv.id ? { ...c, pinned: desired } : c)));
      } else {
        toast({ title: 'Failed to update pin', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Could not update pin', variant: 'destructive' });
    }
  };

  const handleDeleteConversation = async (conv: any) => {
    try {
      if (!property?.id) return;
      const confirmed = window.confirm('Delete this conversation? This will archive it.');
      if (!confirmed) return;
      const res = await fetchApi({ action: 'deleteConversation', data: { conversationId: conv.id, propertyId: property.id } });
      if (res && res.success !== false) {
        setConversations(prev => prev.filter(c => c.id !== conv.id));
        if (selectedConversation?.id === conv.id) setSelectedConversation(null);
      } else {
        toast({ title: 'Failed to delete conversation', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Could not delete conversation', variant: 'destructive' });
    }
  };

  // Real-time listeners for reservation docs referenced by conversations
  useEffect(() => {
    // Build a unique list of reservationIds currently present in conversations
    const ids = Array.from(new Set(conversations.map(c => c.reservationId).filter(Boolean)));
    if (ids.length === 0) return;

    const unsubscribes: Array<() => void> = [];

        ids.forEach((id) => {
      try {
        const ref = firestoreDoc(db, 'reservations', id as string);
        const unsub = onSnapshot(ref, (snap) => {
          if (!snap.exists()) return;
          const data: any = snap.data();
          const num = data?.reservationNumber || data?.reservationId || id;
          const status = data?.status || data?.reservationStatus || null;

          // update cache with both number and status
          reservationCacheRef.current.set(id as string, { reservationNumber: num, reservationStatus: status });

          // update conversations in state to reflect latest reservation info
          setConversations(prev => prev.map(c => c.reservationId === id ? { ...c, reservationNumber: num, reservationStatus: status || c.reservationStatus } : c));
        }, (err) => {
          console.warn('Reservation listener error', id, err);
        });

        unsubscribes.push(unsub);
      } catch (err) {
        console.warn('Failed to subscribe to reservation', id, err);
      }
    });

    return () => unsubscribes.forEach(u => u());
  }, [JSON.stringify(conversations.map(c => c.reservationId).filter(Boolean).sort())]);

  // Ensure lists don't contain duplicate items with the same id (defensive)
  const uniqueConversations = conversations.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
  const uniqueMessages = messages.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);

  const filteredConversations = uniqueConversations
    .filter(c => {
      const status = normalizeStatus(c.reservationStatus);
      return statusFilter === 'all' ? true : status === statusFilter;
    })
    .filter(c => matchesSearch(c, searchQuery));

  const totalConversationPages = Math.max(1, Math.ceil(filteredConversations.length / conversationItemsPerPage));
  const safeConversationPage = Math.min(conversationPage, totalConversationPages);
  const pagedConversations = filteredConversations.slice(
    (safeConversationPage - 1) * conversationItemsPerPage,
    safeConversationPage * conversationItemsPerPage
  );

  if (isLoading) return <div className="flex items-center justify-center h-full"><Icons.Spinner className="h-8 w-8 animate-spin"/></div>;

  return (
    <div className="flex h-full bg-white text-slate-800 overflow-hidden relative">
      {/* CONVERSATION LIST */}
      <div className="w-96 border-r border-slate-200 flex flex-col bg-white h-full">
        <div className="p-4 border-b border-slate-100 space-y-4 bg-white z-20 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..." 
              className="w-full bg-slate-50 border border-slate-200 p-2.5 pl-10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Guest Portal Messages
            </h3>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={loadConversations} className="p-1 hover:bg-slate-50 rounded text-slate-400">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button onClick={() => setIsNewModalOpen(true)} className="bg-[#003166] text-white text-xs px-3 py-2 rounded-xl font-bold hover:opacity-95">New Message</Button>
              <button className="p-1 hover:bg-slate-50 rounded text-slate-400">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-slate-50">
            {pagedConversations.map(c => {
              // Get last message for preview: prefer server-side conversation.lastMessage (authoritative), fallback to fetched preview
              const lastMessage = c.lastMessage
                ? { message: c.lastMessage.text, timestamp: c.lastMessage.timestamp, senderType: c.lastMessage.senderType } as any
                : (conversationMessages[c.id]?.[conversationMessages[c.id].length - 1] || null);
              const hasUnread = c.unreadCount > 0; // Assuming conversations have unreadCount property
              
              return (
                <div 
                  key={`conv-${c.id}`} 
                  onClick={() => handleConversationSelect(c)} 
                  className={`p-5 cursor-pointer hover:bg-slate-50 transition-colors relative ${selectedConversation?.id === c.id ? 'bg-slate-50' : ''} ${hasUnread ? 'bg-orange-50/30' : ''}`}
                >
                  {/* Unread indicator */}
                  {hasUnread && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#ea580c] rounded-r-full" />}
                  
                  <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm font-bold ${hasUnread && c.lastMessage?.senderType === 'guest' ? 'text-blue-600' : (hasUnread ? 'text-slate-900' : 'text-slate-600')}`}>
                              {c.guestName}
                            </span>
                    <div className="flex items-center gap-2">
                      {c.pinned && <span className="text-[10px] text-amber-600 font-bold">PINNED</span>}
                      <button
                        type="button"
                        aria-label={c.pinned ? 'Unpin conversation' : 'Pin conversation'}
                        onClick={(e) => { e.stopPropagation(); handleTogglePinned(c); }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400"
                      >
                        {c.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        aria-label="Delete conversation"
                        onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c); }}
                        className="p-1 rounded hover:bg-slate-100 text-red-500"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                      <div className="text-[10px] text-slate-400 text-right">
                        {lastMessage?.timestamp ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-400">{formatSnippetTime(lastMessage.timestamp)}</span>
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <p className={`text-xs font-semibold mb-1 truncate ${hasUnread && c.lastMessage?.senderType === 'guest' ? 'text-blue-600 font-bold' : (hasUnread ? 'text-slate-900' : 'text-slate-600')}`}>
                    {lastMessage?.message ||
                     (lastMessage?.fileAttachment ? `📎 ${lastMessage.fileAttachment.fileName}` : '') ||
                     (c.lastMessage?.text || 'No messages yet')}
                  </p>
                  
                  <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed mb-2">
                    {c.roomType} • {c.roomName}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded border ${
                        c.reservationStatus === 'checked-in' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        c.reservationStatus === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        c.reservationStatus === 'checked-out' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                        c.reservationStatus === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        c.reservationStatus === 'canceled' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {c.reservationStatus || 'pending'}
                      </span>
                      {hasUnread && (
                        <span className="bg-[#ea580c] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <MessageSquare className="w-3 h-3 text-slate-300" />
                  </div>
                </div>
              );
              })}
          </div>
        </ScrollArea>

        <div className="border-t border-slate-100 p-2 flex items-center justify-end space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Rows per page</span>
            <Select
              value={`${conversationItemsPerPage}`}
              onValueChange={(value) => {
                setConversationItemsPerPage(Number(value));
                setConversationPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={`${conversationItemsPerPage}`} />
              </SelectTrigger>
              <SelectContent side="top">
                {[15, 50, 10, 150].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-slate-500">Page {safeConversationPage} of {totalConversationPages}</span>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConversationPage(p => Math.max(1, p - 1))}
              disabled={safeConversationPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConversationPage(p => Math.min(totalConversationPages, p + 1))}
              disabled={safeConversationPage >= totalConversationPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* New Message Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 z-[200] bg-black/40" onClick={() => setIsNewModalOpen(false)} />
          <div className="relative z-[210] w-[720px] max-w-full bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">New Message</h3>
              <div className="flex items-center gap-2">
                <input value={reservationSearch} onChange={e => setReservationSearch(e.target.value)} placeholder="Search reservations..." className="px-3 py-2 border rounded-lg text-sm w-80" />
                <button onClick={() => { setReservationSearch(''); fetchRecentReservations(); }} className="px-3 py-2 bg-slate-50 rounded">Reset</button>
                <button onClick={() => setIsNewModalOpen(false)} className="px-3 py-2 text-slate-500">Close</button>
              </div>
            </div>

            <div className="max-h-96 overflow-auto">
              {recentReservations.filter(r => matchesReservationSearch(r, reservationSearch)).map(r => (
                <div key={`res-${r.id}`} className="flex items-center justify-between px-4 py-3 border-b hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 text-sm h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#003166]">{(r.guestFullName || r.guestName || (r.guestFirstName || '').charAt(0) || 'G').charAt(0)}</div>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold">{r.guestFullName || r.guestName || `${r.guestFirstName || ''} ${r.guestLastName || ''}`.trim() || 'Guest'}</span>
                      <span className="text-xs text-slate-400">{r.roomType || ''} • {r.roomNumber || r.roomName || ''} • {r.reservationNumber || ''}</span>
                    </div>
                  </div>
                  <div>
                    <button onClick={() => handleStartConversation(r)} className="flex items-center gap-2 bg-[#003166] text-white px-3 py-2 rounded-lg">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {recentReservations.filter(r => matchesReservationSearch(r, reservationSearch)).length === 0 && (
                <div className="p-6 text-center text-slate-400">No reservations found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE / CHAT VIEW */}
      <main className="flex-1 flex flex-col bg-slate-50/30 h-full overflow-hidden">
        {selectedConversation ? (
          <>
            {/* Header */}
            <header className="px-8 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-20 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#003166] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner">
                  {selectedConversation.guestName.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    {selectedConversation.guestName}
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Active</span>
                  </h2>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedConversation?.roomType || selectedConversation?.roomName ? (
                      <span>
                        {selectedConversation?.roomType ? selectedConversation.roomType : ''}
                        {selectedConversation?.roomType && selectedConversation?.roomName ? ' • ' : ''}
                        {selectedConversation?.roomName ? selectedConversation.roomName : ''}
                      </span>
                    ) : (
                      <span>Guest Portal</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button aria-label="Close conversation" onClick={() => setSelectedConversation(null)} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 border border-slate-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <div className="h-6 w-px bg-slate-200 mx-1" />
                <button className="flex items-center gap-2 bg-[#003166] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-slate-200">
                   VIEW RESERVATION <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </header>

            {/* Conversation Content */}
            <div className="flex-1 overflow-hidden relative">
              <ScrollArea 
                ref={scrollAreaRef} 
                className="h-full"
              >
                <div className="p-8 space-y-8">
                {/* PMS Note */}
                <div className="flex justify-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm">
                    Conversation started via Guest Portal
                  </span>
                </div>

                {/* Messages */}
                {uniqueMessages.map((msg, index) => (
                  <div key={`msg-${msg.id}`}>
                    {msg.senderType === 'property' ? (
                      /* Staff Message */
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-[#003166] flex items-center justify-center font-bold flex-shrink-0">
                          {property?.name?.charAt(0) || selectedConversation?.guestName?.charAt(0) || 'P'}
                        </div>
                        <div className="space-y-1">
                          <div className="px-2 py-1 bg-white rounded-2xl rounded-tl-none border border-slate-200 shadow-sm max-w-lg">
                            {msg.fileAttachment && (
                              <div className="mb-2">
                                <div className="text-sm font-medium">{msg.fileAttachment.fileName}</div>
                                {msg.fileAttachment.fileUrl && (
                                  <a className="text-xs text-blue-600 underline" href={msg.fileAttachment.fileUrl} target="_blank" rel="noreferrer">
                                    {msg.fileAttachment.fileType?.startsWith('image/') ? 'View Image' : 'Download'}
                                  </a>
                                )}
                              </div>
                            )}
                            {msg.message && (
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {msg.message}
                              </p>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium ml-1">
                            {msg.timestamp ? format(convertTimestamp(msg.timestamp), 'h:mm a') : ''}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Guest Message */
                      <div className="flex flex-row-reverse items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-[#003166] flex items-center justify-center font-bold flex-shrink-0">
                          {msg.senderName?.charAt(0) || selectedConversation?.guestName?.charAt(0) || 'G'}
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <div className="px-2 py-1 bg-[#003166] text-white rounded-2xl rounded-tr-none shadow-xl max-w-lg">
                            {msg.fileAttachment && (
                              <div className="mb-2">
                                <div className="text-sm font-medium text-white">{msg.fileAttachment.fileName}</div>
                                {msg.fileAttachment.fileUrl && (
                                  <a className="text-xs text-blue-200 underline" href={msg.fileAttachment.fileUrl} target="_blank" rel="noreferrer">
                                    {msg.fileAttachment.fileType?.startsWith('image/') ? 'View Image' : 'Download'}
                                  </a>
                                )}
                              </div>
                            )}
                            {msg.message && (
                              <p className="text-sm leading-relaxed">
                                {msg.message}
                              </p>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium mr-1">
                            {msg.timestamp ? format(convertTimestamp(msg.timestamp), 'h:mm a') : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* New Messages Indicator */}
              {(() => {
                const shouldShow = unseenMessageCount > 0;
                console.log('🚨 Indicator render check:', { unseenMessageCount, isAtBottom, shouldShow });
                return shouldShow;
              })() && (
                <div className="absolute bottom-8 right-8 z-50">
                  <button
                    onClick={() => {
                      console.log('Indicator clicked - scrolling to bottom');
                      setUnseenMessageCount(0);
                      scrollToBottom(true);
                    }}
                    className="bg-white text-[#ea580c] p-3 rounded-full shadow-lg hover:scale-110 transition-all duration-200 flex items-center justify-center border-2 border-[#ea580c]"
                  >
                    <div className="relative">
                      {/* Down arrow icon */}
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      {/* Message count badge */}
                      <span className="absolute -top-2 -right-2 bg-[#ea580c] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                        {unseenMessageCount > 99 ? '99+' : unseenMessageCount}
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            {/* Input Footer */}
            <footer className="p-2 bg-white border-t border-slate-200 flex-shrink-0">
              <form onSubmit={handleSendMessage}>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-1 transition-all focus-within:ring-4 focus-within:ring-slate-100 focus-within:bg-white">
                  <div className="flex items-center gap-2 px-1 py-1">
                    <input ref={fileInputRef} type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach file" className="p-2 hover:bg-slate-200 rounded-md text-slate-500 transition-colors">
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleTextareaChange}
                      onKeyDown={handleTextareaKeyDown}
                      className="flex-1 bg-transparent border-none px-1 py-0.5 text-sm outline-none resize-none min-h-[28px] max-h-[120px] rounded-md"
                      placeholder="Type a reply or use '/' for templates..."
                      rows={1}
                    />

                    {selectedFile ? (
                      <button type="button" onClick={handleSendFile} aria-label="Send file" className="p-1 bg-[#ea580c] text-white rounded-md shadow-sm hover:scale-105 active:scale-95 transition-transform">
                        <Send className="w-4 h-4" />
                      </button>
                    ) : (
                      <button type="submit" aria-label="Send message" disabled={isSending || !newMessage.trim()} className="p-2 bg-[#ea580c] text-white rounded-md shadow-sm hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSending ? <Icons.Spinner className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
             <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-slate-300" />
             </div>
             <h2 className="text-xl font-bold text-slate-800">Select a conversation</h2>
             <p className="text-sm text-slate-400 max-w-xs">
                Choose a message from the sidebar to view the full interaction history and respond to guests.
             </p>
          </div>
        )}
      </main>
    </div>
  );
}
