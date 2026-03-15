
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

export default function TeamWorkspaceRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/team-workspace/messages');
  }, [router]);

  return (
      <div className="w-full p-4">
        <Icons.Spinner className="h-8 w-8 animate-spin" /> 
        <p className="ml-2">Loading Workspace...</p>
      </div>
  );
}
