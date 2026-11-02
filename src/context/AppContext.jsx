import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Global State untuk Profil, Stok, dan Riwayat Laporan
  const [userProfile, setUserProfile] = useState({
    name: 'Punya Saya',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
  });

  const [stockList, setStockList] = useState([
    { id: 1, barcode: '8587654066', namaProduk: '244 Abon Ayam 200gr', kategori: 'Makanan Kering', satuan: 'Bks', hargaBeli: 32941, hargaJual: 39000, stok: 0 },
    { id: 2, barcode: '858787654066', namaProduk: '244 Abon Ayam 80gr', kategori: 'Makanan Kering', satuan: 'Bks', hargaBeli: 14118, hargaJual: 17000, stok: 0 },
    { id: 3, barcode: '89970160442', namaProduk: '244 Abon Sapi 100gr', kategori: 'Makanan Kering', satuan: 'Bks', hargaBeli: 24706, hargaJual: 30000, stok: 0 },
    { id: 4, barcode: '8997016530442', namaProduk: '244 Abon Sapi 50gr', kategori: 'Makanan Kering', satuan: 'Bks', hargaBeli: 12941, hargaJual: 16000, stok: 21 },
    { id: 5, barcode: '8997015513006', namaProduk: 'Abon Cap 32 100 gr - Manis (elang)', kategori: 'Makanan Kering', satuan: 'Pcs', hargaBeli: 18750, hargaJual: 25500, stok: 2 }
  ]);

  const [biayaOperasionalList, setBiayaOperasionalList] = useState([
    {
      id: 1,
      tanggal: '2026-10-10',
      jenisBiaya: 'Refund',
      keterangan: 'Barang Kurang',
      jumlah: '1 Pcs',
      nominal: 10000,
      biayaLainnya: 2500,
      ketLainnya: 'Adm Transfer'
    }
  ]);

  // Fungsi validasi angka positif (Saran 3: Validasi Ketat)
  const validatePositiveNumber = (value) => {
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  };

  return (
    <AppContext.Provider value={{
      userProfile,
      setUserProfile,
      stockList,
      setStockList,
      biayaOperasionalList,
      setBiayaOperasionalList,
      validatePositiveNumber
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}