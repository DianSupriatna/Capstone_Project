import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient'; // Import Supabase Client

// Import Komponen Reusable
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import Modal from './components/Modal';
import { useApp } from './context/AppContext';

export default function BiayaOperasional({ onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Mengambil state global dan fungsi validasi dari AppContext
  const { userProfile, biayaOperasionalList, setBiayaOperasionalList, validatePositiveNumber } = useApp();

  // Format Tanggal Default Hari Ini (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  // State Form Biaya Operasional
  const [tanggal, setTanggal] = useState(todayStr);
  const [jenisBiaya, setJenisBiaya] = useState('Refund');
  const [keterangan1, setKeterangan1] = useState('Barang Kurang');
  const [jumlah, setJumlah] = useState('1 Pcs');
  const [nominal, setNominal] = useState('10000');
  const [biayaLainnya, setBiayaLainnya] = useState('2500');
  const [keteranganLainnya, setKeteranganLainnya] = useState('Adm Transfer');

  // Filter Rentang Tanggal State
  const [filterPeriode, setFilterPeriode] = useState('semua');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // Toast Notifikasi State
  const [toastMessage, setToastMessage] = useState(null);

  // Modal Custom State
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    selectedId: null
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Format Rupiah Helper
  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  };

  // --- AMBIL DATA DARI SUPABASE SAAT HALAMAN DIBUKA ---
  const fetchOperasionalData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('operational_costs')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setBiayaOperasionalList(data || []);
    } catch (err) {
      console.error('Gagal mengambil data operasional:', err);
      showToast('Gagal memuat data riwayat dari database.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchOperasionalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Simpan Transaksi ke Supabase dengan Validasi Ketat
  const handleSimpan = async (e) => {
    e.preventDefault();

    if (!validatePositiveNumber(nominal)) {
      showToast('Nominal harus diisi dengan angka positif yang valid!');
      return;
    }

    if (!validatePositiveNumber(biayaLainnya)) {
      showToast('Biaya lainnya harus diisi dengan angka positif yang valid!');
      return;
    }

    // Ekstrak angka dari string (contoh: "1 Pcs" menjadi 1) untuk masuk ke kolom integer
    const quantityInt = parseInt(jumlah.replace(/\D/g, ''), 10) || 1;

    try {
      const { error } = await supabase
        .from('operational_costs')
        .insert([{
          transaction_date: tanggal,
          cost_type: jenisBiaya,
          description: keterangan1,
          quantity: quantityInt,
          nominal: Number(nominal),
          other_cost: Number(biayaLainnya) || 0,
          other_description: keteranganLainnya
        }]);

      if (error) throw error;

      showToast('Biaya operasional berhasil disimpan ke Database!');
      
      // Ambil ulang data terbaru setelah berhasil simpan
      await fetchOperasionalData();
    } catch (error) {
      console.error('Gagal menyimpan:', error);
      showToast('Terjadi kesalahan saat menyimpan ke database!');
    }
  };

  // Buka Modal Konfirmasi Hapus
  const handleAskDelete = (id) => {
    setDeleteModal({
      isOpen: true,
      selectedId: id
    });
  };

  // Eksekusi Hapus dari Supabase dan Modal Custom
  const handleConfirmDelete = async () => {
    if (deleteModal.selectedId) {
      try {
        const { error } = await supabase
          .from('operational_costs')
          .delete()
          .match({ id: deleteModal.selectedId });

        if (error) throw error;

        showToast('Transaksi berhasil dihapus dari database.');
        // Ambil ulang data terbaru setelah dihapus
        await fetchOperasionalData();
      } catch (error) {
        console.error('Gagal menghapus:', error);
        showToast('Terjadi kesalahan saat menghapus data.');
      }
    }
    setDeleteModal({ isOpen: false, selectedId: null });
  };

  // --- LOGIKA FILTER TANGGAL (CUSTOM DATE RANGE) ---
  const filteredOperasionalList = useMemo(() => {
    return biayaOperasionalList.filter(item => {
      if (filterPeriode === 'custom' && (startDate || endDate)) {
        // Ambil property tanggal dari Supabase (transaction_date) atau fallback state lokal (tanggal)
        const itemDateStr = item.transaction_date || item.tanggal; 
        if (!itemDateStr) return true;

        const txDate = new Date(itemDateStr);
        
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          if (txDate < sDate) return false;
        }
        
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          if (txDate > eDate) return false;
        }
      }
      return true;
    });
  }, [biayaOperasionalList, filterPeriode, startDate, endDate]);


  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">
      
      {/* Toast Notifikasi */}
      <Toast message={toastMessage} />

      {/* Modal Dialog Custom Reusable */}
      <Modal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, selectedId: null })}
        onConfirm={handleConfirmDelete}
        title="Hapus Transaksi Biaya"
        message="Apakah Anda yakin ingin menghapus catatan transaksi biaya operasional ini dari riwayat secara permanen (database)?"
        type="danger"
        confirmText="Hapus Transaksi"
        cancelText="Batal"
      />

      {/* Sidebar Reusable */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate} 
        userProfile={userProfile} 
        activeMenu="biaya-operasional" 
      />

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Topbar Reusable */}
        <Topbar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          title="Biaya Operasional"
        />

        {/* Isi Halaman Biaya Operasional */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* FORM INPUT BIAYA OPERASIONAL */}
          <form onSubmit={handleSimpan} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            
            {/* Baris 1: Tanggal Transaksi & Tombol Hari Ini */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-blue-600 mb-2">Tanggal transaksi</label>
                <div className="flex items-center justify-between border border-blue-300 rounded-xl px-4 py-2 bg-white shadow-sm">
                  <input 
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full text-blue-600 font-medium text-sm bg-transparent outline-none cursor-pointer"
                    required
                  />
                </div>
              </div>
              <div className="sm:self-end">
                <button 
                  type="button"
                  onClick={() => setTanggal(todayStr)}
                  className="flex items-center gap-2 border border-blue-300 text-blue-600 hover:bg-blue-50 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer"
                >
                  <Calendar size={16} />
                  <span>Hari Ini</span>
                </button>
              </div>
            </div>

            {/* Baris 2: Jenis Biaya & Keterangan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-blue-600 mb-2">Jenis Biaya</label>
                <div className="flex items-center border border-blue-300 rounded-xl px-4 py-2 bg-white shadow-sm">
                  <select 
                    value={jenisBiaya}
                    onChange={(e) => setJenisBiaya(e.target.value)}
                    className="w-full text-blue-600 font-medium text-sm bg-transparent outline-none cursor-pointer"
                  >
                    <option value="Refund">Refund</option>
                    <option value="Operasional Toko">Operasional Toko</option>
                    <option value="Marketing / Iklan">Marketing / Iklan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-blue-600 mb-2">Keterangan</label>
                <div className="flex items-center border border-blue-300 rounded-xl px-4 py-2 bg-white shadow-sm">
                  <select 
                    value={keterangan1}
                    onChange={(e) => setKeterangan1(e.target.value)}
                    className="w-full text-blue-600 font-medium text-sm bg-transparent outline-none cursor-pointer"
                  >
                    <option value="Barang Kurang">Barang Kurang</option>
                    <option value="Retur Pelanggan">Retur Pelanggan</option>
                    <option value="Packaging Rusak">Packaging Rusak</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Baris 3: Jumlah & Nominal (Rp) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-blue-600 mb-2">Jumlah</label>
                <div className="flex items-center border border-blue-300 rounded-xl px-4 py-2 bg-white shadow-sm">
                  <select 
                    value={jumlah}
                    onChange={(e) => setJumlah(e.target.value)}
                    className="w-full text-blue-600 font-medium text-sm bg-transparent outline-none cursor-pointer"
                  >
                    <option value="1 Pcs">1 Pcs</option>
                    <option value="2 Pcs">2 Pcs</option>
                    <option value="3 Pcs">3 Pcs</option>
                    <option value="5 Pcs">5 Pcs</option>
                    <option value="10 Pcs">10 Pcs</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-blue-600 mb-2">Nominal (Rp)</label>
                <div className="flex items-center border border-blue-300 rounded-xl px-4 py-2.5 bg-white shadow-sm">
                  <input 
                    type="number" 
                    min="0"
                    value={nominal} 
                    onChange={(e) => setNominal(e.target.value)}
                    placeholder="Contoh: 10000"
                    className="w-full outline-none text-blue-600 font-medium text-sm bg-transparent" 
                    required
                  />
                </div>
              </div>
            </div>

            {/* Baris 4: Biaya Lainnya (Rp), Keterangan, & Tombol Simpan */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              <div className="lg:col-span-4">
                <label className="block text-sm font-bold text-blue-600 mb-2">Biaya Lainnya (Rp)</label>
                <div className="flex items-center border border-blue-300 rounded-xl px-4 py-2.5 bg-white shadow-sm">
                  <input 
                    type="number" 
                    min="0"
                    value={biayaLainnya} 
                    onChange={(e) => setBiayaLainnya(e.target.value)}
                    placeholder="Contoh: 2500"
                    className="w-full outline-none text-blue-600 font-medium text-sm bg-transparent" 
                  />
                </div>
              </div>
              <div className="lg:col-span-5">
                <label className="block text-sm font-bold text-blue-600 mb-2">Keterangan</label>
                <div className="flex items-center border border-blue-300 rounded-xl px-4 py-2.5 bg-white shadow-sm">
                  <input 
                    type="text" 
                    value={keteranganLainnya} 
                    onChange={(e) => setKeteranganLainnya(e.target.value)}
                    placeholder="Contoh: Adm Transfer"
                    className="w-full outline-none text-blue-600 font-medium text-sm bg-transparent" 
                  />
                </div>
              </div>
              <div className="lg:col-span-3">
                <button 
                  type="submit"
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-xl shadow-md transition cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </div>

          </form>

          {/* BAGIAN RIWAYAT TRANSAKSI DENGAN FILTER TANGGAL */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Clock size={20} />
                <span>Riwayat Transaksi</span>
              </div>

              {/* Filter Rentang Tanggal (Custom Date) */}
              <div className="flex items-center gap-2 flex-wrap bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                <button 
                  onClick={() => {
                    setFilterPeriode('semua');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterPeriode === 'semua' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Semua Data
                </button>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-1 rounded-lg">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setFilterPeriode('custom');
                    }}
                    title="Dari Tanggal"
                    className="bg-transparent text-xs font-medium text-gray-700 outline-none px-1 cursor-pointer"
                  />
                  <span className="text-gray-400 font-bold">-</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setFilterPeriode('custom');
                    }}
                    title="Sampai Tanggal"
                    className="bg-transparent text-xs font-medium text-gray-700 outline-none px-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Tabel Riwayat Transaksi Fungsional */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50">
                      <th className="p-3">#</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Jenis Biaya</th>
                      <th className="p-3">Keterangan</th>
                      <th className="p-3">Jumlah</th>
                      <th className="p-3">Nominal</th>
                      <th className="p-3">Biaya Lainnya</th>
                      <th className="p-3">Ket. Lainnya</th>
                      <th className="p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {loadingData ? (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-gray-400 font-medium">Memuat data dari Supabase...</td>
                      </tr>
                    ) : filteredOperasionalList.length > 0 ? (
                      filteredOperasionalList.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 font-medium text-gray-500">{idx + 1}</td>
                          <td className="p-3">{item.transaction_date || item.tanggal}</td>
                          <td className="p-3 font-bold text-blue-600">{item.cost_type || item.jenisBiaya}</td>
                          <td className="p-3">{item.description || item.keterangan}</td>
                          <td className="p-3">{item.quantity ? `${item.quantity} Pcs` : item.jumlah}</td>
                          <td className="p-3 font-medium">{formatRupiah(item.nominal)}</td>
                          <td className="p-3 font-medium">{formatRupiah(item.other_cost || item.biayaLainnya)}</td>
                          <td className="p-3 text-gray-500">{item.other_description || item.ketLainnya}</td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => handleAskDelete(item.id)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition inline-flex items-center cursor-pointer"
                              title="Hapus Transaksi"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-gray-400 font-medium">
                          Belum ada riwayat transaksi biaya operasional.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}