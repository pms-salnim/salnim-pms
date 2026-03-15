"use client";

import React from "react";
import { ArrowRight } from 'lucide-react';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  secondary?: boolean;
  onClick?: () => void;
}

export function ActionButton({ icon, label, secondary, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 rounded-lg text-xs font-bold transition-all bg-white/10 text-white hover:bg-white/20 border border-white/10"
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      <ArrowRight className="w-3 h-3 opacity-50" />
    </button>
  );
}
