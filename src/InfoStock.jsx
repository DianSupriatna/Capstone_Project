import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trash2,
  Search,
  Plus,
  Upload,
  Download,
  Edit,
  Save,
  X,
  Database
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Import Supabase, Context & Helpers
import { supabase } from './supabaseClient';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';
import Modal from './components/Modal';
import { useApp } from './context/AppContext';
import { cleanPrice, formatRp } from './utils/fileHelpers';

export default function InfoStock({ onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Context Global
  const { userProfile, stockList, setStockList } = useApp();

  // Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua Status');

  // State Modal Tambah / Edit Produk
  const [productModal, setProductModal] = useState({
    isOpen: false,
    mode: 'add',
    formData: {
      sku: '',
      namaProduk: '',
      stok: 0,
      hargaBeli: 0,
      hargaJual: 0
    }
  });

  // State Preview Import File & Simpan Supabase
  const [importPreview, setImportPreview] = useState({
    namaFile: '',
    items: []
  });
  const [isSavingSupabase, setIsSavingSupabase] = useState(false);

  // State Modal Konfirmasi Hapus & Alert Error
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

  // 1. FETCH DATA DARI TABEL 'products' SUPABASE & HAPUS PRODUK DUMMY
  const fetchStockFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sku', { ascending: true });

      if (error) throw error;

      if (data) {
        const formatted = data.map((item, idx) => ({
          id: item.sku || idx,
          barcode: item.sku || '-',
          namaProduk: item.products_name || '-',
          stok: Number(item.stock || 0),
          hargaBeli: Number(item.purchase_price || 0),
          hargaJual: Number(item.selling_price || 0),
          kategori: 'Umum'
        }));

        // Timpa stockList dengan data murni Supabase
        setStockList(formatted);
      }
    } catch (err) {
      console.error('Gagal fetch stock dari tabel products:', err);
    }
  };

  useEffect(() => {
    fetchStockFromSupabase();
  }, []);

  // 2. HANDLER MODAL TAMBAH & EDIT PRODUK SATUAN KE TABEL 'products'
  const handleOpenAddModal = () => {
    setProductModal({
      isOpen: true,
      mode: 'add',
      formData: { sku: '', namaProduk: '', stok: 0, hargaBeli: 0, hargaJual: 0 }
    });
  };

  const handleOpenEditModal = (item) => {
    setProductModal({
      isOpen: true,
      mode: 'edit',
      formData: {
        sku: item.barcode,
        namaProduk: item.namaProduk,
        stok: item.stok,
        hargaBeli: item.hargaBeli,
        hargaJual: item.hargaJual
      }
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const { sku, namaProduk, stok, hargaBeli, hargaJual } = productModal.formData;

    if (!sku.trim() || !namaProduk.trim()) {
      showToast('No SKU dan Nama Produk wajib diisi!');
      return;
    }

    const payload = {
      sku: sku.trim(),
      products_name: namaProduk.trim(),
      stock: Number(stok),
      purchase_price: Number(hargaBeli),
      selling_price: Number(hargaJual)
    };

    try {
      if (productModal.mode === 'add') {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        showToast(`Produk "${namaProduk}" berhasil disimpan ke Supabase!`);
      } else {
        const { error } = await supabase.from('products').update(payload).eq('sku', sku);
        if (error) throw error;
        showToast(`Produk "${namaProduk}" berhasil diperbarui di Supabase!`);
      }

      setProductModal(prev => ({ ...prev, isOpen: false }));
      fetchStockFromSupabase();
    } catch (err) {
      console.error('Gagal simpan produk:', err);
      showToast(`Gagal menyimpan ke Supabase: ${err.message}`);
    }
  };

  // 3. IMPORT STOCK FILE (PARSER PRESISI)
  const handleImportStock = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellText: true, cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rawRows || rawRows.length < 2) {
          showToast('File tidak memiliki baris data.');
          return;
        }

        let headerRowIdx = -1;
        let colIdxSKU = -1;
        let colIdxNama = -1;
        let colIdxStok = -1;
        let colIdxBeli = -1;
        let colIdxJual = -1;

        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
          const row = rawRows[i] || [];
          const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');

          if (rowStr.includes('sku') || rowStr.includes('nama') || rowStr.includes('barang') || rowStr.includes('produk')) {
            headerRowIdx = i;
            row.forEach((colVal, idx) => {
              const val = String(colVal || '').toLowerCase().trim();
              if (val.includes('sku') || val.includes('barcode') || val.includes('kode')) colIdxSKU = idx;
              else if (val.includes('nama') || val.includes('produk') || val.includes('barang')) colIdxNama = idx;
              else if (val.includes('stok') || val.includes('stock') || val.includes('qty')) colIdxStok = idx;
              else if (val.includes('reseller') || val.includes('beli') || val.includes('modal') || val.includes('purchase')) colIdxBeli = idx;
              else if (val.includes('jual') || val.includes('harga jual') || val.includes('selling')) colIdxJual = idx;
            });
            break;
          }
        }

        if (headerRowIdx === -1 || colIdxSKU === -1 || colIdxNama === -1) {
          headerRowIdx = 0;
          const sampleRow = rawRows[1] || [];
          if (String(sampleRow[0]).trim().length <= 3 && !isNaN(sampleRow[0])) {
            colIdxSKU = 1;
            colIdxNama = 2;
            colIdxStok = 3;
            colIdxBeli = 4;
            colIdxJual = 5;
          } else {
            colIdxSKU = 0;
            colIdxNama = 1;
            colIdxStok = 2;
            colIdxBeli = 3;
            colIdxJual = 4;
          }
        }

        const parsedItems = [];
        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const sku = String(row[colIdxSKU] || '').trim();
          const namaBarang = String(row[colIdxNama] || '').trim();
          const stok = cleanPrice(row[colIdxStok]);
          const hargaBeli = cleanPrice(row[colIdxBeli]);
          const hargaJual = cleanPrice(row[colIdxJual]);

          if (!sku && !namaBarang) continue;
          if (sku.toLowerCase().includes('sku') || namaBarang.toLowerCase().includes('nama')) continue;

          parsedItems.push({
            sku: sku || 'NO-SKU',
            products_name: namaBarang || 'Tanpa Nama',
            stock: stok,
            purchase_price: hargaBeli,
            selling_price: hargaJual
          });
        }

        if (parsedItems.length === 0) {
          showToast('Tidak ada data produk valid yang ditemukan!');
          return;
        }

        setImportPreview({
          namaFile: file.name,
          items: parsedItems
        });
        showToast(`Berhasil membaca ${parsedItems.length} produk dari "${file.name}"!`);
      } catch (err) {
        console.error('Error parsing file stok:', err);
        showToast('Gagal membaca file. Pastikan format CSV/Excel benar.');
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  // 4. EKSPLISIT BATCH UPSERT KE TABEL 'products' SUPABASE (PER 100 ITEM)
  const handleSaveImportToSupabase = async () => {
    if (!importPreview.items || importPreview.items.length === 0) return;
    setIsSavingSupabase(true);

    try {
      const items = importPreview.items;
      const chunkSize = 100;

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('products')
          .upsert(chunk, { onConflict: 'sku' });

        if (error) throw error;
      }

      showToast(`Sukses menyimpan ${importPreview.items.length} produk ke tabel products di Supabase!`);
      setImportPreview({ namaFile: '', items: [] });
      await fetchStockFromSupabase();
    } catch (err) {
      console.error('Gagal batch upsert ke Supabase:', err);
      setModalConfig({
        isOpen: true,
        title: 'Gagal Menyimpan ke Supabase',
        message: `Terjadi kesalahan: ${err.message}`,
        type: 'alert'
      });
    } finally {
      setIsSavingSupabase(false);
    }
  };

  // EXPORT STOK KE CSV
  const handleExportStock = () => {
    let csvContent = "No SKU,Nama Barang,Stok,Harga Reseller,Harga Jual\n";
    stockList.forEach(row => {
      csvContent += `"${row.barcode}","${row.namaProduk}",${row.stok},${row.hargaBeli},${row.hargaJual}\n`;
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `export_stok_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Data stock berhasil di-export!");
  };

  // HAPUS PRODUK DARI TABEL 'products'
  const handleHapusClick = (item) => {
    setModalConfig({
      isOpen: true,
      title: 'Hapus Produk dari Stok',
      message: `Apakah Anda yakin ingin menghapus produk "${item.namaProduk}" dari Supabase?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await supabase.from('products').delete().eq('sku', item.barcode);
          showToast('Produk berhasil dihapus dari Supabase.');
          fetchStockFromSupabase();
        } catch (err) {
          console.error('Error delete stock:', err);
          showToast('Gagal menghapus produk.');
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // FILTERING TABEL
  const filteredStock = useMemo(() => {
    return stockList.filter(item => {
      const matchSearch = (item.namaProduk || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.barcode || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (filterStatus === 'Habis' && item.stok !== 0) return false;
      if (filterStatus === 'Menipis' && (item.stok === 0 || item.stok > 5)) return false;
      if (filterStatus === 'Aman' && item.stok <= 5) return false;

      return true;
    });
  }, [stockList, searchQuery, filterStatus]);

  // METRICS SUMMARY
  const summaryMetrics = useMemo(() => {
    const totalProduk = stockList.length;
    const stokMenipis = stockList.filter(item => item.stok > 0 && item.stok <= 5).length;
    const stokHabis = stockList.filter(item => item.stok === 0).length;
    const nilaiStockTotal = stockList.reduce((acc, curr) => acc + (curr.stok * curr.hargaBeli), 0);
    const potensiPenjualan = stockList.reduce((acc, curr) => acc + (curr.stok * curr.hargaJual), 0);
    const potensiProfit = potensiPenjualan - nilaiStockTotal;

    return { totalProduk, stokMenipis, stokHabis, nilaiStockTotal, potensiPenjualan, potensiProfit };
  }, [stockList]);

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">
      
      <Toast message={toastMessage} />

      {/* MODAL KONFIRMASI / ALERT */}
      <Modal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm || (() => setModalConfig(prev => ({ ...prev, isOpen: false })))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.type === 'danger' ? 'Ya, Hapus' : 'Mengerti'}
      />

      {/* MODAL EDIT / TAMBAH PRODUK */}
      {productModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-sm">
                {productModal.mode === 'add' ? '+ Tambah Produk Baru' : 'Edit Produk Stok'}
              </h3>
              <button 
                onClick={() => setProductModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 font-semibold mb-1">No SKU / Barcode</label>
                <input 
                  type="text" 
                  value={productModal.formData.sku}
                  onChange={(e) => setProductModal({ ...productModal, formData: { ...productModal.formData, sku: e.target.value } })}
                  placeholder="Misal: 8997002040016"
                  className="w-full border border-gray-300 rounded-xl p-2.5 outline-none focus:border-blue-500 font-mono"
                  disabled={productModal.mode === 'edit'}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 font-semibold mb-1">Nama Produk / Barang</label>
                <input 
                  type="text" 
                  value={productModal.formData.namaProduk}
                  onChange={(e) => setProductModal({ ...productModal, formData: { ...productModal.formData, namaProduk: e.target.value } })}
                  placeholder="Nama produk lengkap"
                  className="w-full border border-gray-300 rounded-xl p-2.5 outline-none focus:border-blue-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Stok (Pcs)</label>
                  <input 
                    type="number" 
                    value={productModal.formData.stok}
                    onChange={(e) => setProductModal({ ...productModal, formData: { ...productModal.formData, stok: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl p-2.5 outline-none focus:border-blue-500 font-bold text-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Harga Modal</label>
                  <input 
                    type="number" 
                    value={productModal.formData.hargaBeli}
                    onChange={(e) => setProductModal({ ...productModal, formData: { ...productModal.formData, hargaBeli: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl p-2.5 outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Harga Jual</label>
                  <input 
                    type="number" 
                    value={productModal.formData.hargaJual}
                    onChange={(e) => setProductModal({ ...productModal, formData: { ...productModal.formData, hargaJual: e.target.value } })}
                    className="w-full border border-gray-300 rounded-xl p-2.5 outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setProductModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow"
                >
                  Simpan ke Supabase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate} 
        userProfile={userProfile} 
        activeMenu="info-stock" 
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        <Topbar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          title="Manajemen & Informasi Stock Produk Gudang"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Tambah Produk</span>
            </button>

            <label className="flex items-center gap-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition cursor-pointer">
              <Upload size={14} />
              <span>Import Stock (CSV/Excel)</span>
              <input type="file" accept=".csv, .xlsx, .xls" onChange={handleImportStock} className="hidden" />
            </label>

            {/* TOMBOL EKSPLISIT SIMPAN KE SUPABASE JIKA ADA HASIL IMPORT */}
            {importPreview.items.length > 0 && (
              <button 
                onClick={handleSaveImportToSupabase}
                disabled={isSavingSupabase}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition cursor-pointer animate-pulse"
              >
                <Database size={14} />
                <span>{isSavingSupabase ? 'Menyimpan...' : 'Simpan ke Supabase'}</span>
              </button>
            )}

            <button 
              onClick={handleExportStock}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl border border-gray-200 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Export Stock</span>
            </button>
          </div>
        </Topbar>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* BANNER PREVIEW HASIL IMPORT */}
          {importPreview.items.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-xs text-blue-800 uppercase tracking-wider">PREVIEW IMPORT FILE: {importPreview.namaFile}</h4>
                  <p className="text-[11px] text-blue-600 mt-0.5">Ditemukan {importPreview.items.length} produk. Klik tombol di bawah untuk menyimpan ke tabel products Supabase.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setImportPreview({ namaFile: '', items: [] })}
                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleSaveImportToSupabase}
                    disabled={isSavingSupabase}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                  >
                    <Save size={13} />
                    <span>{isSavingSupabase ? 'Menyimpan...' : 'Simpan ke Supabase Sekarang'}</span>
                  </button>
                </div>
              </div>

              {/* Tabel Preview */}
              <div className="max-h-40 overflow-y-auto border border-blue-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-100/60 text-blue-900 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2">No SKU</th>
                      <th className="p-2">Nama Barang</th>
                      <th className="p-2 text-center">Stok</th>
                      <th className="p-2">Harga Reseller</th>
                      <th className="p-2">Harga Jual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {importPreview.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40">
                        <td className="p-2 font-mono font-bold text-blue-600">{item.sku}</td>
                        <td className="p-2 font-medium">{item.products_name}</td>
                        <td className="p-2 text-center font-bold text-emerald-600">{item.stock} Pcs</td>
                        <td className="p-2">{formatRp(item.purchase_price)}</td>
                        <td className="p-2">{formatRp(item.selling_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6 KARTU RINGKASAN STOK */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border-t-4 border-blue-600 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Produk</span>
              <h3 className="text-lg font-bold text-gray-800 mt-2">{summaryMetrics.totalProduk}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border-t-4 border-amber-500 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stok Menipis</span>
              <h3 className="text-lg font-bold text-amber-600 mt-2">{summaryMetrics.stokMenipis}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border-t-4 border-red-500 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stok Habis</span>
              <h3 className="text-lg font-bold text-red-600 mt-2">{summaryMetrics.stokHabis}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border-t-4 border-emerald-600 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nilai Stok</span>
              <h3 className="text-sm sm:text-base font-bold text-emerald-600 mt-2">{formatRp(summaryMetrics.nilaiStockTotal)}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border-t-4 border-blue-500 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Potensi Penjualan</span>
              <h3 className="text-sm sm:text-base font-bold text-blue-600 mt-2">{formatRp(summaryMetrics.potensiPenjualan)}</h3>
            </div>
            <div className="bg-white p-4 rounded-2xl border-t-4 border-purple-600 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Potensi Profit</span>
              <h3 className="text-sm sm:text-base font-bold text-purple-600 mt-2">{formatRp(summaryMetrics.potensiProfit)}</h3>
            </div>
          </div>

          {/* FILTER & PENCARIAN STOK */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-white text-xs shadow-sm w-full sm:w-80">
              <Search size={15} className="text-gray-400 mr-2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk / No SKU..."
                className="w-full outline-none text-gray-700 bg-transparent text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-xl px-3 py-2 outline-none font-medium cursor-pointer"
              >
                <option value="Semua Status">Semua Status</option>
                <option value="Aman">Stok Aman</option>
                <option value="Menipis">Stok Menipis</option>
                <option value="Habis">Stok Habis</option>
              </select>

              <button 
                onClick={() => { setSearchQuery(''); setFilterStatus('Semua Status'); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* TABEL STOK PRODUK */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50 z-10 shadow-sm border-b border-gray-200 text-gray-500 font-semibold">
                  <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">No SKU</th>
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3 text-center">Stok</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Harga Reseller (Modal)</th>
                    <th className="p-3">Harga Jual</th>
                    <th className="p-3">Nilai Stok Total</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredStock.length > 0 ? (
                    filteredStock.map((item, idx) => {
                      const nilaiStokItem = item.stok * item.hargaBeli;
                      let statusBadge = <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">Aman</span>;
                      if (item.stok === 0) {
                        statusBadge = <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">Habis</span>;
                      } else if (item.stok <= 5) {
                        statusBadge = <span className="bg-amber-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">Menipis</span>;
                      }

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="p-3 text-center font-medium text-gray-400">{idx + 1}</td>
                          <td className="p-3 font-mono text-blue-600 font-bold whitespace-nowrap">{item.barcode}</td>
                          <td className="p-3 font-bold text-gray-800">{item.namaProduk}</td>
                          <td className="p-3 text-center font-bold text-sm text-blue-600">{item.stok} Pcs</td>
                          <td className="p-3 text-center">{statusBadge}</td>
                          <td className="p-3 font-medium">{formatRp(item.hargaBeli)}</td>
                          <td className="p-3 font-medium">{formatRp(item.hargaJual)}</td>
                          <td className="p-3 font-bold text-emerald-600">{formatRp(nilaiStokItem)}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                                title="Edit Produk"
                              >
                                <Edit size={13} />
                              </button>
                              <button 
                                onClick={() => handleHapusClick(item)}
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition cursor-pointer"
                                title="Hapus Produk"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-16 text-gray-400 font-medium">
                        Belum ada data stok produk tersimpan di Supabase.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}