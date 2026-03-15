"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  Loader2, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  Download,
  Check,
  CheckCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { GuestPortalData, GuestPortalConversation, GuestPortalMessage } from './types';

interface ChatTabProps {
  data: GuestPortalData;
  colors: {
    primary: string;
    secondary: string;
  };
  guestName: string;
  triggerToast: (msg: string) => void;
}

const ChatTab: React.FC<ChatTabProps> = ({ data, colors, guestName, triggerToast }) => {
  const [conversation, setConversation] = useState<GuestPortalConversation | null>(null);
  const [messages, setMessages] = useState<GuestPortalMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { property, reservation } = data;

  const convertTimestamp = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    try {
      // If it's a Firestore Timestamp
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate();
        return isNaN(date.getTime()) ? new Date() : date;
      }
      
      // If it's an object with seconds (Firestore timestamp as plain object)
      if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return isNaN(date.getTime()) ? new Date() : date;
      }
      
      // If it's an object with _seconds (Firestore timestamp with underscores)
      if (timestamp._seconds) {
        const date = new Date(timestamp._seconds * 1000);
        return isNaN(date.getTime()) ? new Date() : date;
      }
      
      // If it's already a Date object
      if (timestamp instanceof Date) {
        return isNaN(timestamp.getTime()) ? new Date() : timestamp;
      }
      
      // Try to parse as date string or number
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      return new Date();
    }
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

  const scrollToBottom = useCallback(() => {
    // Use a small delay to prevent interfering with input focus
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const loadConversation = useCallback(async () => {
    try {
      setIsLoadingChat(true);
      
      const propertyId = property?.id || data.property?.id;
      const reservationNum = reservation.reservationNumber || reservation.id;
      
      if (!propertyId || !reservationNum) return;
      
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getConversations',
          data: {
            propertyId,
            reservationNumber: reservationNum
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.conversations && result.conversations.length > 0) {
          const conv = result.conversations[0];
          setConversation(conv);
          loadMessages(conv.id);
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoadingChat(false);
    }
  }, [property?.id, data.property?.id, reservation.reservationNumber, reservation.id]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const propertyId = property?.id || data.property?.id;
      const reservationNum = reservation.reservationNumber || reservation.id;
      
      if (!propertyId || !reservationNum || !conversationId) return;
      
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getMessages',
          data: {
            conversationId,
            propertyId,
            reservationNumber: reservationNum
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        const newMessages = sortMessages(result.messages || []);

        // Only update messages if they're different to prevent unnecessary re-renders
        setMessages(prevMessages => {
          if (prevMessages.length !== newMessages.length || 
              (newMessages.length > 0 && prevMessages.length > 0 && 
               newMessages[newMessages.length - 1]?.id !== prevMessages[prevMessages.length - 1]?.id)) {
            // Only scroll if we actually have new messages and not on initial load
            if (newMessages.length > prevMessages.length) {
              setTimeout(scrollToBottom, 150);
            }
            return newMessages;
          }
          return prevMessages;
        });
        
        // Mark as read
        await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'markAsRead',
            data: {
              conversationId,
              propertyId,
              reservationNumber: reservationNum
            }
          })
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [property?.id, data.property?.id, reservation.reservationNumber, reservation.id, scrollToBottom]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  }, []);

  const validateFile = (file: File): string | null => {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Only PDF files and images (JPEG, PNG, GIF, WebP, AVIF) are allowed';
    }

    return null;
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      triggerToast(validationError);
      return;
    }

    try {
      setIsUploadingFile(true);
      await sendFileMessage(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      triggerToast('Failed to upload file');
    } finally {
      setIsUploadingFile(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const sendFileMessage = async (file: File) => {
    try {
      const conversationId = conversation?.id;
      const propertyId = property?.id || data.property?.id;
      const reservationNum = reservation.reservationNumber || reservation.id;
      
      // Convert file to base64
      const base64File = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result); // Keep the full data URL with prefix
        };
        reader.readAsDataURL(file);
      });

      // If no conversation exists, create one first
      if (!conversation) {
        const createResponse = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'createConversation',
            data: {
              propertyId,
              reservationNumber: reservationNum,
              message: `📎 ${file.name}`,
              fileAttachment: {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                fileData: base64File
              }
            }
          })
        });

        if (createResponse.ok) {
            const result = await createResponse.json();
            setConversation(result.conversation);
            setMessages(sortMessages([result.message]));
            setTimeout(scrollToBottom, 100);
            triggerToast('File sent!');
          } else {
            triggerToast('Failed to send file');
          }
        return;
      }

      // Send file to existing conversation
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          data: {
            conversationId,
            message: `📎 ${file.name}`,
            propertyId,
            reservationNumber: reservationNum,
            fileAttachment: {
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              fileData: base64File
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setMessages(prev => sortMessages([...prev, result.message]));
        setTimeout(scrollToBottom, 100);
        triggerToast('File sent!');
      } else {
        triggerToast('Failed to send file');
      }
    } catch (error) {
      console.error('Error sending file:', error);
      triggerToast('Failed to send file');
    }
  };

  const inputStyle = useMemo(() => ({
    focusRingColor: colors.primary + '33'
  }), [colors.primary]);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    try {
      setIsSending(true);
      
      const conversationId = conversation?.id;
      const propertyId = property?.id || data.property?.id;
      const reservationNum = reservation.reservationNumber || reservation.id;
      
      // If no conversation exists, create one first
      if (!conversation) {
        const createResponse = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'createConversation',
            data: {
              propertyId,
              reservationNumber: reservationNum,
              message: newMessage.trim()
            }
          })
        });

        if (createResponse.ok) {
          const result = await createResponse.json();
          setConversation(result.conversation);
          setMessages(sortMessages([result.message]));
          setNewMessage('');
          setTimeout(scrollToBottom, 100);
          triggerToast('Message sent!');
        } else {
          triggerToast('Failed to send message');
        }
        return;
      }

      // Send message to existing conversation
      const response = await fetch('https://europe-west1-protrack-hub.cloudfunctions.net/guestPortalChat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          data: {
            conversationId,
            message: newMessage.trim(),
            propertyId,
            reservationNumber: reservationNum
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setMessages(prev => sortMessages([...prev, result.message]));
        setNewMessage('');
        setTimeout(scrollToBottom, 100);
        triggerToast('Message sent!');
      } else {
        triggerToast('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      triggerToast('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [newMessage, isSending, conversation, property?.id, data.property?.id, reservation.reservationNumber, reservation.id, scrollToBottom, triggerToast]);

  // Load conversation on mount
  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Auto-refresh messages every 5 seconds when chat is active
  useEffect(() => {
    if (conversation?.id && !isLoadingChat) {
      const interval = setInterval(() => {
        loadMessages(conversation.id);
      }, 5000); // 5 seconds for more real-time feel
      
      return () => clearInterval(interval);
    }
  }, [conversation?.id, isLoadingChat, loadMessages]);

  return (
    <section className="animate-in fade-in flex flex-col h-[calc(93vh-10rem)]">
      {/* Floating Header with Glass-morphism */}
      <div className="mb-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/5 border border-white/20 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200/50">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/30">
                  {property?.name?.[0] || 'H'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
              </div>
              <div>
                <h2 className="font-bold text-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                  {property?.name || 'Hotel Staff'}
                </h2>
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Property Support • Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Active
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container with Premium Design */}
      <div className="flex-1 bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-3xl border border-slate-200 shadow-2xl shadow-slate-900/5 overflow-hidden flex flex-col">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <div className="p-6 space-y-4">
            {isLoadingChat ? (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">Loading conversation...</p>
              </div>
            ) : messages.length > 0 ? (
              messages.map((message, index) => {
                const isGuest = message.senderType === 'guest';
                const isFirstInGroup = index === 0 || messages[index - 1].senderType !== message.senderType;
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isGuest ? 'justify-end' : 'justify-start'} ${
                      isFirstInGroup ? 'mt-4' : 'mt-1'
                    }`}
                  >
                    <div className={`flex gap-3 max-w-[85%] ${isGuest ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar (only show for first message in group) */}
                      {isFirstInGroup && (
                        <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold shadow-lg ${
                          isGuest 
                            ? 'bg-gradient-to-br from-blue-600 to-blue-500 shadow-blue-500/30' 
                            : 'bg-gradient-to-br from-slate-700 to-slate-600 shadow-slate-600/30'
                        }`}>
                          {isGuest ? guestName[0]?.toUpperCase() : property?.name?.[0] || 'H'}
                        </div>
                      )}

                      {/* Spacer for grouped messages */}
                      {!isFirstInGroup && <div className="w-10" />}

                      {/* Message Bubble */}
                      <div className="flex flex-col gap-1">
                        {/* Sender Name (only for first message in group) */}
                        {isFirstInGroup && (
                          <p className={`text-xs font-semibold ${isGuest ? 'text-right text-blue-600' : 'text-slate-700'} px-1`}>
                            {isGuest ? 'You' : property?.name || 'Staff'}
                          </p>
                        )}
                        
                        <div className={`group relative p-4 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl ${
                          isGuest 
                            ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-tr-md shadow-blue-500/30' 
                            : 'bg-white text-slate-900 rounded-tl-md shadow-slate-900/10 border border-slate-200'
                        }`}>
                          {/* File Attachment */}
                          {message.fileAttachment ? (
                            <div className="space-y-3">
                              <div className={`flex items-center gap-3 p-3 rounded-xl ${
                                isGuest ? 'bg-white/20 backdrop-blur-sm' : 'bg-slate-50'
                              }`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                  message.fileAttachment.fileType?.startsWith('image/') 
                                    ? 'bg-emerald-100' 
                                    : 'bg-rose-100'
                                }`}>
                                  {message.fileAttachment.fileType?.startsWith('image/') ? (
                                    <ImageIcon className="w-6 h-6 text-emerald-600" />
                                  ) : (
                                    <FileText className="w-6 h-6 text-rose-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${
                                    isGuest ? 'text-white' : 'text-slate-900'
                                  }`}>
                                    {message.fileAttachment.fileName}
                                  </p>
                                  <p className={`text-xs ${
                                    isGuest ? 'text-blue-200' : 'text-slate-500'
                                  }`}>
                                    {(message.fileAttachment.fileSize / 1024 / 1024).toFixed(1)} MB
                                  </p>
                                </div>
                              </div>

                              {/* Image Preview */}
                              {message.fileAttachment.fileType?.startsWith('image/') && message.fileAttachment.fileUrl && (
                                <div className="relative rounded-xl overflow-hidden group/image">
                                  <img 
                                    src={message.fileAttachment.fileUrl} 
                                    alt={message.fileAttachment.fileName}
                                    className="max-w-xs max-h-64 rounded-xl object-cover cursor-pointer transition-transform duration-300 group-hover/image:scale-105"
                                    onClick={() => window.open(message.fileAttachment.fileUrl, '_blank')}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity" />
                                </div>
                              )}

                              {/* Download Button */}
                              {message.fileAttachment.fileUrl && (
                                <button
                                  onClick={() => window.open(message.fileAttachment.fileUrl, '_blank')}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                    isGuest 
                                      ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm' 
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  <Download className="w-4 h-4" />
                                  {message.fileAttachment.fileType?.startsWith('image/') ? 'View Full Image' : 'Download File'}
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Text Message */
                            <p className={`text-sm leading-relaxed ${isGuest ? 'text-white' : 'text-slate-800'}`}>
                              {message.message}
                            </p>
                          )}

                          {/* Message Footer */}
                          <div className={`flex items-center justify-between gap-3 mt-2 pt-2 border-t ${
                            isGuest ? 'border-white/20' : 'border-slate-200'
                          }`}>
                            <p className={`text-xs font-medium ${
                              isGuest ? 'text-blue-200' : 'text-slate-500'
                            }`}>
                              {message.timestamp ? 
                                format(convertTimestamp(message.timestamp), 'HH:mm') : 
                                'Now'
                              }
                            </p>
                            {isGuest && (
                              <div className={`flex items-center gap-1 ${
                                message.status === 'read' ? 'text-blue-200' : 'text-blue-300'
                              }`}>
                                {message.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5" />
                                ) : message.status === 'delivered' ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center h-64">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                    <MessageSquare className="w-12 h-12 text-blue-600" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Start a conversation</h3>
                <p className="text-sm text-slate-500 text-center max-w-xs">
                  Have questions or need assistance? Our property team is here to help you 24/7
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Enhanced Message Input */}
        <div className="border-t border-slate-200 bg-white/50 backdrop-blur-sm p-6">
          <form onSubmit={sendMessage} className="space-y-3">
            {/* File Input (hidden) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.avif"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Input Container */}
            <div className="flex gap-3 items-end">
              {/* Attach Button */}
              <button
                type="button"
                className="group p-3.5 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-2xl transition-all disabled:opacity-50 hover:scale-110 active:scale-95 shadow-sm"
                onClick={handleFileSelect}
                disabled={isUploadingFile || isSending}
                title="Attach file"
              >
                {isUploadingFile ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>

              {/* Text Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  placeholder="Type your message..."
                  disabled={isSending}
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isSending || isUploadingFile || !newMessage.trim()}
                className="group px-6 py-3.5 rounded-2xl text-white font-bold text-sm bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </div>

            {/* Upload indicator */}
            {isUploadingFile && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-200">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">Uploading file...</span>
              </div>
            )}

            {/* Helper Text */}
            <p className="text-xs text-slate-400 text-center">
              Press Enter to send • Attach images or PDFs up to 10MB
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ChatTab;