'use client';

import React from 'react';

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 bg-[#F4F7FB]/90 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <span>RETINA-MITRA Clinical Portal</span>
      </div>
    </header>
  );
}
