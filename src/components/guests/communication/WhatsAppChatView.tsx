"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Phone, MessageSquare, RefreshCw, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Icons } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface WhatsAppMessage {
  id: string;
  messageId: string;
  from: string;
  to?: string;
  timestamp: Date;
  type: string;
  text: string;
  mediaUrl?: string;
  caption?: string;
  status: 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  propertyId: string;
  guestId?: string;
  guestName?: string;
  receivedAt?: Date;
  direction?: 'incoming' | 'outgoing';
}

interface WhatsAppConversation {
  phoneNumber: string;
  guestName?: string;
  guestId?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  messages: WhatsAppMessage[];
}

export default function WhatsAppChatView() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Compose new message state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composePhoneNumber, setComposePhoneNumber] = useState('');
  const [composeMessage, setComposeMessage] = useState('');

  // Fetch WhatsApp messages and group into conversations
  useEffect(() => {
    if (!user?.propertyId) return;

    const messagesRef = collection(db, 'properties', user.propertyId, 'whatsappMessages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages: WhatsAppMessage[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          messageId: data.messageId,
          from: data.from,
          to: data.to,
          timestamp: data.timestamp?.toDate() || new Date(),
          type: data.type,
          text: data.text || '',
          mediaUrl: data.mediaUrl,
          caption: data.caption,
          status: data.status,
          propertyId: data.propertyId,
          guestId: data.guestId,
          guestName: data.guestName,
          receivedAt: data.receivedAt?.toDate(),
          direction: data.direction || (data.status === 'received' ? 'incoming' : 'outgoing')
        });
      });

      // Group messages by phone number
      const conversationsMap = new Map<string, WhatsAppConversation>();
      
      messages.forEach(msg => {
        const phoneNumber = msg.from;
        
        if (!conversationsMap.has(phoneNumber)) {
          conversationsMap.set(phoneNumber, {
            phoneNumber,
            guestName: msg.guestName,
            guestId: msg.guestId,
            lastMessage: msg.text || msg.caption || `${msg.type} message`,
            lastMessageTime: msg.timestamp,
            unreadCount: msg.direction === 'incoming' && msg.status === 'received' ? 1 : 0,
            messages: [msg]
          });
        } else {
          const conv = conversationsMap.get(phoneNumber)!;
          conv.messages.push(msg);
          
          // Update last message if this one is more recent
          if (msg.timestamp > conv.lastMessageTime) {
            conv.lastMessage = msg.text || msg.caption || `${msg.type} message`;
            conv.lastMessageTime = msg.timestamp;
          }
          
          // Count unread messages
          if (msg.direction === 'incoming' && msg.status === 'received') {
            conv.unreadCount++;
          }
        }
      });

      // Sort messages within each conversation by timestamp
      conversationsMap.forEach(conv => {
        conv.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      });

      // Convert to array and sort by last message time
      const conversationsArray = Array.from(conversationsMap.values())
        .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

      setConversations(conversationsArray);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.propertyId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages]);

  const handleSelectConversation = async (conversation: WhatsAppConversation) => {
    setSelectedConversation(conversation);
    
    // Mark messages as read (update status in Firestore)
    if (conversation.unreadCount > 0 && user?.propertyId) {
      const unreadMessages = conversation.messages.filter(
        msg => msg.direction === 'incoming' && msg.status === 'received'
      );
      
      for (const msg of unreadMessages) {
        try {
          const messageRef = doc(db, 'properties', user.propertyId, 'whatsappMessages', msg.id);
          await updateDoc(messageRef, { status: 'read' });
        } catch (error) {
          console.error('Failed to mark message as read:', error);
        }
      }
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || !user?.propertyId) return;

    setIsSending(true);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/sendWhatsAppMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            propertyId: user.propertyId,
            to: selectedConversation.phoneNumber,
            templateName: 'text_message', // You may need to create a generic text template
            templateLanguage: 'en',
            parameters: [messageInput]
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessageInput('');
        toast({ title: 'Message Sent', description: 'Your message has been sent successfully.' });
      } else {
        throw new Error(result.message || 'Failed to send message');
      }
    } catch (error: any) {
      toast({
        title: 'Send Failed',
        description: error.message || 'Could not send message',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleComposeAndSend = async () => {
    if (!composePhoneNumber.trim() || !composeMessage.trim() || !user?.propertyId) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both phone number and message',
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/sendWhatsAppMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            propertyId: user.propertyId,
            to: composePhoneNumber,
            templateName: 'text_message',
            templateLanguage: 'en',
            parameters: [composeMessage]
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        setComposePhoneNumber('');
        setComposeMessage('');
        setIsComposeOpen(false);
        toast({ 
          title: 'Message Sent', 
          description: `Message sent to ${composePhoneNumber}` 
        });
      } else {
        throw new Error(result.message || 'Failed to send message');
      }
    } catch (error: any) {
      toast({
        title: 'Send Failed',
        description: error.message || 'Could not send message',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Conversations List */}
      <div className="w-96 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
              WhatsApp
            </h2>
            <div className="flex items-center gap-2">
              <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send New WhatsApp Message</DialogTitle>
                    <DialogDescription>
                      Send a message to any WhatsApp number
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="+1234567890"
                        value={composePhoneNumber}
                        onChange={(e) => setComposePhoneNumber(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Include country code (e.g., +1 for USA)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Input
                        id="message"
                        placeholder="Type your message..."
                        value={composeMessage}
                        onChange={(e) => setComposeMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleComposeAndSend()}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsComposeOpen(false)}
                      disabled={isSending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleComposeAndSend}
                      disabled={!composePhoneNumber.trim() || !composeMessage.trim() || isSending}
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      {isSending ? (
                        <Icons.Spinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={() => setIsLoading(true)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y">
            {conversations.length > 0 ? (
              conversations.map((conv) => (
                <div
                  key={conv.phoneNumber}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedConversation?.phoneNumber === conv.phoneNumber ? 'bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {conv.guestName ? conv.guestName.charAt(0).toUpperCase() : <Phone className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm truncate">
                          {conv.guestName || conv.phoneNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(conv.lastMessageTime, 'HH:mm')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 text-slate-300" />
                <p className="text-sm">No WhatsApp conversations yet</p>
                <p className="text-xs mt-2">Messages will appear here when guests contact you</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Message Thread */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-slate-50">
          {/* Header */}
          <div className="p-4 border-b bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-emerald-100 text-emerald-700">
                  {selectedConversation.guestName
                    ? selectedConversation.guestName.charAt(0).toUpperCase()
                    : <Phone className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {selectedConversation.guestName || selectedConversation.phoneNumber}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {!selectedConversation.guestName && selectedConversation.phoneNumber}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {selectedConversation.messages.map((msg, index) => {
                const isOutgoing = msg.direction === 'outgoing' || msg.status !== 'received';
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isOutgoing
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white border border-slate-200'
                      }`}
                    >
                      {msg.mediaUrl && (
                        <img
                          src={msg.mediaUrl}
                          alt={msg.caption || 'Media'}
                          className="rounded mb-2 max-w-full"
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.text || msg.caption}
                      </p>
                      <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                        isOutgoing ? 'text-emerald-100' : 'text-muted-foreground'
                      }`}>
                        <span>{format(msg.timestamp, 'HH:mm')}</span>
                        {isOutgoing && (
                          <span>
                            {msg.status === 'sent' && '✓'}
                            {msg.status === 'delivered' && '✓✓'}
                            {msg.status === 'read' && '✓✓'}
                            {msg.status === 'failed' && '✗'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1"
                disabled={isSending}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || isSending}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                {isSending ? (
                  <Icons.Spinner className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: WhatsApp Business API requires approved message templates
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
          <MessageSquare className="h-16 w-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Select a conversation
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose a WhatsApp conversation from the list to view messages
          </p>
        </div>
      )}
    </div>
  );
}
