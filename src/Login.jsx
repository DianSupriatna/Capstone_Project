import React, { useState } from 'react';
import { Lock, Mail, LogIn } from 'lucide-react';
import { supabase } from './supabaseClient'; // Import Supabase Client
import Toast from './components/Toast';     // Import Toast Notifikasi

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fungsi Login Asli Terhubung ke Supabase Auth
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      showToast('Login Berhasil! Mengalihkan ke Dashboard...');
      
      // Beri jeda sedikit agar toast sempat terbaca, lalu panggil callback sukses
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      }, 1000);

    } catch (error) {
      console.error('Gagal login:', error.message);
      showToast('Login Gagal: Email atau Password salah!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 font-sans px-4 relative">
      
      {/* Toast Notifikasi */}
      <Toast message={toastMessage} />

      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl border border-gray-100 space-y-8">
        
        {/* Logo / Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center border-4 border-blue-50 shadow-inner">
            <Mail size={42} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Selamat Datang</h1>
          <p className="text-sm text-gray-400">Silakan masuk menggunakan akun internal Anda</p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Email</label>
            <div className="flex items-center border border-gray-300 rounded-2xl px-4 py-3 bg-gray-50 focus-within:border-blue-600 focus-within:bg-white transition shadow-sm">
              <Mail size={18} className="text-gray-400 mr-3" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Contoh: capstone@a.com" 
                className="w-full bg-transparent outline-none text-sm text-gray-700 font-medium"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">Password</label>
            <div className="flex items-center border border-gray-300 rounded-2xl px-4 py-3 bg-gray-50 focus-within:border-blue-600 focus-within:bg-white transition shadow-sm">
              <Lock size={18} className="text-gray-400 mr-3" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password" 
                className="w-full bg-transparent outline-none text-sm text-gray-700 font-medium"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            }`}
          >
            <LogIn size={18} />
            <span>{loading ? 'Memproses Masuk...' : 'Masuk Dashboard'}</span>
          </button>
        </form>

        <div className="text-center text-xs text-gray-400">
          Capstone Project Kelompok A &copy; 2026
        </div>

      </div>
    </div>
  );
}