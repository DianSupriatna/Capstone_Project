import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  FileSpreadsheet,
  Trash2,
  Search,
  Eye,
  Upload,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Calculator,
  Database,
  XCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { supabase } from './supabaseClient';

// Import Komponen Reusable, Utility, Custom Hook & Context
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast'; 
import Modal from './components/Modal';
import { parseMarketplaceExcel } from './utils/fileHelpers';
import { useReports } from './hooks/useReports';
import { useApp } from './context/AppContext';

const INITIAL_CARD_DATA = {
  omset: 0,
  biayaPlatform: 0,
  biayaProgram: 0,
  voucherIklan: 0,
  biayaOperasional: 0,
  keuntunganBersih: 0,
  namaFile: 'Belum ada file dipilih',
  skuList: []
};

export default function DataPenghasilan({ onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Mengambil userProfile dari Global Context
  const { userProfile } = useApp();

  // Filter Periode Waktu Global (Custom Date), Filter Status, & Pencarian No. Pesanan
  const [filterPeriode, setFilterPeriode] = useState('semua'); // 'semua' atau 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('semua'); // 'semua', 'untung', 'rugi'
  const [searchNoPesanan, setSearchNoPesanan] = useState('');
  const [selectedReportId, setSelectedReportId] = useState(null); // Untuk filter Tabel 2 berdasarkan Riwayat

  // Data Pendukung dari Supabase (Products, Operational Costs, & Orders Master)
  const [stockList, setStockList] = useState([]);
  const [operationalList, setOperationalList] = useState([]);
  const [ordersMasterList, setOrdersMasterList] = useState([]);

  // Data Keseluruhan Transaksi (Untuk Tabel 2 & Kartu Finansial)
  const [allTransactions, setAllTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Menggunakan Custom Hook Supabase (Untuk Tabel 3)
  const { riwayatList, loading, deleteReport, refreshReports } = useReports();

  // Data Staging (Untuk Tabel 1 / Review File Baru)
  const [activeCardData, setActiveCardData] = useState(INITIAL_CARD_DATA);
  const [selectedFile, setSelectedFile] = useState(null);

  const [toastMessage, setToastMessage] = useState(null);

  // State Modal Custom
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

  // 1. Load Master Data & Seluruh Transaksi dari Supabase
  const fetchAllTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase.from('transaction_details').select('*');
      if (error) throw error;
      setAllTransactions(data || []);
    } catch (err) {
      console.error('Gagal memuat rincian transaksi database:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    async function fetchMasterData() {
      try {
        const { data: productsData } = await supabase.from('products').select('*');
        if (productsData) setStockList(productsData);

        const { data: opData } = await supabase.from('operational_costs').select('*');
        if (opData) setOperationalList(opData);

        const { data: ordersData } = await supabase.from('orders_master').select('*');
        if (ordersData) setOrdersMasterList(ordersData);

        // Panggil fetch all transactions untuk mengisi Tabel 2
        await fetchAllTransactions();
      } catch (err) {
        console.error('Gagal memuat master data Supabase:', err);
      }
    }
    fetchMasterData();
  }, []);

  // 2. Parse ulang secara otomatis jika data stok/products baru selesai di-fetch
  useEffect(() => {
    if (selectedFile && stockList.length > 0) {
      parseMarketplaceExcel(selectedFile, stockList, operationalList, ordersMasterList)
        .then(parsedData => setActiveCardData(parsedData))
        .catch(err => console.error('Gagal re-parse data:', err));
    }
  }, [stockList, operationalList, ordersMasterList]);

  // Handle Pilih File (Otomatis memunculkan Tabel 1)
  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      try {
        const parsedData = await parseMarketplaceExcel(file, stockList, operationalList, ordersMasterList);
        setActiveCardData(parsedData);
        showToast(`Berhasil membaca ${parsedData.skuList.length} rincian SKU dari file "${file.name}"!`);
      } catch (err) {
        console.error('Gagal membaca file excel:', err);
        setModalConfig({
          isOpen: true,
          title: 'Format File Tidak Sesuai',
          message: 'Gagal membaca isi file Excel. Pastikan format laporan sesuai dengan standar Shopee/Marketplace.',
          type: 'alert'
        });
        setSelectedFile(null);
        setActiveCardData(INITIAL_CARD_DATA);
      }
    }
  };

  // Simpan Rekap & Rincian SKU ke Supabase
  const handleSimpan = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setModalConfig({
        isOpen: true,
        title: 'Pilih File Terlebih Dahulu',
        message: 'Silakan pilih file laporan Excel atau CSV marketplace sebelum menyimpan.',
        type: 'alert'
      });
      return;
    }

    const isFileExist = riwayatList.some(
      item => item.namaFile.toLowerCase() === activeCardData.namaFile.toLowerCase()
    );

    if (isFileExist) {
      setModalConfig({
        isOpen: true,
        title: 'File Duplikat',
        message: `Gagal Menyimpan: File "${activeCardData.namaFile}" sudah pernah direkap di database!`,
        type: 'alert'
      });
      return;
    }

    try {
      // A. Simpan ke tabel import_reports
      const { data: reportInsert, error: reportError } = await supabase
        .from('import_reports')
        .insert([
          {
            file_name: activeCardData.namaFile,
            total_omzet: activeCardData.omset,
            total_platform_fee: activeCardData.biayaPlatform,
            total_program_fee: activeCardData.biayaProgram,
            total_voucher: activeCardData.voucherIklan,
            total_operational: activeCardData.biayaOperasional,
            net_profit: activeCardData.keuntunganBersih
          }
        ])
        .select();

      if (reportError) throw reportError;

      const newReportId = reportInsert[0].id;

      // B. Simpan rincian SKU ke tabel transaction_details
      const detailsPayload = activeCardData.skuList.map(sku => {
        const platform = parseFloat(sku.biayaPlatform) || 0;
        const program = parseFloat(sku.biayaProgram) || 0;
        const promosi = parseFloat(sku.biayaPromosi) || parseFloat(sku.voucherIklan) || 0;
        const modalSatuan = parseFloat(sku.modalSatuan) || 0;
        const qty = parseInt(sku.jumlahQty) || 0;
        const totalModal = modalSatuan * qty;
        const omset = parseFloat(sku.omsetMarketplace) || 0;
        const pLoss = omset - totalModal - platform - program - promosi;

        return {
          report_id: newReportId,
          order_number: sku.noPesanan,
          transaction_date: sku.tanggal,
          product_sku: `${sku.idSku}\n${sku.namaSku}`,
          quantity: qty,
          marketplace_omzet: omset,
          platform_fee: platform,
          program_fee: program,
          promotion_fee: promosi,
          total_modal: totalModal,
          profit_loss: pLoss,
          status: pLoss >= 0 ? 'Untung' : 'Rugi'
        };
      });

      const { error: detailError } = await supabase
        .from('transaction_details')
        .insert(detailsPayload);

      if (detailError) throw detailError;

      // C. Update pencairan_status di orders_master
      const savedOrderNumbers = Array.from(new Set(activeCardData.skuList.map(item => item.noPesanan)));
      if (savedOrderNumbers.length > 0) {
        await supabase
          .from('orders_master')
          .update({ pencairan_status: 'Sudah Cair' })
          .in('order_number', savedOrderNumbers);
      }

      showToast('Seluruh rincian pesanan berhasil disimpan ke database!');
      
      // Reset State Tabel 1 (Review) agar menghilang
      setSelectedFile(null);
      setActiveCardData(INITIAL_CARD_DATA);
      
      // Refresh Data Supabase untuk Tabel 2 & 3
      await refreshReports();
      await fetchAllTransactions();

    } catch (error) {
      console.error('Gagal menyimpan ke Supabase:', error.message || error);
      setModalConfig({
        isOpen: true,
        title: 'Kesalahan Sistem',
        message: `Gagal menyimpan: ${error.message || 'Terjadi kesalahan pada database'}`,
        type: 'alert'
      });
    }
  };

  // Hapus Riwayat Laporan
  const handleAskDelete = (id) => {
    setModalConfig({
      isOpen: true,
      title: 'Hapus Laporan Penghasilan',
      message: 'Apakah Anda yakin ingin menghapus data rekapitulasi laporan ini beserta seluruh rincian transaksi terkait dari Supabase?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteReport(id);
          showToast('Riwayat berhasil dihapus dari database.');
          if (selectedReportId === id) setSelectedReportId(null);
          await fetchAllTransactions(); // Update Tabel 2 setelah hapus
        } catch (err) {
          console.error(err);
          showToast('Gagal menghapus data.');
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // --- LOGIKA GROUPING UNTUK TABEL 1 (REVIEW STAGING) ---
  const groupedReviewOrders = useMemo(() => {
    if (!selectedFile) return [];
    const groups = {};
    activeCardData.skuList.forEach(item => {
      const orderNo = item.noPesanan || 'NO-ORDER';
      if (!groups[orderNo]) {
        groups[orderNo] = { noPesanan: orderNo, tanggal: item.tanggal, items: [] };
      }
      groups[orderNo].items.push(item);
    });
    return Object.values(groups);
  }, [activeCardData.skuList, selectedFile]);

  // --- LOGIKA GROUPING & FILTERING UNTUK TABEL 2 (DATABASE KESELURUHAN) ---
  const groupedAllOrders = useMemo(() => {
    const filtered = allTransactions.filter(item => {
      // 1. Filter Riwayat File Spesifik (Jika tombol View di Tabel 3 diklik)
      if (selectedReportId && item.report_id !== selectedReportId) return false;

      // 2. Filter Search Text
      const matchSearch = (item.order_number || '').toLowerCase().includes(searchNoPesanan.toLowerCase()) || 
                          (item.product_sku || '').toLowerCase().includes(searchNoPesanan.toLowerCase());
      if (!matchSearch) return false;

      // 3. Filter Status Untung/Rugi
      const isUntung = (item.profit_loss || 0) >= 0;
      if (filterStatus === 'untung' && !isUntung) return false;
      if (filterStatus === 'rugi' && isUntung) return false;

      // 4. Filter Periode Tanggal Custom (Rentang Tanggal)
      if (filterPeriode === 'custom' && (startDate || endDate)) {
        const txDate = new Date(item.transaction_date);
        
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

    const groups = {};
    filtered.forEach(item => {
      const orderNo = item.order_number || 'NO-ORDER';
      if (!groups[orderNo]) {
        groups[orderNo] = { noPesanan: orderNo, tanggal: item.transaction_date, items: [] };
      }
      groups[orderNo].items.push(item);
    });
    return Object.values(groups);
  }, [allTransactions, filterStatus, searchNoPesanan, filterPeriode, startDate, endDate, selectedReportId]);

  // Kalkulasi Total untuk Footer Tabel 2 & Kartu Finansial Global
  const table2Totals = useMemo(() => {
    let qty = 0, modal = 0, omset = 0, platform = 0, program = 0, promosi = 0;
    groupedAllOrders.forEach(group => {
      group.items.forEach(item => {
        qty += item.quantity || 0;
        modal += item.total_modal || 0;
        omset += item.marketplace_omzet || 0;
        platform += item.platform_fee || 0;
        program += item.program_fee || 0;
        promosi += item.promotion_fee || 0;
      });
    });

    // Menghitung Biaya Operasional (Global Supabase - Tabel operational_costs)
    let operasional = 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const filteredOps = operationalList.filter(op => {
      if (!op.transaction_date) return false;
      const opDate = new Date(op.transaction_date);
      
      if (filterPeriode === 'custom' && (startDate || endDate)) {
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          if (opDate < sDate) return false;
        }
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          if (opDate > eDate) return false;
        }
        return true;
      } else {
        // Jika filter = "semua", default ambil khusus biaya operasional bulan berjalan
        return opDate >= startOfMonth && opDate <= endOfMonth;
      }
    });

    operasional = filteredOps.reduce((sum, item) => sum + (Number(item.nominal) || 0) + (Number(item.other_cost) || 0), 0);

    const totalBiaya = platform + program + promosi;
    const totalSelisih = omset - modal - totalBiaya - operasional;

    return { qty, modal, omset, platform, program, promosi, operasional, totalBiaya, totalSelisih };
  }, [groupedAllOrders, operationalList, filterPeriode, startDate, endDate]);


  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">
      
      {/* Toast Notifikasi */}
      <Toast message={toastMessage} />

      {/* Modal Reusable */}
      <Modal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm || (() => setModalConfig(prev => ({ ...prev, isOpen: false })))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.type === 'danger' ? 'Ya, Hapus Data' : 'Mengerti'}
      />

      {/* Sidebar Reusable */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate} 
        userProfile={userProfile} 
        activeMenu="data-penghasilan" 
      />

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Topbar Reusable - Props filter dihapus agar tidak bentrok dengan filter custom di bawahnya */}
        <Topbar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          title="Laba/Profit"
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ========================================================================= */}
          {/* FILTER RENTANG TANGGAL (CUSTOM DATE RANGE) GLOBAL                           */}
          {/* ========================================================================= */}
          <div className="bg-white px-5 py-3.5 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-gray-700 font-bold text-xs uppercase tracking-wider">
              <Calendar size={16} className="text-blue-600" />
              <span>Filter Periode Data Penghasilan</span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={() => {
                  setFilterPeriode('semua');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterPeriode === 'semua' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Semua Data
              </button>

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-1 rounded-xl">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setFilterPeriode('custom');
                  }}
                  title="Dari Tanggal"
                  className="bg-transparent text-xs font-medium text-gray-700 outline-none px-2 py-1 cursor-pointer"
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
                  className="bg-transparent text-xs font-medium text-gray-700 outline-none px-2 py-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: RINGKASAN FINANSIAL (DATA SUPABASE) & UPLOAD BARU              */}
          {/* ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-5">
            
            {/* 7 KARTU KALKULASI FINANSIAL (MENGGUNAKAN DATA SUPABASE GLOBAL) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                <TrendingUp size={16} />
                <span>Ringkasan Finansial Keseluruhan (Database Supabase)</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
                {/* 1. Omset */}
                <div className="flex-1 bg-blue-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-between h-20 min-w-[130px]">
                  <span className="text-[10px] font-medium text-blue-100 truncate">Omset Total</span>
                  <h4 className="text-xs sm:text-sm font-bold truncate">{formatRupiah(table2Totals.omset)}</h4>
                </div>
                <span className="font-bold text-gray-400 text-sm px-0.5">-</span>
                
                {/* 2. Total Modal */}
                <div className="flex-1 bg-blue-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-between h-20 min-w-[130px]">
                  <span className="text-[10px] font-medium text-blue-100 truncate">Total Modal</span>
                  <h4 className="text-xs sm:text-sm font-bold truncate">{formatRupiah(table2Totals.modal)}</h4>
                </div>
                <span className="font-bold text-gray-400 text-sm px-0.5">-</span>

                {/* 3. Platform */}
                <div className="flex-1 bg-blue-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-between h-20 min-w-[130px]">
                  <span className="text-[10px] font-medium text-blue-100 truncate">Biaya Platform</span>
                  <h4 className="text-xs sm:text-sm font-bold truncate">{formatRupiah(table2Totals.platform)}</h4>
                </div>
                <span className="font-bold text-gray-400 text-sm px-0.5">-</span>

                {/* 4. Program */}
                <div className="flex-1 bg-blue-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-between h-20 min-w-[130px]">
                  <span className="text-[10px] font-medium text-blue-100 truncate">Biaya Program</span>
                  <h4 className="text-xs sm:text-sm font-bold truncate">{formatRupiah(table2Totals.program)}</h4>
                </div>
                <span className="font-bold text-gray-400 text-sm px-0.5">-</span>

                {/* 5. Promosi */}
                <div className="flex-1 bg-blue-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-between h-20 min-w-[130px]">
                  <span className="text-[10px] font-medium text-blue-100 truncate">Voucher & Iklan</span>
                  <h4 className="text-xs sm:text-sm font-bold truncate">{formatRupiah(table2Totals.promosi)}</h4>
                </div>
                <span className="font-bold text-gray-400 text-sm px-0.5">-</span>

                {/* 6. Operasional */}
                <div className="flex-1 bg-blue-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-between h-20 min-w-[130px]">
                  <span className="text-[10px] font-medium text-blue-100 truncate">Biaya Operasional</span>
                  <h4 className="text-xs sm:text-sm font-bold truncate">{formatRupiah(table2Totals.operasional)}</h4>
                </div>
                <span className="font-bold text-gray-400 text-sm px-0.5">=</span>

                {/* 7. Keuntungan Bersih */}
                <div className="flex-1 bg-emerald-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-between h-20 min-w-[130px]">
                  <span className="text-[10px] font-medium text-emerald-100 truncate">Keuntungan Bersih</span>
                  <h4 className="text-xs sm:text-sm font-bold truncate">{formatRupiah(table2Totals.totalSelisih)}</h4>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* FORM IMPORT */}
            <form onSubmit={handleSimpan} className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <div>
                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider">Import Laporan Marketplace Baru</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  File Aktif: <strong className={selectedFile ? "text-blue-600" : "text-gray-400"}>{activeCardData.namaFile}</strong>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-semibold text-blue-700 cursor-pointer transition">
                  <Upload size={14} />
                  <span className="truncate max-w-[160px]">{selectedFile ? selectedFile.name : 'Pilih File Excel/CSV'}</span>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="hidden" />
                </label>

                <button 
                  type="submit"
                  disabled={!selectedFile}
                  className={`text-xs font-bold px-4 py-1.5 rounded-xl shadow transition cursor-pointer ${
                    selectedFile ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Simpan ke Supabase
                </button>
              </div>
            </form>
          </div>


          {/* ========================================================================= */}
          {/* TABEL 1: REVIEW STAGING FILE BARU (HANYA MUNCUL JIKA ADA FILE DIPILIH)      */}
          {/* ========================================================================= */}
          {selectedFile && groupedReviewOrders.length > 0 && (
            <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                <Package size={16} />
                <span>1. Review Data Import Terbaru (Belum Disimpan)</span>
              </div>
              
              <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-amber-50 z-10 shadow-sm border-b border-amber-200 text-amber-700 font-semibold">
                      <tr>
                        <th className="p-3">No. Pesanan</th>
                        <th className="p-3">ID SKU</th>
                        <th className="p-3">Nama Produk</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3">Total Modal</th>
                        <th className="p-3">Omset Market</th>
                        <th className="p-3 text-red-500">Platform</th>
                        <th className="p-3 text-red-500">Program</th>
                        <th className="p-3 text-red-500">Promosi</th>
                        <th className="p-3">Laba/Rugi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-700">
                      {groupedReviewOrders.map((group) => (
                        <React.Fragment key={`rev-${group.noPesanan}`}>
                          {group.items.map((item, itemIdx) => {
                            const modal = (item.modalSatuan || 0) * (item.jumlahQty || 0);
                            const p = parseFloat(item.biayaPlatform) || 0;
                            const pr = parseFloat(item.biayaProgram) || 0;
                            const pm = parseFloat(item.biayaPromosi) || parseFloat(item.voucherIklan) || 0;
                            const selisih = (item.omsetMarketplace || 0) - modal - p - pr - pm;
                            
                            return (
                              <tr key={itemIdx} className="hover:bg-amber-50/30">
                                {itemIdx === 0 && (
                                  <td rowSpan={group.items.length} className="p-3 font-mono font-bold text-amber-700 align-top border-r border-amber-100 bg-amber-50/20">
                                    {group.noPesanan}
                                  </td>
                                )}
                                <td className="p-3 font-mono text-gray-500">{item.idSku}</td>
                                <td className="p-3 font-bold">{item.namaSku}</td>
                                <td className="p-3 text-center font-bold text-amber-600">{item.jumlahQty}</td>
                                <td className="p-3 text-gray-600">{formatRupiah(modal)}</td>
                                <td className="p-3 text-blue-600">{formatRupiah(item.omsetMarketplace)}</td>
                                <td className="p-3 text-red-500">{formatRupiah(p)}</td>
                                <td className="p-3 text-red-500">{formatRupiah(pr)}</td>
                                <td className="p-3 text-red-500">{formatRupiah(pm)}</td>
                                <td className={`p-3 font-bold ${selisih >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {selisih >= 0 ? `+${formatRupiah(selisih)}` : `-${formatRupiah(Math.abs(selisih))}`}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* ========================================================================= */}
          {/* TABEL 2: DATABASE KESELURUHAN (SEMUA TRANSAKSI TERSIMPAN)                 */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                <Database size={16} />
                <span>2. Review Master Transaksi (Semua Data Supabase)</span>
                {selectedReportId && (
                  <button onClick={() => setSelectedReportId(null)} className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] flex items-center gap-1 cursor-pointer hover:bg-red-200">
                    <XCircle size={10} /> Hapus Filter File
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                {/* Filter Untung/Rugi */}
                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                  {[
                    { id: 'semua', label: 'Semua Status' },
                    { id: 'untung', label: 'Untung' },
                    { id: 'rugi', label: 'Rugi' }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setFilterStatus(btn.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterStatus === btn.id 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-200/60'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Pencarian */}
                <div className="flex items-center border border-gray-300 rounded-xl px-2.5 py-1.5 bg-white text-xs shadow-sm flex-1 lg:w-64">
                  <Search size={14} className="text-gray-400 mr-2" />
                  <input 
                    type="text"
                    value={searchNoPesanan}
                    onChange={(e) => setSearchNoPesanan(e.target.value)}
                    placeholder="Cari No. Pesanan / SKU..."
                    className="w-full outline-none text-gray-700 bg-transparent text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
              <div className="overflow-x-auto max-h-[550px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm border-b border-gray-200 text-gray-500 font-semibold">
                    <tr>
                      <th className="p-3 bg-gray-50">No. Pesanan</th>
                      <th className="p-3 bg-gray-50">Tanggal</th>
                      <th className="p-3 bg-gray-50">ID SKU</th>
                      <th className="p-3 bg-gray-50">Nama SKU Produk</th>
                      <th className="p-3 bg-gray-50 text-center">Qty</th>
                      <th className="p-3 bg-gray-50">Total Modal</th>
                      <th className="p-3 bg-gray-50">Omset Marketplace</th>
                      <th className="p-3 bg-gray-50 text-red-500">Biaya Platform</th>
                      <th className="p-3 bg-gray-50 text-red-500">Biaya Program</th>
                      <th className="p-3 bg-gray-50 text-red-500">Biaya Promosi</th>
                      <th className="p-3 bg-gray-50">Selisih (Laba/Rugi)</th>
                      <th className="p-3 bg-gray-50 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {loadingTransactions ? (
                       <tr><td colSpan="12" className="text-center py-16 text-gray-400">Memuat rincian transaksi dari Supabase...</td></tr>
                    ) : groupedAllOrders.length > 0 ? (
                      groupedAllOrders.map((group) => (
                        <React.Fragment key={`all-${group.noPesanan}`}>
                          {group.items.map((item, itemIdx) => {
                            const isUntung = (item.profit_loss || 0) >= 0;
                            // Menangani newline yang tersimpan di kolom product_sku
                            const splitSku = (item.product_sku || '').split('\n');
                            const idSku = splitSku[0] || '-';
                            const namaSku = splitSku[1] || item.product_sku;

                            return (
                              <tr key={item.id || itemIdx} className="hover:bg-gray-50 transition">
                                {itemIdx === 0 && (
                                  <>
                                    <td rowSpan={group.items.length} className="p-3 font-mono font-bold text-blue-600 align-top border-r border-gray-100 bg-blue-50/20">
                                      <div className="flex items-center gap-1">
                                        <Layers size={13} className="text-blue-500" />
                                        <span>{group.noPesanan}</span>
                                      </div>
                                    </td>
                                    <td rowSpan={group.items.length} className="p-3 text-gray-500 align-top border-r border-gray-100">
                                      {group.tanggal}
                                    </td>
                                  </>
                                )}

                                <td className="p-3 font-mono font-medium text-gray-600">{idSku}</td>
                                <td className="p-3 font-bold text-gray-800">{namaSku}</td>
                                <td className="p-3 text-center font-bold text-emerald-600">{item.quantity} Pcs</td>
                                <td className="p-3 font-medium text-gray-500">{formatRupiah(item.total_modal)}</td>
                                <td className="p-3 font-medium">{formatRupiah(item.marketplace_omzet)}</td>
                                <td className="p-3 font-medium text-red-500">{formatRupiah(item.platform_fee)}</td>
                                <td className="p-3 font-medium text-red-500">{formatRupiah(item.program_fee)}</td>
                                <td className="p-3 font-medium text-red-500">{formatRupiah(item.promotion_fee)}</td>
                                <td className={`p-3 font-bold ${isUntung ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {isUntung ? `+ ${formatRupiah(item.profit_loss)}` : `- ${formatRupiah(Math.abs(item.profit_loss))}`}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm ${
                                    isUntung ? 'bg-emerald-600' : 'bg-red-500'
                                  }`}>
                                    {isUntung ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                    {isUntung ? 'Untung' : 'Rugi'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="12" className="text-center py-16 text-gray-400 font-medium">
                          Belum ada transaksi tersimpan / tidak ada data yang cocok dengan filter.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* BARIS TOTAL KESELURUHAN PADA FOOTER TABEL 2 */}
                  {groupedAllOrders.length > 0 && (
                    <tfoot className="bg-blue-50/90 font-bold border-t-2 border-blue-200 text-xs text-gray-800 sticky bottom-0 z-10 shadow-lg">
                      <tr>
                        <td colSpan="4" className="p-3 text-right font-extrabold text-blue-900 uppercase tracking-wider">
                          <div className="flex items-center justify-end gap-1.5">
                            <Calculator size={14} className="text-blue-600" />
                            <span>JUMLAH TOTAL (Per Baris):</span>
                          </div>
                        </td>
                        <td className="p-3 text-center text-emerald-700 font-black text-sm">{table2Totals.qty} Pcs</td>
                        <td className="p-3 text-gray-700 font-bold">{formatRupiah(table2Totals.modal)}</td>
                        <td className="p-3 text-blue-700 font-black text-sm">{formatRupiah(table2Totals.omset)}</td>
                        <td className="p-3 text-red-600 font-bold">{formatRupiah(table2Totals.platform)}</td>
                        <td className="p-3 text-red-600 font-bold">{formatRupiah(table2Totals.program)}</td>
                        <td className="p-3 text-red-600 font-bold">{formatRupiah(table2Totals.promosi)}</td>
                        <td colSpan="2" className="p-3 text-gray-500 font-medium">
                          *(Laba/Rugi Bersih lihat di Ringkasan Finansial)*
                        </td>
                      </tr>
                      {/* SUB-FOOTER SUMMARY */}
                      <tr className="bg-blue-100/80 border-t border-blue-200 text-blue-900">
                        <td colSpan="5" className="p-2.5 text-right font-extrabold text-[11px] uppercase tracking-wider">
                          RINGKASAN TOTAL PENCAIRAN (FILTERED):
                        </td>
                        <td colSpan="2" className="p-2.5 text-blue-800 font-black text-[11px]">
                          Total Omset: {formatRupiah(table2Totals.omset)}
                        </td>
                        <td colSpan="2" className="p-2.5 text-red-600 font-black text-[11px]">
                          Semua Potongan (incl. Ops): {formatRupiah(table2Totals.totalBiaya + table2Totals.operasional)}
                        </td>
                        <td colSpan="3" className="p-2.5 text-emerald-700 font-black text-[11px]">
                          Selisih Bersih (Sesuai Kartu): {formatRupiah(table2Totals.totalSelisih)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* TABEL 3: RIWAYAT PENGHASILAN (FILE UPLOAD HISTORY)                        */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700 font-bold text-xs uppercase tracking-wider">
                <FileSpreadsheet size={16} />
                <span>3. Riwayat Upload Laporan Excel</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                    <tr className="border-b border-gray-200 text-gray-500 font-semibold">
                      <th className="p-2.5 bg-gray-50">#</th>
                      <th className="p-2.5 bg-gray-50">Nama File Laporan</th>
                      <th className="p-2.5 bg-gray-50">Waktu Simpan</th>
                      <th className="p-2.5 bg-gray-50">Omset</th>
                      <th className="p-2.5 bg-gray-50">Platform</th>
                      <th className="p-2.5 bg-gray-50">Program</th>
                      <th className="p-2.5 bg-gray-50">Voucher/Promosi</th>
                      <th className="p-2.5 bg-gray-50">Operasional</th>
                      <th className="p-2.5 bg-gray-50">Keuntungan Bersih</th>
                      <th className="p-2.5 bg-gray-50 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {riwayatList.length > 0 ? (
                      riwayatList.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-blue-50/50 transition cursor-pointer">
                          <td className="p-2.5 font-medium text-gray-500">{idx + 1}</td>
                          <td className="p-2.5 font-medium text-gray-800 flex items-center gap-2">
                            <FileSpreadsheet size={15} className="text-emerald-600 flex-shrink-0" />
                            <span className="truncate max-w-[160px]">{item.namaFile}</span>
                          </td>
                          <td className="p-2.5 text-gray-500">{item.tanggalSimpan}</td>
                          <td className="p-2.5">{formatRupiah(item.omset)}</td>
                          <td className="p-2.5">{formatRupiah(item.biayaPlatform)}</td>
                          <td className="p-2.5">{formatRupiah(item.biayaProgram)}</td>
                          <td className="p-2.5">{formatRupiah(item.voucherIklan)}</td>
                          <td className="p-2.5">{formatRupiah(item.biayaOperasional)}</td>
                          <td className="p-2.5 font-bold text-emerald-600">{formatRupiah(item.keuntunganBersih)}</td>
                          <td className="p-2.5 text-center flex items-center justify-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => {
                                setSelectedReportId(item.id);
                                showToast(`Memfilter Tabel 2 khusus untuk file: ${item.namaFile}`);
                              }}
                              className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition inline-flex items-center cursor-pointer"
                              title="Lihat Detail (Filter Tabel 2)"
                            >
                              <Eye size={13} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleAskDelete(item.id)}
                              className="p-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition inline-flex items-center cursor-pointer"
                              title="Hapus Riwayat File Ini"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="10" className="text-center py-6 text-gray-400 font-medium">
                          {loading ? 'Memuat riwayat...' : 'Belum ada riwayat penghasilan di Supabase.'}
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