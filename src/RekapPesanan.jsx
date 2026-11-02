import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Upload, 
  Search, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Clock,
  ChevronDown,
  ChevronRight,
  Layers,
  XCircle
} from 'lucide-react';
import { supabase } from './supabaseClient';

// Import Komponen Reusable
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast'; 
import Modal from './components/Modal';
import { parseOrderExcel } from './utils/fileHelpers';
import { useApp } from './context/AppContext';

export default function RekapPesanan({ onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { userProfile } = useApp();

  // State File & Preview Mode
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState({
    namaFile: 'Belum ada file dipilih',
    totalItems: 0,
    totalQtyPcs: 0,
    totalNilaiPesanan: 0,
    totalBatalCount: 0,
    orderList: []
  });

  // State Database View (Master Order di Supabase)
  const [dbOrders, setDbOrders] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // State Accordion
  const [expandedOrders, setExpandedOrders] = useState({});

  // Filter & Search State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatusPesanan, setFilterStatusPesanan] = useState('aktif'); // 'semua', 'aktif', 'dibatalkan'
  const [filterPencairan, setFilterPencairan] = useState('semua');

  // Toast & Modal Config
  const [toastMessage, setToastMessage] = useState(null);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: null
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  };

  // Fetch Master Orders dari Supabase
  const fetchDbOrders = async () => {
    setLoadingDb(true);
    try {
      const { data, error } = await supabase
        .from('orders_master')
        .select('*')
        .order('order_date', { ascending: false });

      if (error) throw error;
      setDbOrders(data || []);
    } catch (err) {
      console.error('Gagal mengambil data orders_master:', err);
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchDbOrders();
  }, []);

  // Handle Pilih File & Review Isi File
  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      try {
        const parsed = await parseOrderExcel(file);
        setPreviewData(parsed);
        showToast(`Berhasil membaca ${parsed.orderList.length} item rincian pesanan dari "${file.name}"!`);
      } catch (err) {
        console.error('Error parsing order file:', err);
        setModalConfig({
          isOpen: true,
          title: 'Format Tidak Sesuai',
          message: 'Gagal membaca file laporan pesanan. Pastikan mengunggah file hasil Ekspor Pesanan dari Shopee.',
          type: 'alert'
        });
      }
    }
  };

  // Simpan Review File ke Database Supabase
  const handleSimpanSupabase = async () => {
    if (!previewData.orderList || previewData.orderList.length === 0) {
      setModalConfig({
        isOpen: true,
        title: 'Tidak Ada Data',
        message: 'Silakan pilih file Laporan Pesanan terlebih dahulu.',
        type: 'alert'
      });
      return;
    }

    try {
      const payload = previewData.orderList.map(item => ({
        order_number: item.noPesanan,
        order_date: item.tanggal,
        sku_id: item.idSku,
        product_name: item.namaSku,
        quantity: item.jumlahQty,
        product_price: item.hargaProduk,
        order_status: item.statusPesanan,
        pencairan_status: 'Belum Cair'
      }));

      const { error } = await supabase
        .from('orders_master')
        .insert(payload);

      if (error) throw error;

      showToast(`Berhasil menyimpan ${payload.length} data pesanan ke Supabase!`);
      setSelectedFile(null);
      setPreviewData({
        namaFile: 'Belum ada file dipilih',
        totalItems: 0,
        totalQtyPcs: 0,
        totalNilaiPesanan: 0,
        totalBatalCount: 0,
        orderList: []
      });

      fetchDbOrders();
    } catch (err) {
      console.error('Gagal simpan ke orders_master:', err);
      setModalConfig({
        isOpen: true,
        title: 'Gagal Menyimpan',
        message: `Terjadi kesalahan saat menyimpan data: ${err.message}`,
        type: 'alert'
      });
    }
  };

  // Hapus Seluruh Pesanan
  const handleHapusOrderGroup = (orderNumber) => {
    setModalConfig({
      isOpen: true,
      title: 'Hapus Pesanan',
      message: `Apakah Anda yakin ingin menghapus No. Pesanan ${orderNumber} dari Supabase?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('orders_master').delete().eq('order_number', orderNumber);
          if (error) throw error;
          showToast('Pesanan berhasil dihapus.');
          fetchDbOrders();
        } catch (err) {
          showToast('Gagal menghapus pesanan.');
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const toggleOrderExpand = (noPesanan) => {
    setExpandedOrders(prev => ({
      ...prev,
      [noPesanan]: !prev[noPesanan]
    }));
  };

  // GROUPING PESANAN & FILTER STATUS ORDER
  const groupedDbOrders = useMemo(() => {
    const filteredFlat = dbOrders.filter(item => {
      const itemDate = item.order_date ? item.order_date.toString().substring(0, 10) : '';
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;

      const q = searchQuery.toLowerCase();
      const matchSearch = (item.order_number || '').toLowerCase().includes(q) ||
                          (item.sku_id || '').toLowerCase().includes(q) ||
                          (item.product_name || '').toLowerCase().includes(q);
      if (!matchSearch) return false;

      // Filter Status Order (Aktif vs Dibatalkan)
      const isItemCancelled = (item.order_status || '').toLowerCase().includes('batal') || (item.order_status || '').toLowerCase().includes('cancel');
      if (filterStatusPesanan === 'aktif' && isItemCancelled) return false;
      if (filterStatusPesanan === 'dibatalkan' && !isItemCancelled) return false;

      // Filter Pencairan
      if (filterPencairan === 'belum_cair' && item.pencairan_status !== 'Belum Cair') return false;
      if (filterPencairan === 'sudah_cair' && item.pencairan_status !== 'Sudah Cair') return false;

      return true;
    });

    const groups = {};
    filteredFlat.forEach(item => {
      const noPesanan = item.order_number || 'UNKNOWN';
      const isItemCancelled = (item.order_status || '').toLowerCase().includes('batal') || (item.order_status || '').toLowerCase().includes('cancel');

      if (!groups[noPesanan]) {
        groups[noPesanan] = {
          noPesanan,
          order_date: item.order_date,
          order_status: isItemCancelled ? 'Dibatalkan' : 'Aktif',
          pencairan_status: item.pencairan_status,
          totalQty: 0,
          totalNominal: 0,
          items: []
        };
      }
      const qty = Number(item.quantity || 1);
      const price = Number(item.product_price || 0);

      groups[noPesanan].totalQty += qty;
      groups[noPesanan].totalNominal += (price * qty);
      groups[noPesanan].items.push(item);
    });

    return Object.values(groups);
  }, [dbOrders, startDate, endDate, searchQuery, filterStatusPesanan, filterPencairan]);

  // RINGKASAN METRICS (TIDAK MENGHITUNG PESANAN BATAL)
  const dbMetrics = useMemo(() => {
    let totalOrderAktif = 0;
    let totalPcsAktif = 0;
    let totalNominalAktif = 0;
    let totalBatalCount = 0;
    let belumCairCount = 0;

    // Hitung seluruh database asli agar metrics selalu presisi
    const orderGroupMap = {};
    dbOrders.forEach(item => {
      const noPesanan = item.order_number;
      if (!orderGroupMap[noPesanan]) {
        orderGroupMap[noPesanan] = {
          isCancelled: (item.order_status || '').toLowerCase().includes('batal') || (item.order_status || '').toLowerCase().includes('cancel'),
          pencairanStatus: item.pencairan_status,
          totalQty: 0,
          totalNominal: 0
        };
      }
      const qty = Number(item.quantity || 1);
      const price = Number(item.product_price || 0);
      orderGroupMap[noPesanan].totalQty += qty;
      orderGroupMap[noPesanan].totalNominal += (price * qty);
    });

    Object.values(orderGroupMap).forEach(group => {
      if (group.isCancelled) {
        totalBatalCount++;
      } else {
        totalOrderAktif++;
        totalPcsAktif += group.totalQty;
        totalNominalAktif += group.totalNominal;
        if (group.pencairanStatus === 'Belum Cair') belumCairCount++;
      }
    });

    return { totalOrderAktif, totalPcsAktif, totalNominalAktif, totalBatalCount, belumCairCount };
  }, [dbOrders]);

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">
      
      <Toast message={toastMessage} />

      <Modal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm || (() => setModalConfig(prev => ({ ...prev, isOpen: false })))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.type === 'danger' ? 'Ya, Hapus' : 'Mengerti'}
      />

      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate} 
        userProfile={userProfile} 
        activeMenu="rekap-pesanan" 
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        <Topbar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          title="Rekap Pesanan Marketplace"
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SECTION 1: UPLOAD FILE & PREVIEW */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-blue-600 text-xs uppercase tracking-wider">1. Import Laporan Ekspor Pesanan Shopee</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  File Aktif: <strong className="text-blue-600">{previewData.namaFile}</strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-semibold text-blue-700 cursor-pointer transition">
                  <Upload size={14} />
                  <span className="truncate max-w-[160px]">{selectedFile ? selectedFile.name : 'Pilih File Laporan Pesanan'}</span>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="hidden" />
                </label>

                <button 
                  onClick={handleSimpanSupabase}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow transition cursor-pointer"
                >
                  Simpan ke Supabase
                </button>
              </div>
            </div>

            {/* KARTU REVIEW PREVIEW */}
            {previewData.orderList.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                    <span className="text-[10px] text-blue-600 font-semibold uppercase">Total Baris Item</span>
                    <h4 className="text-base font-bold text-blue-900">{previewData.totalItems} Item</h4>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                    <span className="text-[10px] text-emerald-600 font-semibold uppercase">Total Qty (Aktif)</span>
                    <h4 className="text-base font-bold text-emerald-900">{previewData.totalQtyPcs} Pcs Presisi</h4>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 p-3 rounded-xl">
                    <span className="text-[10px] text-purple-600 font-semibold uppercase">Total Nilai (Aktif)</span>
                    <h4 className="text-base font-bold text-purple-900">{formatRupiah(previewData.totalNilaiPesanan)}</h4>
                  </div>
                  <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                    <span className="text-[10px] text-red-600 font-semibold uppercase">Pesanan Dibatalkan</span>
                    <h4 className="text-base font-bold text-red-700">{previewData.totalBatalCount} Item (Abaikan)</h4>
                  </div>
                </div>

                {/* TABEL PREVIEW FILE */}
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                      <tr className="border-b border-gray-200">
                        <th className="p-2">No. Pesanan</th>
                        <th className="p-2">Tanggal</th>
                        <th className="p-2">Nama Produk</th>
                        <th className="p-2 text-center">Qty Pcs</th>
                        <th className="p-2">Harga Produk</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.orderList.map((item, idx) => (
                        <tr key={idx} className={item.statusPesanan === 'Dibatalkan' ? 'bg-red-50/40 text-gray-400 line-through' : 'hover:bg-gray-50'}>
                          <td className="p-2 font-mono font-bold text-blue-600">{item.noPesanan}</td>
                          <td className="p-2 text-gray-500">{item.tanggal}</td>
                          <td className="p-2 font-medium">{item.namaSku}</td>
                          <td className="p-2 text-center font-bold">{item.jumlahQty} Pcs</td>
                          <td className="p-2">{formatRupiah(item.hargaProduk)}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.statusPesanan === 'Dibatalkan' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.statusPesanan}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: REVIEW KESELURUHAN PESANAN TERSIMPAN */}
          <div className="space-y-4">
            
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                <Package size={16} />
                <span>2. Review Master Pesanan (Database Supabase)</span>
              </div>

              {/* FILTER BAR */}
              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto text-xs">
                
                {/* Filter Tanggal */}
                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                  <Calendar size={13} className="text-gray-400" />
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="outline-none text-xs text-gray-700 bg-transparent"
                  />
                  <span className="text-gray-300">-</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="outline-none text-xs text-gray-700 bg-transparent"
                  />
                </div>

                {/* Filter Status Order (Aktif vs Batal) */}
                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                  {[
                    { id: 'aktif', label: 'Pesanan Aktif' },
                    { id: 'dibatalkan', label: 'Dibatalkan' },
                    { id: 'semua', label: 'Semua Status' }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => setFilterStatusPesanan(btn.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterStatusPesanan === btn.id 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-200/60'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="flex items-center border border-gray-300 rounded-xl px-2.5 py-1.5 bg-white shadow-sm flex-1 lg:w-48">
                  <Search size={14} className="text-gray-400 mr-2" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari No. Pesanan / SKU..."
                    className="w-full outline-none text-gray-700 bg-transparent text-xs"
                  />
                </div>

              </div>
            </div>

            {/* RINGKASAN METRICS (TIDAK MEMBIASKAN OMSET DENGAN ORDER BATAL) */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Pesanan Aktif</span>
                <h4 className="text-base font-bold text-gray-800">{dbMetrics.totalOrderAktif} Order</h4>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Total Qty Terkirim</span>
                <h4 className="text-base font-bold text-emerald-600">{dbMetrics.totalPcsAktif} Pcs</h4>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Total Nilai Pesanan</span>
                <h4 className="text-base font-bold text-blue-600">{formatRupiah(dbMetrics.totalNominalAktif)}</h4>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-[10px] text-amber-600 font-semibold uppercase">Belum Cair</span>
                <h4 className="text-base font-bold text-amber-600">{dbMetrics.belumCairCount} Order</h4>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-[10px] text-red-600 font-semibold uppercase">Dibatalkan</span>
                <h4 className="text-base font-bold text-red-600">{dbMetrics.totalBatalCount} Order</h4>
              </div>
            </div>

            {/* TABEL DATABASE MASTER FULL HEIGHT */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 z-10 shadow-sm border-b border-gray-200 text-gray-500 font-semibold">
                    <tr>
                      <th className="p-3 w-10">#</th>
                      <th className="p-3">No. Pesanan</th>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3 text-center">Status Pesanan</th>
                      <th className="p-3 text-center">Total Qty (Pcs)</th>
                      <th className="p-3">Total Nilai Pesanan</th>
                      <th className="p-3 text-center">Status Pencairan</th>
                      <th className="p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {groupedDbOrders.length > 0 ? (
                      groupedDbOrders.map((group, idx) => {
                        const isExpanded = !!expandedOrders[group.noPesanan];
                        const isCancelled = group.order_status === 'Dibatalkan';

                        return (
                          <React.Fragment key={group.noPesanan}>
                            {/* BARIS UTAMA */}
                            <tr 
                              onClick={() => toggleOrderExpand(group.noPesanan)}
                              className={`hover:bg-blue-50/60 transition cursor-pointer ${
                                isCancelled ? 'bg-red-50/30' : isExpanded ? 'bg-blue-50/40' : ''
                              }`}
                            >
                              <td className="p-3 text-gray-400 font-medium">{idx + 1}</td>
                              <td className="p-3 font-mono font-bold text-blue-600">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown size={15} className="text-blue-600 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
                                  )}
                                  <Layers size={13} className="text-blue-500 flex-shrink-0" />
                                  <span className={`underline decoration-blue-300 underline-offset-2 ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                                    {group.noPesanan}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-gray-500">{group.order_date}</td>
                              
                              {/* BADGE STATUS PESANAN */}
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                                  isCancelled 
                                    ? 'bg-red-100 text-red-700 border border-red-200' 
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {isCancelled ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
                                  {group.order_status}
                                </span>
                              </td>

                              <td className={`p-3 text-center font-bold ${isCancelled ? 'text-gray-400 line-through' : 'text-emerald-600'}`}>
                                {group.totalQty} Pcs
                              </td>
                              <td className={`p-3 font-bold ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                {formatRupiah(group.totalNominal)}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                                  group.pencairan_status === 'Sudah Cair'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {group.pencairan_status === 'Sudah Cair' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                                  {group.pencairan_status}
                                </span>
                              </td>
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={() => handleHapusOrderGroup(group.noPesanan)}
                                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
                                  title="Hapus Pesanan Ini"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>

                            {/* ACCORDION RINCIAN SKU */}
                            {isExpanded && (
                              <tr className="bg-gray-50/80">
                                <td colSpan="8" className="p-4 pl-12 border-b border-gray-200">
                                  <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-inner space-y-2">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                      <span className="font-bold text-xs text-blue-700 uppercase tracking-wider">
                                        Rincian SKU Produk ({group.order_status}): {group.noPesanan}
                                      </span>
                                    </div>

                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="text-gray-400 font-semibold border-b border-gray-100">
                                          <th className="py-1.5 px-2">ID SKU</th>
                                          <th className="py-1.5 px-2">Nama SKU / Produk</th>
                                          <th className="py-1.5 px-2 text-center">Jumlah Qty</th>
                                          <th className="py-1.5 px-2">Harga Satuan</th>
                                          <th className="py-1.5 px-2">Subtotal Harga</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {group.items.map((sku, skuIdx) => {
                                          const subtotal = Number(sku.product_price || 0) * Number(sku.quantity || 1);

                                          return (
                                            <tr key={sku.id || skuIdx} className="hover:bg-blue-50/30">
                                              <td className="py-2 px-2 font-mono font-medium text-gray-600">{sku.sku_id}</td>
                                              <td className="py-2 px-2 font-bold text-gray-800">{sku.product_name}</td>
                                              <td className="py-2 px-2 text-center font-bold text-emerald-600">{sku.quantity} Pcs</td>
                                              <td className="py-2 px-2 text-gray-600">{formatRupiah(sku.product_price)}</td>
                                              <td className="py-2 px-2 font-bold text-gray-900">{formatRupiah(subtotal)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="text-center py-16 text-gray-400 font-medium">
                          {loadingDb ? 'Memuat data dari Supabase...' : 'Belum ada data pesanan tersimpan di database.'}
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