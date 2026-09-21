import React from 'react';
import { Package, Clock } from 'lucide-react';

export function InventoryScreen() {
  return (
    <div className="py-16 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-[6px] border border-[#D9DEDA] shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-[#F0F5F9] text-[#16324F] rounded-[6px] flex items-center justify-center mx-auto border border-[#D1E0EC]">
          <Package className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-[#16324F]">Branch Inventory</h2>
        <p className="text-sm text-[#5B6670] leading-relaxed">
          Inventory opens in the next release.
        </p>
        <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-[#5B6670]">
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled for Phase 2 deployment</span>
        </div>
      </div>
    </div>
  );
}
