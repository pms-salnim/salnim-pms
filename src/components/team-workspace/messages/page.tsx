
"use client";

import React, { useState } from 'react';
import ConversationList from '@/components/team-workspace/conversation-list';
import ChatPanel from '@/components/team-workspace/chat-panel';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '@/components/icons';

export default function TeamWorkspaceMessages() {
    const { user, isLoadingAuth } = useAuth();
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    if (isLoadingAuth) {
        return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user?.permissions?.teamWorkspace) {
        return (
            <div className="p-4">
              <Alert variant="destructive">
                  <Icons.AlertCircle className="h-4 w-4" />
                  <AlertTitle>Access Denied</AlertTitle>
                  <AlertDescription>You do not have permission to view the Team Workspace.</AlertDescription>
              </Alert>
            </div>
        );
    }
    
    const handleCloseConversation = () => {
        setSelectedConversationId(null);
    };

    return (
        <div className="flex h-full border rounded-lg overflow-hidden shadow-sm bg-card">
            <div className="flex-shrink-0 w-auto min-w-[350px] max-w-md border-r flex flex-col h-full overflow-hidden">
                <ConversationList onSelectConversation={setSelectedConversationId} />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <ChatPanel
                    conversationId={selectedConversationId}
                    onClose={handleCloseConversation}
                />
            </div>
        </div>
    );
}
