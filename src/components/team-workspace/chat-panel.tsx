
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import type { Message, Conversation, Attachment } from '@/types/conversation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Icons } from '../icons';
import { uploadFile } from '@/lib/uploadHelper';
import Image from 'next/image';
import { Paperclip, File as FileIcon, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ChatPanelProps {
  conversationId: string | null;
  onClose: () => void;
}

export default function ChatPanel({ conversationId, onClose }: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (conversationId && user?.id) {
      const convDocRef = doc(db, "conversations", conversationId);
      updateDoc(convDocRef, {
        [`unreadCounts.${user.id}`]: 0
      }).catch(err => console.error("Error clearing unread count:", err));
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setConversation(null);
      return;
    }

    const convDocRef = doc(db, "conversations", conversationId);
    const unsubConv = onSnapshot(convDocRef, (doc) => {
        setConversation(doc.exists() ? { id: doc.id, ...doc.data() } as Conversation : null);
    });

    const messagesQuery = query(collection(db, "conversations", conversationId, "messages"), orderBy("timestamp", "asc"));
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgList);
    });

    return () => {
        unsubConv();
        unsubMessages();
    };
  }, [conversationId]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((newMessage.trim() === '' && attachments.length === 0) || !user || !conversationId || !conversation) return;

    setIsUploading(true);

    let attachmentPayloads: Attachment[] = [];
    if (attachments.length > 0) {
      const uploadPromises = attachments.map(file => 
        uploadFile(`conversations/${conversationId}`, file)
          .then(url => ({
            name: file.name,
            type: file.type,
            url: url,
          }))
      );
      attachmentPayloads = await Promise.all(uploadPromises);
    }

    const messageText = newMessage.trim();

    const messageData = {
      sender_id: user.id,
      text: messageText,
      attachments: attachmentPayloads,
      timestamp: serverTimestamp()
    };
    
    await addDoc(collection(db, "conversations", conversationId, "messages"), messageData);
    
    const unreadIncrements: { [key: string]: any } = {};
    conversation.participants.forEach(participantId => {
        if (participantId !== user.id) {
            unreadIncrements[`unreadCounts.${participantId}`] = increment(1);
        }
    });
    
    let lastMessageText = messageText;
    if (!lastMessageText && attachmentPayloads.length > 0) {
      lastMessageText = `Sent ${attachmentPayloads.length} attachment(s)`;
    }
    
    await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: {
            text: lastMessageText,
            sender_id: user.id,
            timestamp: serverTimestamp(),
            hasAttachment: attachmentPayloads.length > 0,
        },
        updatedAt: serverTimestamp(),
        ...unreadIncrements
    });

    setNewMessage('');
    setAttachments([]);
    setIsUploading(false);
  };

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Icons.Mail className="h-16 w-16 mb-4" />
        <p className="text-lg">Select a conversation to start chatting</p>
      </div>
    );
  }

  if (!conversation) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Icons.Spinner className="h-8 w-8 animate-spin" />
        </div>
    );
  }
  
  const otherParticipantId = conversation.participants.find(p => p !== user?.id)!;
  const otherParticipantDetails = conversation.participantDetails[otherParticipantId];

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
            <Avatar>
                <AvatarImage src={otherParticipantDetails?.profilePicture} alt={otherParticipantDetails?.fullName} />
                <AvatarFallback>{otherParticipantDetails?.fullName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="font-semibold">{otherParticipantDetails?.fullName || 'Chat'}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <Icons.X className="h-5 w-5" />
            <span className="sr-only">Close conversation</span>
        </Button>
      </header>
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="space-y-4 p-4">
            {messages.map(msg => {
                const isSender = msg.sender_id === user?.id;
                const senderDetails = conversation.participantDetails[msg.sender_id];
                return (
                    <div key={msg.id} className={cn("flex items-end gap-2", isSender ? "justify-end" : "justify-start")}>
                        {!isSender && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={senderDetails?.profilePicture} />
                                <AvatarFallback>{senderDetails?.fullName.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn("max-w-xs md:max-w-md p-3 rounded-lg flex flex-col gap-2", isSender ? "bg-primary text-primary-foreground" : "bg-muted")}>
                           {msg.attachments && msg.attachments.length > 0 && (
                                <div className="space-y-2">
                                    {msg.attachments.map((att, index) => (
                                        att.type.startsWith('image/') ? (
                                            <a key={index} href={att.url} target="_blank" rel="noopener noreferrer">
                                                <Image src={att.url} alt={att.name} width={200} height={150} className="rounded-md object-cover"/>
                                            </a>
                                        ) : (
                                            <a key={index} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md bg-background/20 hover:bg-background/40">
                                                <FileIcon className="h-5 w-5"/>
                                                <span className="text-sm font-medium truncate">{att.name}</span>
                                            </a>
                                        )
                                    ))}
                                </div>
                            )}
                            {msg.text && <p className="text-sm">{msg.text}</p>}
                             <p className={cn("text-xs mt-1 self-end", isSender ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                {msg.timestamp ? format(msg.timestamp.toDate(), 'p') : ''}
                            </p>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <footer className="p-4 border-t shrink-0 bg-background">
        {attachments.length > 0 && (
            <div className="mb-2 space-y-2">
              <Label>Attachments:</Label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <Badge key={index} variant="secondary" className="pl-2 pr-1">
                    {file.name}
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => removeAttachment(index)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
            disabled={isUploading}
          />
          <input type="file" ref={fileInputRef} multiple onChange={handleFileChange} className="hidden" />
          <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              <Paperclip className="h-4 w-4"/>
          </Button>
          <Button type="submit" disabled={isUploading}>
            {isUploading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
            Send
          </Button>
        </form>
      </footer>
    </div>
  );
}
