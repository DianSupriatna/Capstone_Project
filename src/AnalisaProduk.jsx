import React, { useState, useMemo, useEffect } from 'react';
import { 
  Award,
  Search,
  TrendingUp
} from 'lucide-react';

// Import Komponen Reusable & Context
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import { supabase } from './supabaseClient';
import { useApp } from './context/AppContext';

export default function AnalisaProduk({ onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Mengambil userProfile dari Global Context
  const { userProfile } = useApp();

  // Filter Tanggal
  const [dariTanggal, setDariTanggal] = useState('2026-10-01');
  const [sampaiTanggal, setSampaiTanggal] = useState('2026-10-18');
  const [searchProduk, setSearchProduk] = useState('');

  // State Data Transaksi dari Supabase
  const [transactionList, setTransactionList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch data transaksi dari Supabase saat komponen dimuat
  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('transaction_details').select('*');
        if (error) {
          console.error('Gagal memuat transaksi:', error);
        } else if (data) {
          setTransactionList(data);
        }
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  };

  // FILTER TANGGAL: Menyaring transaksi berdasarkan rentang tanggal
  const filteredTransactionsByDate = useMemo(() => {
    if (!transactionList || transactionList.length === 0) return [];
    if (!dariTanggal || !sampaiTanggal) return transactionList;

    return transactionList.filter(item => {
      const rawDate = item.transaction_date || item.tanggal || '';
      if (!rawDate) return true;
      const itemDate = rawDate.toString().split('T')[0].trim();
      return itemDate >= dariTanggal && itemDate <= sampaiTanggal;
    });
  }, [transactionList, dariTanggal, sampaiTanggal]);

  // OPTIMASI PERFORMA: Agregasi & Sorting menggunakan useMemo dari data Supabase
  const produkPalingLarisList = useMemo(() => {
    const aggregatedProductsMap = {};

    filteredTransactionsByDate.forEach(item => {
      // Memisahkan ID SKU dan Nama Produk dari format string (jika ada newline)
      const splitSku = (item.product_sku || '').split('\n');
      const namaSku = splitSku[1] || item.product_sku || 'Produk Tanpa Nama';
      const varian = splitSku[0] || 'Standar';

      if (!aggregatedProductsMap[namaSku]) {
        aggregatedProductsMap[namaSku] = {
          namaSku: namaSku,
          varian: varian,
          totalQty: 0,
          totalOmset: 0,
          jumlahTransaksi: 0
        };
      }
      aggregatedProductsMap[namaSku].totalQty += Number(item.quantity || 0);
      aggregatedProductsMap[namaSku].totalOmset += Number(item.marketplace_omzet || 0);
      aggregatedProductsMap[namaSku].jumlahTransaksi += 1;
    });

    return Object.values(aggregatedProductsMap).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredTransactionsByDate]);

  // OPTIMASI PERFORMA: Pencarian menggunakan useMemo
  const filteredProduk = useMemo(() => {
    return produkPalingLarisList.filter(prod => 
      prod.namaSku.toLowerCase().includes(searchProduk.toLowerCase())
    );
  }, [produkPalingLarisList, searchProduk]);

  const handleTampilkanFilter = () => {
    showToast(`Menampilkan data dari tanggal ${dariTanggal} s/d ${sampaiTanggal}`);
  };

  const handleSetHariIni = () => {
    const today = new Date().toISOString().split('T')[0];
    setDariTanggal(today);
    setSampaiTanggal(today);
    showToast(`Filter diatur ke Hari Ini`);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">
      
      {/* Toast Notifikasi */}
      <Toast message={toastMessage} />

      {/* Sidebar Reusable */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate} 
        userProfile={userProfile} 
        activeMenu="analisa-produk" 
      />

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Topbar Reusable */}
        <Topbar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          title="Analisa Produk"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-gray-500 font-medium">Dari:</span>
              <input 
                type="date" 
                value={dariTanggal} 
                onChange={(e) => setDariTanggal(e.target.value)}
                className="bg-transparent outline-none text-gray-700 font-medium cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-gray-500 font-medium">Sampai:</span>
              <input 
                type="date" 
                value={sampaiTanggal} 
                onChange={(e) => setSampaiTanggal(e.target.value)}
                className="bg-transparent outline-none text-gray-700 font-medium cursor-pointer"
              />
            </div>

            <button 
              onClick={handleTampilkanFilter}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition cursor-pointer"
            >
              Tampilkan
            </button>

            <button 
              onClick={handleSetHariIni}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition cursor-pointer"
            >
              Hari Ini
            </button>
          </div>
        </Topbar>

        {/* Isi Halaman */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* BAGIAN 1: TABEL PRODUK PALING LARIS */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                <Award size={18} className="text-amber-500" />
                <span>Produk Paling Laris (Akumulasi dari Database Supabase)</span>
              </div>

              {/* Input Search Produk */}
              <div className="flex items-center border border-gray-300 rounded-xl px-2.5 py-1.5 bg-white text-xs shadow-sm w-full sm:w-64">
                <Search size={14} className="text-gray-400 mr-2" />
                <input 
                  type="text"
                  value={searchProduk}
                  onChange={(e) => setSearchProduk(e.target.value)}
                  placeholder="Cari nama produk..."
                  className="w-full outline-none text-gray-700 bg-transparent text-xs"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                    <tr className="border-b border-gray-200 text-gray-500 font-semibold">
                      <th className="p-3.5 bg-gray-50 text-center w-12">Peringkat</th>
                      <th className="p-3.5 bg-gray-50">Nama SKU Produk</th>
                      <th className="p-3.5 bg-gray-50">Varian</th>
                      <th className="p-3.5 bg-gray-50 text-center">Total Terjual (Qty)</th>
                      <th className="p-3.5 bg-gray-50">Total Omset Penjualan</th>
                      <th className="p-3.5 bg-gray-50 text-center">Frekuensi Transaksi</th>
                      <th className="p-3.5 bg-gray-50 text-center">Status Performa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-400 font-medium">
                          Memuat data analisis produk dari Supabase...
                        </td>
                      </tr>
                    ) : filteredProduk.length > 0 ? (
                      filteredProduk.map((prod, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition">
                          <td className="p-3.5 text-center font-bold">
                            {idx === 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-400 text-white rounded-full shadow-sm">🥇 1</span>
                            ) : idx === 1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-300 text-white rounded-full shadow-sm">🥈 2</span>
                            ) : idx === 2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-600 text-white rounded-full shadow-sm">🥉 3</span>
                            ) : (
                              <span className="text-gray-500">{idx + 1}</span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-gray-800">{prod.namaSku}</td>
                          <td className="p-3.5 text-gray-500">{prod.varian}</td>
                          <td className="p-3.5 text-center font-bold text-blue-600 text-sm">{prod.totalQty} Pcs</td>
                          <td className="p-3.5 font-bold text-emerald-600">{formatRupiah(prod.totalOmset)}</td>
                          <td className="p-3.5 text-center font-medium text-gray-600">{prod.jumlahTransaksi} Transaksi</td>
                          <td className="p-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm ${
                              idx < 3 ? 'bg-emerald-600' : 'bg-blue-600'
                            }`}>
                              {idx < 3 ? '🔥 Best Seller' : '⚡ Stabil'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-400 font-medium">
                          Tidak ada produk yang cocok dengan pencarian atau periode tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* BAGIAN 2: REKOMENDASI UNTUK IKLAN MINGGU INI */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
              <TrendingUp size={18} className="text-blue-600" />
              <span>Rekomendasi Produk untuk Iklan & Promosi Minggu Ini</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {produkPalingLarisList.length > 0 ? (
                produkPalingLarisList.slice(0, 3).map((item, index) => (
                  <div key={index} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Top #{index + 1} Prioritas Iklan
                      </span>
                      <h4 className="font-bold text-gray-800 text-xs mt-2">{item.namaSku}</h4>
                      <p className="text-[11px] text-gray-400 mt-1">Total terjual: <strong className="text-blue-600">{item.totalQty} Pcs</strong> dengan omset {formatRupiah(item.totalOmset)}</p>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-xl text-[11px] text-blue-800 font-medium">
                      💡 Rekomendasi: Sangat direkomendasikan untuk dinaikkan budget iklan Shopee Ads karena memiliki konversi pembelian tertinggi pada rentang tanggal ini.
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 bg-white p-6 rounded-2xl text-center text-gray-400 text-xs border border-gray-200">
                  Belum ada data produk untuk rekomendasi iklan pada periode ini.
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}