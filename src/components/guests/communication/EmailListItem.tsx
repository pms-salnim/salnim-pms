"use client";
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { Star, Paperclip, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EmailListItemProps {
    email: {
        id: string;
        from_name: string;
        from_email: string;
        subject: string;
        date: string;
        snippet: string;
        is_unread: boolean;
        is_starred: boolean;
        has_attachments: boolean;
        labels?: Array<{ name: string }>;
    };
    onSelect: () => void;
    isSelected: boolean;
    onStar?: (email: EmailListItemProps['email']) => void;
    onArchive?: (email: EmailListItemProps['email']) => void;
    onDelete?: (email: EmailListItemProps['email']) => void;
}

const EmailListItem = ({ email, onSelect, isSelected, onStar, onArchive, onDelete }: EmailListItemProps) => {
    const emailDate = new Date(email.date);
    const formattedDate = isValid(emailDate) ? format(emailDate, 'PP') : '—';

    const handleAction = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    };

    return (
    <div
        className={cn(
            "group flex items-start gap-3 p-4 cursor-pointer border-b last:border-b-0 transition-all hover:shadow-sm",
            isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-slate-50",
            email.is_unread && !isSelected && "bg-blue-50/50"
        )}
        onClick={onSelect}
    >
        <Avatar className="h-10 w-10 mt-1 ring-2 ring-slate-100">
            <AvatarFallback className={cn(
                "text-sm font-semibold",
                email.is_unread ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-700"
            )}>
                {email.from_name.charAt(0).toUpperCase()}
            </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 overflow-hidden min-w-0">
            <div className="flex justify-between items-start gap-2 mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <p className={cn(
                        "text-sm truncate",
                        email.is_unread ? "font-bold text-slate-900" : "font-medium text-slate-700"
                    )}>
                        {email.from_name}
                    </p>
                    {email.labels && email.labels.length > 0 && (
                        <div className="flex gap-1">
                            {email.labels.slice(0, 2).map((label, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                    {label.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <p className="text-[11px] text-slate-500">{formattedDate}</p>
                    {email.has_attachments && <Paperclip className="h-3.5 w-3.5 text-slate-400" />}
                </div>
            </div>
            
            <p className={cn(
                "text-sm truncate mb-1",
                email.is_unread ? "font-semibold text-slate-800" : "text-slate-700"
            )}>
                {email.subject}
            </p>
            
            <p className="text-xs text-slate-500 truncate">
                {email.snippet}
            </p>
        </div>

        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onStar && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleAction(e, () => onStar(email))}
                >
                    <Star className={cn("h-3.5 w-3.5", email.is_starred && "fill-yellow-400 text-yellow-400")} />
                </Button>
            )}
            {onArchive && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleAction(e, () => onArchive(email))}
                >
                    <Archive className="h-3.5 w-3.5" />
                </Button>
            )}
            {onDelete && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                    onClick={(e) => handleAction(e, () => onDelete(email))}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    </div>
    );
};

export default EmailListItem;
