
"use client";

import React from 'react';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}
