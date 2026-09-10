import React from 'react';
import { I } from './ui';

export function Loading({ text = "Загрузка..." }: { text?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-line"></div>
          <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
        </div>
        <p className="text-sm font-bold text-mute">{text}</p>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-line animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-line rounded animate-pulse w-3/4"></div>
            <div className="h-3 bg-line rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="card p-6">
      <LoadingSkeleton lines={4} />
    </div>
  );
}
