import React, { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Camera, 
  Save 
} from 'lucide-react';

// Import Komponen Reusable & Context
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import { useApp } from './context/AppContext';
import { supabase } from './supabaseClient';

export default function Profil({ onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Mengambil userProfile dan setter-nya dari Global Context
  const { userProfile, setUserProfile } = useApp();

  // State lokal untuk form profil
  const [name, setName] = useState(userProfile?.name || 'Punya Saya');
  const [avatar, setAvatar] = useState(userProfile?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80');
  
  // State untuk password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status loading & notifikasi
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Ambil data profil dari tabel Supabase saat halaman dimuat
  useEffect(() => {
    const fetchProfileFromSupabase = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.warn('Sesi tidak ditemukan, mengarahkan ke login...');
          if (onNavigate) onNavigate('logout');
          return;
        }

        const user = session.user;
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (data) {
            if (data.name) setName(data.name);
            if (data.avatar) setAvatar(data.avatar);
            setUserProfile({ name: data.name || 'Punya Saya', avatar: data.avatar || avatar });
          }
        }
      } catch (err) {
        console.error('Gagal memuat profil:', err.message);
      }
    };

    fetchProfileFromSupabase();
  }, []);

  // Handle Upload Foto Profil dari Komputer
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Ukuran foto terlalu besar! Maksimal 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Simpan Perubahan Profil & Password ke Database Supabase
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Sesi login kedaluwarsa. Silakan login ulang.');
      }

      // 1. Jika user mengisi password baru, lakukan validasi & update ke Supabase Auth
      if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
          showToast('Gagal: Password baru dan konfirmasi tidak cocok!');
          setLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          showToast('Gagal: Password baru minimal harus 6 karakter!');
          setLoading(false);
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (updateError) throw updateError;
      }

      // 2. Simpan/Update Nama dan Avatar ke tabel 'profiles' Supabase (hanya kolom id, name, avatar)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: name,
          avatar: avatar
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Detail Error Supabase Profiles:', profileError);
        throw profileError;
      }

      // 3. Perbarui state global userProfile
      setUserProfile({ name, avatar });

      // Reset form password setelah berhasil
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      showToast('Profil berhasil disimpan ke database!');
    } catch (error) {
      console.error('Gagal memperbarui profil:', error.message);
      showToast(`Gagal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">
      
      {/* Panggil Komponen Toast */}
      <Toast message={toastMessage} />

      {/* Panggil Komponen Sidebar */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate} 
        userProfile={{ name, avatar }} 
        activeMenu="profil" 
      />

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Panggil Komponen Topbar */}
        <Topbar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          title="Pengaturan Profil Pengguna"
        />

        {/* Form Profil Body */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-200 space-y-6">

            <form onSubmit={handleSaveProfile} className="space-y-6">
              
              {/* Bagian Foto Profil */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-100">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-blue-100 shadow-md bg-gray-100">
                    <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                  </div>
                  <label className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition cursor-pointer">
                    <Camera size={24} />
                    <span className="text-[10px] font-bold mt-1">Ganti Foto</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="font-bold text-gray-800 text-base">Foto Profil Marketplace</h3>
                  <p className="text-xs text-gray-400 mt-1">Unggah foto baru format JPG, PNG, atau GIF (Maks. 2MB).</p>
                </div>
              </div>

              {/* Ganti Nama */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Nama Pengguna / Toko</label>
                <div className="flex items-center border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus-within:border-blue-600 focus-within:bg-white transition shadow-sm">
                  <User size={18} className="text-gray-400 mr-3" />
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-transparent outline-none text-sm text-gray-700 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Bagian Ubah Password */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <Lock size={16} className="text-blue-600" />
                  <span>Ubah Kata Sandi (Opsional)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Password Lama</label>
                    <input 
                      type="password" 
                      value={oldPassword} 
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-600 bg-gray-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Password Baru</label>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter" 
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-600 bg-gray-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Konfirmasi Password Baru</label>
                    <input 
                      type="password" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru" 
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-600 bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              {/* Tombol Simpan */}
              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`text-white font-bold py-3 px-8 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer ${
                    loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Save size={18} />
                  <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>

      </main>
    </div>
  );
}