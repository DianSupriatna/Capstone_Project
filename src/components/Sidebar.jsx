import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  BarChart3, 
  Package, 
  LogOut, 
  ChevronDown,
  ShoppingBag
} from 'lucide-react';
import { supabase } from '../supabaseClient'; // Path diperbaiki naik satu tingkat ke folder src

export default function Sidebar({ isSidebarOpen, onNavigate, userProfile, activeMenu = 'data-penghasilan' }) {
  // Mengecek apakah menu yang aktif ada di dalam Laba/Profit
  const isLabaActive = activeMenu === 'biaya-operasional' || activeMenu === 'data-penghasilan';
  
  // State untuk kontrol buka-tutup menu Laba/Profit
  const [isLabaOpen, setIsLabaOpen] = useState(isLabaActive);

  // Handle Logout Fungsional ke Supabase Auth
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      if (onNavigate) {
        onNavigate('logout');
      }
    } catch (err) {
      console.error('Gagal melakukan logout:', err.message);
    }
  };

  return (
    <aside className={`bg-blue-600 text-white flex flex-col justify-between shadow-lg flex-shrink-0 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
      <div className="w-64 overflow-y-auto">
        <div 
          onClick={() => onNavigate && onNavigate('profil')}
          className="p-6 flex flex-col items-center border-b border-blue-500 cursor-pointer hover:bg-blue-700/50 transition"
        >
          <div className="w-20 h-20 rounded-full bg-gray-300 overflow-hidden mb-3 border-2 border-white shadow-md flex-shrink-0">
            <img 
              src={userProfile?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80"} 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="font-bold text-lg text-white truncate max-w-[180px]">{userProfile?.name || "Punya Saya"}</h2>
          <span className="text-xs text-blue-200">Pengguna</span>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {/* Dashboard */}
          <div 
            onClick={() => onNavigate && onNavigate('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
              activeMenu === 'dashboard' ? 'bg-blue-700 text-white font-medium shadow-sm' : 'text-blue-100 hover:bg-blue-500/50'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </div>

          {/* Menu Rekap Pesanan (Baru Ditambahkan) */}
          <div 
            onClick={() => onNavigate && onNavigate('rekap-pesanan')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
              activeMenu === 'rekap-pesanan' ? 'bg-blue-700 text-white font-medium shadow-sm' : 'text-blue-100 hover:bg-blue-500/50'
            }`}
          >
            <ShoppingBag size={20} />
            <span>Rekap Pesanan</span>
          </div>

          {/* Menu Laba/Profit Dropdown */}
          <div className="space-y-1">
            <div 
              onClick={() => setIsLabaOpen(!isLabaOpen)}
              className={`flex items-center justify-between px-4 py-3 rounded-lg font-medium cursor-pointer transition ${
                isLabaActive || isLabaOpen ? 'bg-blue-700 text-white shadow-sm' : 'text-blue-100 hover:bg-blue-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <TrendingUp size={20} />
                <span>Laba/Profit</span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-300 ${isLabaOpen ? 'rotate-180' : ''}`} />
            </div>

            {isLabaOpen && (
              <div className="pl-11 pr-4 space-y-1 py-1 text-sm transition-all">
                <div 
                  onClick={() => onNavigate && onNavigate('biaya-operasional')}
                  className={`block py-1.5 transition cursor-pointer ${
                    activeMenu === 'biaya-operasional' ? 'text-white font-medium' : 'text-blue-200 hover:text-white'
                  }`}
                >
                  • Biaya Operasional
                </div>
                <div 
                  onClick={() => onNavigate && onNavigate('data-penghasilan')}
                  className={`block py-1.5 transition cursor-pointer ${
                    activeMenu === 'data-penghasilan' ? 'text-white font-medium' : 'text-blue-200 hover:text-white'
                  }`}
                >
                  • Data Penghasilan
                </div>
              </div>
            )}
          </div>

          {/* Analisa Produk */}
          <div 
            onClick={() => onNavigate && onNavigate('analisa-produk')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
              activeMenu === 'analisa-produk' ? 'bg-blue-700 text-white font-medium shadow-sm' : 'text-blue-100 hover:bg-blue-500/50'
            }`}
          >
            <BarChart3 size={20} />
            <span>Analisa Produk</span>
          </div>

          {/* Info Stock */}
          <div 
            onClick={() => onNavigate && onNavigate('info-stock')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
              activeMenu === 'info-stock' ? 'bg-blue-700 text-white font-medium shadow-sm' : 'text-blue-100 hover:bg-blue-500/50'
            }`}
          >
            <Package size={20} />
            <span>Info Stock</span>
          </div>
        </nav>
      </div>

      <div className="w-64 p-4 border-t border-blue-500 flex-shrink-0">
        <button 
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 text-blue-100 hover:text-white transition w-full px-4 py-2 cursor-pointer"
        >
          <LogOut size={20} />
          <span className="font-medium">Log Out</span>
        </button>
      </div>
    </aside>
  );
}