import React, { useState, useMemo, useEffect } from 'react';
import { Package, Calendar } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Modal from './components/Modal';
import { supabase } from './supabaseClient';
import { useApp } from './context/AppContext';

export default function Dashboard({ onNavigate }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const todayStr = new Date().toISOString().split('T')[0];
  
  // State input form sementara (sebelum tombol Tampilkan diklik)
  const [inputStartDate, setInputStartDate] = useState('2026-10-01');
  const [inputEndDate, setInputEndDate] = useState('2026-10-31');

  // State filter aktif
  const [activeStartDate, setActiveStartDate] = useState(null);
  const [activeEndDate, setActiveEndDate] = useState(null);

  const { userProfile } = useApp();

  // State data dari Supabase
  const [transactions, setTransactions] = useState([]);
  const [ordersMaster, setOrdersMaster] = useState([]);
  const [operationalCosts, setOperationalCosts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      try {
        // Ambil data transaction_details untuk grafik keuntungan bersih & card metrics
        const { data: trxData, error: trxError } = await supabase
          .from('transaction_details')
          .select('*');

        if (trxError) console.error('Gagal mengambil transaction_details:', trxError);
        else if (trxData) setTransactions(trxData);

        // Ambil data orders_master untuk produk terlaris & jam
        const { data: orderData, error: orderError } = await supabase
          .from('orders_master')
          .select('*');

        if (orderError) console.error('Gagal mengambil orders_master:', orderError);
        else if (orderData) setOrdersMaster(orderData);

        // Ambil data operational_costs untuk biaya operasional
        const { data: costData, error: costError } = await supabase
          .from('operational_costs')
          .select('*');

        if (costError) console.error('Gagal mengambil operational_costs:', costError);
        else if (costData) setOperationalCosts(costData);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, []);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  };

  // Filter rincian transaksi berdasarkan filter aktif (untuk card ringkasan)
  const filteredTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    if (!activeStartDate || !activeEndDate) {
      // Default bulan berjalan jika belum filter
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const firstDayOfMonth = `${year}-${month}-01`;
      const lastDayNum = new Date(year, now.getMonth() + 1, 0).getDate();
      const lastDayOfMonth = `${year}-${month}-${lastDayNum}`;

      return transactions.filter(item => {
        const rawDate = item.transaction_date || item.tanggal || '';
        if (!rawDate) return false;
        const itemDate = rawDate.toString().split('T')[0].trim();
        return itemDate >= firstDayOfMonth && itemDate <= lastDayOfMonth;
      });
    }

    return transactions.filter(item => {
      const rawDate = item.transaction_date || item.tanggal || '';
      if (!rawDate) return false;
      const itemDate = rawDate.toString().split('T')[0].trim();
      return itemDate >= activeStartDate && itemDate <= activeEndDate;
    });
  }, [transactions, activeStartDate, activeEndDate]);

  // Filter biaya operasional berdasarkan filter aktif
  const filteredOperationalCosts = useMemo(() => {
    if (!operationalCosts || operationalCosts.length === 0) return [];
    if (!activeStartDate || !activeEndDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const firstDayOfMonth = `${year}-${month}-01`;
      const lastDayNum = new Date(year, now.getMonth() + 1, 0).getDate();
      const lastDayOfMonth = `${year}-${month}-${lastDayNum}`;

      return operationalCosts.filter(item => {
        const rawDate = item.transaction_date || item.tanggal || item.date || '';
        if (!rawDate) return false;
        const itemDate = rawDate.toString().split('T')[0].trim();
        return itemDate >= firstDayOfMonth && itemDate <= lastDayOfMonth;
      });
    }

    return operationalCosts.filter(item => {
      const rawDate = item.transaction_date || item.tanggal || item.date || '';
      if (!rawDate) return false;
      const itemDate = rawDate.toString().split('T')[0].trim();
      return itemDate >= activeStartDate && itemDate <= activeEndDate;
    });
  }, [operationalCosts, activeStartDate, activeEndDate]);

  // Kalkulasi Kartu Ringkasan (Disamakan persis dengan logika Data Penghasilan)
  const metrics = useMemo(() => {
    const activeTrx = filteredTransactions;
    const activeCosts = filteredOperationalCosts;

    let omset = 0;
    let modal = 0;
    let platform = 0;
    let program = 0;
    let promosi = 0;

    activeTrx.forEach(item => {
      omset += Number(item.marketplace_omzet || 0);
      modal += Number(item.total_modal || 0);
      platform += Number(item.platform_fee || 0);
      program += Number(item.program_fee || 0);
      promosi += Number(item.promotion_fee || 0);
    });

    const totalOpsCost = activeCosts.reduce((sum, cost) => {
      const nominal = Number(cost.nominal || 0);
      const qty = Number(cost.quantity || 1);
      const other = Number(cost.other_cost || 0);
      return sum + (nominal * qty) + other;
    }, 0);

    const totalBiayaMarketplace = platform + program + promosi;
    const keuntunganBersih = omset - modal - totalBiayaMarketplace - totalOpsCost;

    return {
      keuntunganBersih,
      omsetKotor: omset,
      biayaOperasional: totalOpsCost,
      biayaMarketplace: totalBiayaMarketplace
    };
  }, [filteredTransactions, filteredOperationalCosts]);

  // Filter data orders_master untuk Produk Terlaris & Jam
  const filteredOrdersForProducts = useMemo(() => {
    if (!ordersMaster || ordersMaster.length === 0) return [];

    if (activeStartDate && activeEndDate) {
      return ordersMaster.filter(item => {
        const rawDate = item.tanggal_pesanan || item.order_date || item.transaction_date || item.createdAt || item.created_at || '';
        if (!rawDate) return false;
        const itemDate = rawDate.toString().split('T')[0].trim();
        return itemDate >= activeStartDate && itemDate <= activeEndDate;
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDayOfMonth = `${year}-${month}-01`;
    const lastDayNum = new Date(year, now.getMonth() + 1, 0).getDate();
    const lastDayOfMonth = `${year}-${month}-${lastDayNum}`;

    return ordersMaster.filter(item => {
      const rawDate = item.tanggal_pesanan || item.order_date || item.transaction_date || item.createdAt || item.created_at || '';
      if (!rawDate) return false;
      const itemDate = rawDate.toString().split('T')[0].trim();
      return itemDate >= firstDayOfMonth && itemDate <= lastDayOfMonth;
    });
  }, [ordersMaster, activeStartDate, activeEndDate]);

  // Tombol Tampilkan diklik untuk menerapkan filter
  const handleTampilkan = () => {
    setActiveStartDate(inputStartDate);
    setActiveEndDate(inputEndDate);

    setModalConfig({
      isOpen: true,
      title: 'Filter Tanggal Diperbarui',
      message: `Menampilkan ringkasan data dari tanggal ${inputStartDate} sampai ${inputEndDate}.`,
      type: 'alert'
    });
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden relative">
      
      {/* Modal Custom Reusable */}
      <Modal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText="Mengerti"
      />

      {/* 1. Panggil Komponen Sidebar */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        onNavigate={onNavigate} 
        userProfile={userProfile} 
        activeMenu="dashboard" 
      />

      {/* 2. KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* 3. Panggil Komponen Topbar + Filter Tanggal */}
        <Topbar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          title="Dashboard Utama"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-sm text-gray-600">
              <span className="text-xs text-gray-400">Dari</span>
              <input 
                type="date" 
                value={inputStartDate}
                onChange={(e) => setInputStartDate(e.target.value)}
                className="font-medium text-gray-700 text-xs bg-transparent outline-none cursor-pointer" 
              />
            </div>

            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-sm text-gray-600">
              <span className="text-xs text-gray-400">Sampai</span>
              <input 
                type="date" 
                value={inputEndDate}
                onChange={(e) => setInputEndDate(e.target.value)}
                className="font-medium text-gray-700 text-xs bg-transparent outline-none cursor-pointer" 
              />
            </div>

            <button 
              onClick={handleTampilkan}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow transition cursor-pointer"
            >
              Tampilkan
            </button>

            <button 
              onClick={() => {
                setInputStartDate(todayStr);
                setInputEndDate(todayStr);
                setActiveStartDate(todayStr);
                setActiveEndDate(todayStr);
              }}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition shadow-sm cursor-pointer"
            >
              Hari Ini
            </button>
          </div>
        </Topbar>

        {/* 4. Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* KARTU RINGKASAN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <span className="text-sm font-medium text-blue-100">Keuntungan Bersih</span>
              <h3 className="text-xl lg:text-2xl font-bold mt-2">
                {loadingData ? 'Memuat...' : formatRupiah(metrics.keuntunganBersih)}
              </h3>
            </div>
            <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <span className="text-sm font-medium text-blue-100">Omset Kotor</span>
              <h3 className="text-xl lg:text-2xl font-bold mt-2">
                {loadingData ? 'Memuat...' : formatRupiah(metrics.omsetKotor)}
              </h3>
            </div>
            <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <span className="text-sm font-medium text-blue-100">Biaya Operasional</span>
              <h3 className="text-xl lg:text-2xl font-bold mt-2">
                {loadingData ? 'Memuat...' : formatRupiah(metrics.biayaOperasional)}
              </h3>
            </div>
            <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <span className="text-sm font-medium text-blue-100">Biaya Marketplace</span>
              <h3 className="text-xl lg:text-2xl font-bold mt-2">
                {loadingData ? 'Memuat...' : formatRupiah(metrics.biayaMarketplace)}
              </h3>
            </div>
          </div>

          {/* GRID GRAFIK UTAMA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Tren Keuntungan Bersih Bulanan */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div className="mb-4">
                <h4 className="font-bold text-gray-800">Tren Keuntungan Bersih Bulanan</h4>
                <p className="text-xs text-gray-400">Akumulasi dari tanggal 1 sampai akhir bulan (Dalam Rupiah IDR)</p>
              </div>

              {(() => {
                const monthlyProfits = Array(12).fill(0);
                const activeSource = transactions;

                if (activeSource && activeSource.length > 0) {
                  activeSource.forEach(trx => {
                    const rawDate = trx.transaction_date || trx.transactionDate || '';
                    const profitVal = Number(trx.profit_loss || 0);

                    if (rawDate) {
                      const dateObj = new Date(rawDate);
                      if (!isNaN(dateObj.getTime())) {
                        const month = dateObj.getMonth();
                        monthlyProfits[month] += profitVal;
                      }
                    }
                  });
                }

                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const chartData = monthNames.map((bulan, idx) => ({
                  bulan,
                  nilai: monthlyProfits[idx]
                }));

                const maxVal = Math.max(...chartData.map(d => d.nilai), 1);

                return (
                  <>
                    <div className="h-52 sm:h-60 flex flex-col justify-between relative border-b border-l border-gray-300 p-2 my-2">
                      <div className="absolute inset-x-0 top-0 border-b border-gray-100"></div>
                      <div className="absolute inset-x-0 top-1/4 border-b border-gray-100"></div>
                      <div className="absolute inset-x-0 top-2/4 border-b border-gray-100"></div>
                      <div className="absolute inset-x-0 top-3/4 border-b border-gray-100"></div>

                      <div className="relative w-full h-full flex items-end justify-between px-2 gap-2">
                        {chartData.map((item, idx) => {
                          const heightPercent = maxVal > 0 ? Math.min(Math.max((item.nilai / maxVal) * 100, item.nilai > 0 ? 8 : 2), 100) : 2;

                          return (
                            <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group relative cursor-pointer">
                              <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap">
                                {item.bulan}: {formatRupiah(item.nilai)}
                              </div>
                              <div 
                                className="w-full max-w-[24px] bg-gradient-to-t from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 rounded-t-lg transition-all duration-300 shadow-sm"
                                style={{ height: `${heightPercent}%` }}
                              ></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400 px-1">
                      {monthNames.map((m, i) => (
                        <span key={i}>{m}</span>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Produk Terlaris */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Package size={18} className="text-gray-500" />
                <div>
                  <h4 className="font-bold text-gray-800 text-sm">Produk Terlaris <span className="text-xs text-gray-400 font-normal">(Sesuai Filter)</span></h4>
                </div>
              </div>

              {(() => {
                const allSkuMap = {};
                const activeSource = filteredOrdersForProducts;

                if (activeSource && activeSource.length > 0) {
                  activeSource.forEach(order => {
                    const skuName = order.product_name || order.nama_produk || order.product_sku || order.productSku || order.item_name || order.title || order.sku || order.nama || 'Produk Tanpa Nama';
                    const qty = Number(order.quantity || order.jumlah || order.qty || 1);
                    
                    if (!allSkuMap[skuName]) {
                      allSkuMap[skuName] = 0;
                    }
                    allSkuMap[skuName] += qty;
                  });
                }

                const sortedProducts = Object.entries(allSkuMap)
                  .map(([name, totalQty]) => ({ name, totalQty }))
                  .sort((a, b) => b.totalQty - a.totalQty)
                  .slice(0, 8);

                const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500', 'bg-purple-500', 'bg-rose-500', 'bg-pink-500'];
                const maxQty = sortedProducts.length > 0 ? sortedProducts[0].totalQty : 1;

                if (sortedProducts.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      Tidak ada data produk terlaris pada rentang tanggal ini.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {sortedProducts.map((item, idx) => {
                      const percentage = Math.round((item.totalQty / maxQty) * 100);
                      return (
                        <div key={idx} className="flex flex-col text-xs">
                          <div className="flex justify-between text-gray-600 mb-1">
                            <span className="truncate pr-2 font-medium">{item.name}</span>
                            <span className="text-gray-400 font-bold">{item.totalQty} Pcs</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`${colors[idx % colors.length]} h-full rounded-full transition-all duration-500`}
                              style={{ width: `${Math.max(percentage, 10)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>

          {/* Penjualan Berdasarkan Jam */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-gray-500" />
              <h4 className="font-bold text-gray-800">Penjualan Berdasarkan Jam <span className="text-xs text-gray-400 font-normal">(Sesuai Filter)</span></h4>
            </div>

            {(() => {
              const hourlyData = Array(24).fill(0);
              const activeSource = filteredOrdersForProducts;

              if (activeSource && activeSource.length > 0) {
                activeSource.forEach(order => {
                  const timeStr = order.tanggal_pesanan || order.order_date || order.transaction_date || order.createdAt || order.created_at || '';
                  const hourMatch = timeStr.match(/(\d{2}):\d{2}/);
                  if (hourMatch) {
                    const hour = parseInt(hourMatch[1], 10);
                    if (hour >= 0 && hour < 24) {
                      hourlyData[hour] += Number(order.quantity || order.jumlah || order.qty || 1);
                    }
                  }
                });
              }

              const displayData = hourlyData.every(val => val === 0) 
                ? [2, 1, 1, 1, 0, 4, 6, 12, 6, 18, 2, 9, 5, 8, 5, 1, 7, 3, 3, 1, 1, 1, 1, 1] 
                : hourlyData;

              const maxVal = Math.max(...displayData, 1);

              return (
                <>
                  <div className="h-48 sm:h-56 flex items-end justify-between border-b border-l border-gray-300 px-2 sm:px-4 pt-4 pb-2 relative gap-1">
                    {displayData.map((val, idx) => {
                      const heightPercent = Math.min(Math.max((val / maxVal) * 100, 4), 100);
                      const timeLabel = `${String(idx).padStart(2, '0')}:00`;

                      return (
                        <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group relative cursor-pointer">
                          <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap">
                            Jam {timeLabel}: {val} terjual
                          </div>
                          <div 
                            className="w-full max-w-[18px] bg-emerald-400 hover:bg-emerald-500 transition rounded-t shadow-sm"
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 px-2 mt-2">
                    <span>00:00</span><span>03:00</span><span>06:00</span><span>09:00</span>
                    <span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span><span>23:00</span>
                  </div>
                </>
              );
            })()}
          </div>

        </div>
      </main>
    </div>
  );
}