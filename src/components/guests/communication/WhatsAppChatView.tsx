"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { whatsappApi } from '@/lib/communication-api';
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
  conversation_id: string;
  sender_type: 'guest' | 'property';
  sender_id: string;
  sender_name: string;
  message: string;
  message_status: 'sent' | 'delivered' | 'read';
  is_read: boolean;
  created_at: string;
}

interface WhatsAppConversation {
  id: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  last_message_text?: string;
  last_message_timestamp?: string;
  unread_count: number;
  is_active: boolean;
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

  // Load conversations and set up polling
  useEffect(() => {
    if (!user?.propertyId) return;

    const loadConversations = async () => {
      try {
        // Get conversations
        const conversationsResult = await whatsappApi.listConversations(user.propertyId);
        if (!conversationsResult?.conversations) {
          setIsLoading(false);
          return;
        }

        // For each conversation, fetch messages
        const convsWithMessages = await Promise.all(
          conversationsResult.conversations.map(async (conv: any) => {
            const messagesResult = await whatsappApi.getMessages(user.propertyId, conv.id);
            return {
              ...conv,
              messages: messagesResult?.messages || []
            };
          })
        );

        setConversations(convsWithMessages);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading conversations:', error);
        setIsLoading(false);
      }
    };

    loadConversations();

    // Set up polling every 3 seconds
    const interval = setInterval(loadConversations, 3000);

    return () => clearInterval(interval);
  }, [user?.propertyId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages]);

  const handleSelectConversation = async (conversation: WhatsAppConversation) => {
    setSelectedConversation(conversation);
    
    // Mark conversation as read via API
    if (conversation.unread_count > 0 && user?.propertyId) {
      try {
        await whatsappApi.markAsRead(user.propertyId, conversation.id);
      } catch (error) {
        console.error('Failed to mark conversation as read:', error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || !user?.propertyId) return;

    setIsSending(true);
    
    try {
      const response = await whatsappApi.sendMessage(
        user.propertyId,
        selectedConversation.id,
        messageInput
      );

      if (response?.success) {
        setMessageInput('');
        toast({ title: 'Message Sent', description: 'Your message has been sent successfully.' });
        
        // Refresh conversation messages
        const messagesResult = await whatsappApi.getMessages(user.propertyId, selectedConversation.id);
        setSelectedConversation({
          ...selectedConversation,
          messages: messagesResult?.messages || []
        });
      } else {
        throw new Error('Failed to send message');
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
      const response = await whatsappApi.startConversation(
        user.propertyId,
        composePhoneNumber,
        undefined,
        undefined,
        composeMessage
      );

      if (response?.success) {
        setComposePhoneNumber('');
        setComposeMessage('');
        setIsComposeOpen(false);
        toast({ 
          title: 'Message Sent', 
          description: `Message sent to ${composePhoneNumber}` 
        });
        
        // Refresh conversations list
        const conversationsResult = await whatsappApi.listConversations(user.propertyId);
        if (conversationsResult?.conversations) {
          const convsWithMessages = await Promise.all(
            conversationsResult.conversations.map(async (conv: any) => {
              const messagesResult = await whatsappApi.getMessages(user.propertyId, conv.id);
              return {
                ...conv,
                messages: messagesResult?.messages || []
              };
            })
          );
          setConversations(convsWithMessages);
        }
      } else {
        throw new Error('Failed to send message');
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
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {conv.guest_name ? conv.guest_name.charAt(0).toUpperCase() : <Phone className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm truncate">
                          {conv.guest_name || conv.guest_phone}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {conv.last_message_timestamp ? format(new Date(conv.last_message_timestamp), 'HH:mm') : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.last_message_text || 'No messages yet'}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="ml-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {conv.unread_count}
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
                  {selectedConversation.guest_name
                    ? selectedConversation.guest_name.charAt(0).toUpperCase()
                    : <Phone className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {selectedConversation.guest_name || selectedConversation.guest_phone}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {!selectedConversation.guest_name && selectedConversation.guest_phone}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {selectedConversation.messages.map((msg) => {
                const isOutgoing = msg.sender_type === 'property';
                
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
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.message}
                      </p>
                      <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                        isOutgoing ? 'text-emerald-100' : 'text-muted-foreground'
                      }`}>
                        <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                        {isOutgoing && (
                          <span>
                            {msg.message_status === 'sent' && '✓'}
                            {msg.message_status === 'delivered' && '✓✓'}
                            {msg.message_status === 'read' && '✓✓'}
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
