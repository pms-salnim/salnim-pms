
"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Icons } from '@/components/icons';

const TeamWorkspaceMessages = dynamic(() => import('@/components/team-workspace/messages/page'), {
  loading: () => <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>,
  ssr: false,
});

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>}>
        <TeamWorkspaceMessages />
    </Suspense>
  );
}
