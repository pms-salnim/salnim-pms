"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import type { Email } from '@/contexts/auth-context';
import { Icons } from '@/components/icons';
import { 
    ArrowLeft, 
    Reply, 
    Forward, 
    Star, 
    Archive, 
    Trash2, 
    Download, 
    Eye, 
    EyeOff, 
    Paperclip,
    Mail,
    MailOpen,
    Tag,
    MoreVertical,
    ChevronLeft,
    CornerUpLeft,
    MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface EmailDetailViewProps {
    email: Email;
    onBack: () => void;
    onReply: (email: Email) => void;
    onForward?: (email: Email) => void;
    onStar?: (email: Email) => void;
    onArchive?: (email: Email) => void;
    onDelete?: (email: Email) => void;
    onMarkUnread?: (email: Email) => void;
    onAddLabel?: (email: Email) => void;
}

const ActionButton = ({ 
    icon: Icon, 
    label, 
    onClick, 
    danger = false,
    active = false
}: { 
    icon: any; 
    label?: string; 
    onClick?: () => void; 
    danger?: boolean;
    active?: boolean;
}) => (
    <button 
        onClick={onClick}
        className={cn(
            "p-2.5 rounded-xl transition-all font-medium text-xs flex items-center gap-2",
            danger 
                ? "hover:bg-red-50 text-red-600" 
                : active
                ? "bg-yellow-50 text-yellow-600"
                : "hover:bg-slate-100 text-slate-600"
        )}
        title={label}
    >
        <Icon size={18} />
        {label && <span className="hidden lg:inline">{label}</span>}
    </button>
);

const EmailDetailView = ({ 
    email, 
    onBack, 
    onReply, 
    onForward,
    onStar,
    onArchive,
    onDelete,
    onMarkUnread,
    onAddLabel
}: EmailDetailViewProps) => {
    const emailDate = new Date(email.date);
    const formattedDate = isValid(emailDate) ? format(emailDate, 'PPpp') : '—';
    const dateLabel = isValid(emailDate) ? format(emailDate, 'MMM d, yyyy') : '—';
    const [viewMode, setViewMode] = useState<'formatted' | 'text'>('text');
    const hasAttachments = email.attachments && email.attachments.length > 0;

    const handleDownloadAttachment = (attachment: any) => {
        if (attachment.dataUri) {
            const link = document.createElement('a');
            link.href = attachment.dataUri;
            link.download = attachment.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getAttachmentIcon = (contentType: string) => {
        if (contentType.startsWith('image/')) return '🖼️';
        if (contentType.startsWith('application/pdf')) return '📄';
        if (contentType.startsWith('application/vnd.ms-excel') || contentType.includes('spreadsheet')) return '📊';
        if (contentType.startsWith('application/msword') || contentType.includes('document')) return '📝';
        if (contentType.startsWith('video/')) return '🎥';
        if (contentType.startsWith('audio/')) return '🎵';
        return '📎';
    };

    const plainTextBody = email.bodyText ?? email.body ?? '';
    const richTextBody = email.bodyHtml ?? email.body ?? '';

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            {/* Action Bar */}
            <header className="px-6 lg:px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onBack} 
                        className="lg:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-xl mr-2"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="hidden lg:flex bg-slate-100 rounded-xl p-1">
                        <ActionButton 
                            icon={CornerUpLeft} 
                            label="Reply" 
                            onClick={() => onReply(email)}
                        />
                        {onForward && (
                            <ActionButton 
                                icon={Forward} 
                                label="Forward" 
                                onClick={() => onForward(email)}
                            />
                        )}
                    </div>
                    
                    <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden lg:block" />
                    
                    {onStar && (
                        <ActionButton 
                            icon={Star} 
                            onClick={() => onStar(email)}
                            active={email.starred}
                        />
                    )}
                    {onArchive && (
                        <ActionButton 
                            icon={Archive} 
                            onClick={() => onArchive(email)}
                        />
                    )}
                    {onDelete && (
                        <ActionButton 
                            icon={Trash2} 
                            onClick={() => onDelete(email)}
                            danger
                        />
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setViewMode(v => v === 'text' ? 'formatted' : 'text')}
                        className={cn(
                            "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            viewMode === 'formatted' 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                : 'bg-white border border-slate-200 text-slate-600'
                        )}
                    >
                        {viewMode === 'formatted' ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span className="hidden sm:inline">{viewMode === 'formatted' ? 'Rich View' : 'Raw Text'}</span>
                    </button>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600">
                                <MoreHorizontal size={18} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {onMarkUnread && (
                                <DropdownMenuItem onClick={() => onMarkUnread(email)}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Mark as unread
                                </DropdownMenuItem>
                            )}
                            {onAddLabel && (
                                <DropdownMenuItem onClick={() => onAddLabel(email)}>
                                    <Tag className="h-4 w-4 mr-2" />
                                    Add label
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Print</DropdownMenuItem>
                            <DropdownMenuItem>Show original</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Email Body Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10">
                <div className="max-w-4xl mx-auto">
                    {/* Meta Header */}
                    <div className="mb-10">
                        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 leading-tight mb-6 lg:mb-8">
                            {email.subject}
                        </h1>
                        
                        {email.labels && email.labels.length > 0 && (
                            <div className="flex gap-2 mb-6">
                                {email.labels.map(label => (
                                    <Badge key={label} variant="secondary" className="text-xs">
                                        {label}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 lg:p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 lg:gap-4">
                                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center font-bold text-base lg:text-lg shadow-lg shadow-indigo-100 flex-shrink-0">
                                    {email.from.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-extrabold text-slate-900 truncate">{email.from.name}</div>
                                    <div className="text-xs text-slate-400 font-medium truncate">
                                        From: <span className="text-indigo-600">{email.from.email}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-left sm:text-right">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{dateLabel}</div>
                                <div className="text-[10px] text-slate-300 font-bold mt-1">SENT VIA EMAIL</div>
                            </div>
                        </div>
                    </div>

                    {/* Content Container */}
                    <div className="bg-white rounded-3xl lg:rounded-[32px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden mb-8">
                        {viewMode === 'text' ? (
                            <div className="p-6 lg:p-12 whitespace-pre-wrap text-slate-700 leading-relaxed text-base lg:text-lg font-medium">
                                {plainTextBody}
                            </div>
                        ) : (
                            <div className="w-full min-h-[400px] lg:min-h-[600px] bg-white">
                                <iframe 
                                    title="Email Content"
                                    sandbox="allow-popups"
                                    srcDoc={`
                                        <html>
                                            <head>
                                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                                <style>
                                                    body { 
                                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                                                        line-height: 1.6; 
                                                        color: #1e293b; 
                                                        margin: 0; 
                                                        padding: 24px; 
                                                    }
                                                    @media (min-width: 1024px) {
                                                        body { padding: 48px; }
                                                    }
                                                    img { max-width: 100%; border-radius: 8px; }
                                                    a { color: #4f46e5; text-decoration: none; font-weight: 600; }
                                                    a:hover { text-decoration: underline; }
                                                    p { margin: 0 0 1em 0; }
                                                </style>
                                            </head>
                                            <body>${richTextBody}</body>
                                        </html>
                                    `}
                                    className="w-full h-full min-h-[500px] lg:min-h-[700px] border-0"
                                />
                            </div>
                        )}

                        {/* Attachment Bar */}
                        {hasAttachments && (
                            <div className="p-6 lg:p-8 bg-slate-50 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Secured Attachments</p>
                                <div className="flex flex-wrap gap-3">
                                    {email.attachments!.map((attachment, idx) => (
                                        <div 
                                            key={idx} 
                                            className="flex items-center gap-3 lg:gap-4 px-4 lg:px-5 py-3 lg:py-4 bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer group"
                                            onClick={() => handleDownloadAttachment(attachment)}
                                        >
                                            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors flex-shrink-0">
                                                <Paperclip size={16} className="text-slate-400 group-hover:text-indigo-600 lg:w-[18px] lg:h-[18px]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-slate-800 truncate">{attachment.filename}</div>
                                                <div className="text-[10px] font-bold text-slate-400">{formatFileSize(attachment.size)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="lg:hidden flex gap-2 px-4 pb-4">
                        <Button onClick={() => onReply(email)} className="flex-1 gap-2">
                            <Reply className="h-4 w-4" />
                            Reply
                        </Button>
                        {onForward && (
                            <Button variant="outline" onClick={() => onForward(email)} className="flex-1 gap-2">
                                <Forward className="h-4 w-4" />
                                Forward
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailDetailView;
