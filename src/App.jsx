import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { supabase } from './supabaseClient';
import Login from './Login';
import Dashboard from './Dashboard';
import BiayaOperasional from './BiayaOperasional';
import DataPenghasilan from './DataPenghasilan';
import RekapPesanan from './RekapPesanan';
import AnalisaProduk from './AnalisaProduk';
import InfoStock from './InfoStock';
import Profil from './Profil';

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  
  const { setUserProfile } = useApp();

  // Cek sesi login & ambil profil dari Supabase saat aplikasi pertama kali dimuat / di-refresh
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsLoggedIn(true);

          // Ambil data profil dari tabel 'profiles'
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (data) {
            setUserProfile({
              name: data.name || 'Punya Saya',
              avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
            });
          }
        } else {
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error('Gagal mengecek sesi:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserSession();

    // Listener jika status auth berubah (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setIsLoggedIn(true);
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (data) {
          setUserProfile({
            name: data.name || 'Punya Saya',
            avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
          });
        }
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [setUserProfile]);

  // Tampilkan loading sebentar saat mengecek sesi agar tidak kedip ke halaman login
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-blue-600 text-white font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium tracking-wide">Memuat Aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  const handleNavigate = (page) => {
    if (page === 'logout') {
      supabase.auth.signOut();
      setIsLoggedIn(false);
      setActivePage('dashboard');
    } else {
      setActivePage(page);
    }
  };

  return (
    <div>
      {activePage === 'dashboard' && (
        <Dashboard onNavigate={handleNavigate} />
      )}
      {activePage === 'biaya-operasional' && (
        <BiayaOperasional onNavigate={handleNavigate} />
      )}
      {activePage === 'data-penghasilan' && (
        <DataPenghasilan onNavigate={handleNavigate} />
      )}
      {activePage === 'rekap-pesanan' && (
        <RekapPesanan onNavigate={handleNavigate} />
      )}
      {activePage === 'analisa-produk' && (
        <AnalisaProduk onNavigate={handleNavigate} />
      )}
      {activePage === 'info-stock' && (
        <InfoStock onNavigate={handleNavigate} />
      )}
      {activePage === 'profil' && (
        <Profil onNavigate={handleNavigate} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}