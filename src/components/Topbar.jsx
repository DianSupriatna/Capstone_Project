import React from 'react';
import { Menu, TrendingUp, Filter } from 'lucide-react';

// 1. Tambahkan prop "children" di sini
export default function Topbar({ 
  isSidebarOpen, 
  setIsSidebarOpen, 
  title = "Laba/Profit Marketplace & Rekap Keuangan", 
  filterPeriode, 
  setFilterPeriode,
  children 
}) {
  const tabs = [
    { id: 'semua', label: 'Semua' },
    { id: 'hari', label: 'Hari Ini' },
    { id: 'minggu', label: 'Minggu Ini' },
    { id: 'bulan', label: 'Bulan Ini' },
    { id: 'tahun', label: 'Tahun Ini' }
  ];

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-gray-600 hover:text-black focus:outline-none transition-transform active:scale-95 cursor-pointer"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
          <TrendingUp size={18} />
          <span>{title}</span>
        </div>
      </div>

      {/* Bagian Kanan Header */}
      <div className="flex items-center gap-3">
        {/* Jika ada filterPeriode, tampilkan tab */}
        {filterPeriode && setFilterPeriode && (
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <Filter size={13} className="text-gray-400 ml-2" />
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterPeriode(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  filterPeriode === tab.id 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        
        {/* 2. Tambahkan {children} di sini agar bisa diisi komponen custom (seperti kalender) */}
        {children}
      </div>
    </header>
  );
}