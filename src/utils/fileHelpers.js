import * as XLSX from 'xlsx';

/**
 * Pembersih Format Angka / Rupiah
 */
export const cleanPrice = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val);
  let str = String(val).trim().replace(/[^0-9,-]/g, '').replace(',', '.');
  let num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num);
};

export const formatRp = (v) => {
  return "Rp " + Math.floor(v || 0).toLocaleString('id-ID');
};

/**
 * Pembersih Teks & String untuk Pencocokan SKU / Nama Produk
 */
const normalizeKey = (val) => String(val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Helper Format Timestamp Utuh (Tanggal + Jam) untuk Supabase
 */
const formatFullTimestamp = (rawDate) => {
  if (!rawDate) {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  // Jika berupa objek Date (karena flag cellDates: true di SheetJS)
  if (rawDate instanceof Date && !isNaN(rawDate)) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = rawDate.getFullYear();
    const mm = pad(rawDate.getMonth() + 1);
    const dd = pad(rawDate.getDate());
    const hh = pad(rawDate.getHours());
    const min = pad(rawDate.getMinutes());
    const ss = pad(rawDate.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }

  const str = String(rawDate).trim();
  
  // Jika format string sudah mengandung jam (contoh: "2026-09-11 14:30:00" atau dengan 'T')
  if (str.includes(' ') || str.includes('T')) {
    return str.replace('T', ' ').substring(0, 19);
  }

  // Jika hanya tanggal saja ("2026-09-11"), berikan default jam "00:00:00"
  if (str.length === 10) {
    return `${str} 00:00:00`;
  }

  return str;
};

/**
 * 1. PARSER UNTUK DATA PENGHASILAN (Pencairan Marketplace vs Products & Orders Master Supabase)
 */
export const parseMarketplaceExcel = (file, stockList = [], operationalList = [], ordersMasterList = []) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellText: true, cellDates: true });

        // A. Multi-Key Lookup Map dari Products / Info Stok Supabase
        const stockSkuMap = new Map();
        const stockNameMap = new Map();

        if (Array.isArray(stockList)) {
          stockList.forEach(item => {
            const hargaReseller = Math.abs(cleanPrice(
              item.purchase_price !== undefined ? item.purchase_price :
              item.harga_beli !== undefined ? item.harga_beli :
              item.hargaBeli !== undefined ? item.hargaBeli :
              item.reseller_price !== undefined ? item.reseller_price :
              item.harga_reseller !== undefined ? item.harga_reseller :
              item.modal_satuan !== undefined ? item.modal_satuan :
              item.modal !== undefined ? item.modal : 0
            ));

            const skuKeys = [item.sku, item.product_sku, item.barcode, item.id, item.kode_produk, item.idSku];
            skuKeys.forEach(k => {
              if (k !== undefined && k !== null && String(k).trim() !== '') {
                stockSkuMap.set(normalizeKey(k), hargaReseller);
              }
            });

            const namaKeys = [item.products_name, item.name, item.nama_produk, item.namaProduk, item.product_name, item.title];
            namaKeys.forEach(n => {
              if (n !== undefined && n !== null && String(n).trim() !== '') {
                stockNameMap.set(normalizeKey(n), hargaReseller);
              }
            });
          });
        }

        // B. Lookup Map dari Orders Master Supabase (No Pesanan + SKU -> Qty Presisi)
        const ordersMap = new Map();
        const ordersMasterMap = new Map();

        if (Array.isArray(ordersMasterList)) {
          ordersMasterList.forEach(order => {
            const orderNo = normalizeKey(order.order_number || order.noPesanan);
            const skuId = normalizeKey(order.sku_id || order.idSku);
            const qty = Number(order.quantity || order.jumlahQty || 1);
            if (orderNo) {
              if (skuId) ordersMap.set(`${orderNo}_${skuId}`, qty);
              
              if (!ordersMap.has(orderNo)) {
                  ordersMap.set(orderNo, qty);
              }

              if (!ordersMasterMap.has(orderNo)) {
                ordersMasterMap.set(orderNo, []);
              }
              ordersMasterMap.get(orderNo).push(order);
            }
          });
        }

        let omsetKotor = 0;
        let totalDilepas = 0;
        let summaryVoucher = 0;
        let summaryIklan = 0;

        // D. BACA SHEET "Summary" / "Ringkasan"
        const sheetSummaryName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('summary') || 
          n.toLowerCase().includes('ringkasan')
        ) || workbook.SheetNames[0];

        if (sheetSummaryName) {
          const summarySheet = workbook.Sheets[sheetSummaryName];
          const summaryRows = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });

          summaryRows.forEach(row => {
            if (!row || row.length === 0) return;
            const label = String(row[0] || '').trim().toLowerCase();
            const val = Math.abs(cleanPrice(row[1] || row[row.length - 1]));

            if (label.includes('total yang dilepas')) {
              totalDilepas = val;
            }
            if (label.includes('subtotal pesanan') || label.includes('harga asli produk')) {
              omsetKotor = val;
            }
            if (label.includes('voucher & subsidi') || label.includes('voucher co-fund') || label.includes('voucher disponsor')) {
              summaryVoucher += val;
            }
          });
        }

        let parsedSkuList = [];

        // E. BACA BIAYA PROMOSI KHUSUS DARI SHEET "SELLER FEE"
        const promoOrderMap = new Map(); 
        const sheetSellerFeeName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('seller fee') || n.toLowerCase().includes('fee')
        );

        if (sheetSellerFeeName) {
          const sellerFeeSheet = workbook.Sheets[sheetSellerFeeName];
          const sellerFeeRows = XLSX.utils.sheet_to_json(sellerFeeSheet, { header: 1 });
          
          let sfHeaderIdx = -1;
          let sfHeaders = [];
          
          for (let i = 0; i < sellerFeeRows.length; i++) {
            const rowStr = sellerFeeRows[i].map(c => String(c || '').toLowerCase()).join(' ');
            if (rowStr.includes('no. pesanan') || rowStr.includes('no pesanan')) {
              sfHeaderIdx = i;
              sfHeaders = sellerFeeRows[i].map(c => String(c || '').trim());
              break;
            }
          }
          
          if (sfHeaderIdx !== -1) {
            for (let i = sfHeaderIdx + 1; i < sellerFeeRows.length; i++) {
              const rowData = sellerFeeRows[i];
              if (!rowData || rowData.length === 0) continue;
              
              const row = {};
              sfHeaders.forEach((h, colIdx) => {
                if (h) row[h] = rowData[colIdx];
              });
              
              const noPesanan = String(row['No. Pesanan'] || row['No Pesanan'] || '').trim();
              if (noPesanan) {
                let biayaPromo = 0;
                Object.keys(row).forEach(k => {
                  const kl = k.toLowerCase().trim();
                  if (kl.includes('biaya promosi') || kl.includes('biaya penghasilan')) {
                     biayaPromo += Math.abs(cleanPrice(row[k]));
                  }
                });
                promoOrderMap.set(normalizeKey(noPesanan), biayaPromo);
              }
            }
          }
        }

        // F. BACA DETAIL RINCIAN SKU DARI SHEET PENGHASILAN
        const sheetDetailName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('detail') || 
          n.toLowerCase().includes('transaksi') || 
          n.toLowerCase().includes('pesanan') || 
          n.toLowerCase().includes('penghasilan')
        ) || workbook.SheetNames[0];

        if (sheetDetailName) {
          const detailSheet = workbook.Sheets[sheetDetailName];
          const rawRows = XLSX.utils.sheet_to_json(detailSheet, { header: 1 });

          let headerRowIndex = -1;
          let headers = [];

          for (let i = 0; i < rawRows.length; i++) {
            const rowStr = rawRows[i].map(c => String(c || '').toLowerCase()).join(' ');
            if (rowStr.includes('no. pesanan') || rowStr.includes('no pesanan') || rowStr.includes('order id') || rowStr.includes('no. pengajuan')) {
              headerRowIndex = i;
              headers = rawRows[i].map(c => String(c || '').trim());
              break;
            }
          }

          if (headerRowIndex !== -1) {
            for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
              const rowData = rawRows[i];
              if (!rowData || rowData.length === 0) continue;

              const row = {};
              headers.forEach((h, colIdx) => {
                if (h) row[h] = rowData[colIdx];
              });

              const noPesanan = String(
                row['No. Pesanan'] || row['No Pesanan'] || row['Order ID'] || row['No. Pengajuan'] || ''
              ).trim();

              if (!noPesanan || noPesanan.toLowerCase().includes('no.') || noPesanan.toLowerCase().includes('pesanan')) {
                continue;
              }

              const idSku = String(
                row['SKU Produk'] || row['ID SKU'] || row['SKU'] || row['ID Produk'] || row['Nomor Referensi SKU'] || '-'
              ).trim();

              const namaSku = String(
                row['Nama Produk'] || row['Nama SKU'] || row['Product Name'] || '-'
              ).trim();

              const lihatBerdasarkan = String(row['Lihat berdasarkan'] || row['Lihat Berdasarkan'] || '').toLowerCase();
              
              if (lihatBerdasarkan === 'pesanan' || lihatBerdasarkan === 'order' || (idSku === '-' && namaSku === '-') || (!idSku && !namaSku)) {
                continue;
              }

              const tanggalRaw = row['Waktu Pesanan Dibuat'] || row['Waktu Pesanan dibuat'] || row['Tanggal Dana Dilepaskan'] || row['Tanggal'] || null;
              const tanggal = formatFullTimestamp(tanggalRaw);

              let jumlahQty = 1;
              let qtyFound = false;

              let realSku = null;
              const normOrderNo = normalizeKey(noPesanan);
              const normIncomeName = normalizeKey(namaSku);
              const normIdSku = normalizeKey(idSku);
              
              if (ordersMasterMap.has(normOrderNo)) {
                const orderItems = ordersMasterMap.get(normOrderNo);
                
                let matchedItem = orderItems.find(oi => {
                   const oiSku = normalizeKey(oi.sku_id || oi.idSku || oi.sku || '');
                   return oiSku && normIdSku && (oiSku === normIdSku || oiSku.includes(normIdSku) || normIdSku.includes(oiSku));
                });
                
                if (!matchedItem) {
                    matchedItem = orderItems.find(oi => {
                      const oiName = normalizeKey(oi.nama_sku || oi.namaSku || oi.product_name || '');
                      return oiName && normIncomeName && (oiName.includes(normIncomeName) || normIncomeName.includes(oiName));
                    });
                }

                if (!matchedItem && orderItems.length === 1) {
                  matchedItem = orderItems[0];
                }

                if (matchedItem) {
                  realSku = matchedItem.sku_id || matchedItem.idSku || matchedItem.sku;
                  jumlahQty = Number(matchedItem.quantity || matchedItem.jumlahQty || 1);
                  qtyFound = true;
                }
              }

              if (!qtyFound) {
                  const matchKeyWithSku = `${normOrderNo}_${normIdSku}`;
                  if (ordersMap.has(matchKeyWithSku)) {
                    jumlahQty = ordersMap.get(matchKeyWithSku);
                    qtyFound = true;
                  } 
              }

              if (!qtyFound) {
                Object.keys(row).forEach(key => {
                  const k = key.toLowerCase().trim();
                  if (!qtyFound && (k.includes('kuantitas') || k.includes('jumlah') || k.includes('qty') || k.includes('quantity'))) {
                    if (!k.includes('pengembalian') && !k.includes('harga') && !k.includes('omset') && !k.includes('total')) {
                      const val = Math.abs(cleanPrice(row[key]));
                      if (val > 0) {
                        jumlahQty = val;
                        qtyFound = true;
                      }
                    }
                  }
                });
              }

              const omset = Math.abs(cleanPrice(
                row['Harga Setelah Diskon'] || row['Total Harga Produk'] || row['Harga Produk'] || row['Total Penghasilan'] || row['Omset']
              ));

              let modalSatuan = undefined;
              if (realSku) {
                modalSatuan = stockSkuMap.get(normalizeKey(realSku));
              }

              if (modalSatuan === undefined || modalSatuan === 0) {
                modalSatuan = stockSkuMap.get(normalizeKey(idSku));
              }

              if (modalSatuan === undefined || modalSatuan === 0) {
                modalSatuan = stockNameMap.get(normalizeKey(namaSku));
              }

              if ((modalSatuan === undefined || modalSatuan === 0) && stockNameMap.size > 0) {
                const normNama = normalizeKey(namaSku);
                for (let [storedName, price] of stockNameMap.entries()) {
                  if (storedName && (normNama.includes(storedName) || storedName.includes(normNama))) {
                    modalSatuan = price;
                    break;
                  }
                }
              }

              if (modalSatuan === undefined || modalSatuan === 0) {
                modalSatuan = Math.abs(cleanPrice(row['Harga Modal'] || row['Harga Reseller'] || 0));
              }

              const totalModal = modalSatuan * jumlahQty;

              const biayaAdministrasi = Math.abs(cleanPrice(row['Biaya Administrasi'] || 0));
              const biayaProsesPesanan = Math.abs(cleanPrice(row['Biaya Proses Pesanan'] || 0));
              const biayaPlatformAsli = Math.abs(cleanPrice(row['Biaya Platform'] || 0));
              const bPlatform = biayaAdministrasi + biayaProsesPesanan + biayaPlatformAsli;

              let biayaGratisOngkir = 0;
              Object.keys(row).forEach(key => {
                const kLower = key.toLowerCase().trim();
                if (kLower.includes('biaya gratis ongkir xtra') || kLower.includes('biaya gratis ongkir extra')) {
                  biayaGratisOngkir += Math.abs(cleanPrice(row[key]));
                }
              });
              const biayaTransaksi = Math.abs(cleanPrice(row['Biaya Transaksi'] || 0));
              const bProgram = biayaGratisOngkir + biayaTransaksi;

              let bPromosi = promoOrderMap.get(normOrderNo) || 0;
              promoOrderMap.set(normOrderNo, 0); 

              const selisih = omset - totalModal - bPlatform - bProgram - bPromosi;

              parsedSkuList.push({
                id: `${noPesanan}-${idSku}-${i}`,
                noPesanan,
                tanggal,
                idSku: realSku || idSku,
                namaSku,
                jumlahQty,
                modalSatuan,
                totalModal,
                omsetMarketplace: omset,
                biayaPlatform: bPlatform,
                biayaProgram: bProgram,
                biayaPromosi: bPromosi,
                selisih,
                isUntung: selisih >= 0
              });
            }
          }
        }

        let sumOmset = 0;
        let sumPlatform = 0;
        let sumProgram = 0;
        let sumPromosi = 0;
        let totalSelisihBersih = 0;

        parsedSkuList.forEach(item => {
          sumOmset += item.omsetMarketplace;
          sumPlatform += item.biayaPlatform;
          sumProgram += item.biayaProgram;
          sumPromosi += item.biayaPromosi;
          totalSelisihBersih += item.selisih;
        });

        const finalOmset = totalDilepas > 0 ? totalDilepas : sumOmset;
        const summaryVoucherIklan = summaryVoucher + sumPromosi;

        let runningYearMonth = parsedSkuList.length > 0 && parsedSkuList[0].tanggal 
          ? parsedSkuList[0].tanggal.substring(0, 7) 
          : new Date().toISOString().substring(0, 7);

        let biayaOperasionalBulanIni = 0;
        if (Array.isArray(operationalList) && operationalList.length > 0) {
          operationalList.forEach(op => {
            const opDate = String(op.expense_date || op.tanggal || op.created_at || '');
            if (opDate.startsWith(runningYearMonth)) {
              biayaOperasionalBulanIni += Math.abs(cleanPrice(op.amount || op.biaya || op.nominal));
            }
          });
        }

        const keuntunganBersih = totalSelisihBersih - biayaOperasionalBulanIni;

        resolve({
          omset: finalOmset,
          biayaPlatform: sumPlatform,
          biayaProgram: sumProgram,
          voucherIklan: summaryVoucherIklan,
          biayaOperasional: biayaOperasionalBulanIni,
          keuntunganBersih: keuntunganBersih,
          namaFile: file.name,
          skuList: parsedSkuList
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 2. PARSER UNTUK REKAP PESANAN (Mendukung Timestamp Lengkap Tanggal + Jam)
 */
export const parseOrderExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellText: true, cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let headerRowIndex = -1;
        let headers = [];

        for (let i = 0; i < rawRows.length; i++) {
          const rowStr = rawRows[i].map(c => String(c || '').toLowerCase()).join(' ');
          if (rowStr.includes('no. pesanan') || rowStr.includes('no pesanan') || rowStr.includes('order id') || rowStr.includes('no. pengajuan')) {
            headerRowIndex = i;
            headers = rawRows[i].map(c => String(c || '').trim());
            break;
          }
        }

        const parsedOrderList = [];
        let totalItems = 0;
        let totalQtyPcs = 0;
        let totalNilaiPesanan = 0;
        let totalBatalCount = 0;

        if (headerRowIndex !== -1) {
          for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const rowData = rawRows[i];
            if (!rowData || rowData.length === 0) continue;

            const row = {};
            headers.forEach((h, colIdx) => {
              if (h) row[h] = rowData[colIdx];
            });

            const noPesanan = String(
              row['No. Pesanan'] || row['No Pesanan'] || row['Order ID'] || row['No. Pengajuan'] || ''
            ).trim();

            if (!noPesanan || noPesanan.toLowerCase().includes('no.') || noPesanan.toLowerCase().includes('pesanan')) {
              continue;
            }

            const statusRaw = String(
              row['Status Pesanan'] || row['Order Status'] || row['Status'] || 'Selesai'
            ).trim();

            const isCancelled = statusRaw.toLowerCase().includes('batal') || 
                              statusRaw.toLowerCase().includes('cancel') || 
                              statusRaw.toLowerCase().includes('pengembalian');

            const statusPesanan = isCancelled ? 'Dibatalkan' : 'Aktif';

            // Menggunakan helper formatFullTimestamp agar menangkap Jam, Menit, dan Detik secara akurat
            const tanggalRaw = row['Waktu Pesanan Dibuat'] || row['Waktu Pesanan dibuat'] || row['Tanggal Pesanan'] || row['Tanggal'] || null;
            const tanggal = formatFullTimestamp(tanggalRaw);

            const idSku = String(
              row['Nomor Referensi SKU'] || row['SKU Produk'] || row['ID SKU'] || row['SKU Induk'] || row['SKU'] || row['ID Produk'] || '-'
            ).trim();

            const namaSku = String(
              row['Nama Produk'] || row['Nama SKU'] || row['Product Name'] || '-'
            ).trim();

            let jumlahQty = 1;
            let qtyFound = false;

            Object.keys(row).forEach(key => {
              const k = key.toLowerCase().trim();
              if (!qtyFound && (k.includes('kuantitas') || k.includes('jumlah') || k.includes('qty') || k.includes('quantity'))) {
                if (!k.includes('harga') && !k.includes('total') && !k.includes('ongkir') && !k.includes('diskon')) {
                  const val = cleanPrice(row[key]);
                  if (val > 0) {
                    jumlahQty = val;
                    qtyFound = true;
                  }
                }
              }
            });

            const hargaProduk = cleanPrice(
              row['Harga Setelah Diskon'] || row['Total Harga Produk'] || row['Harga Produk'] || row['Harga Jual'] || row['Deal Price']
            );

            parsedOrderList.push({
              id: `${noPesanan}-${idSku}-${i}`,
              noPesanan,
              tanggal, // Sekarang membawa nilai format "YYYY-MM-DD HH:mm:ss"
              idSku,
              namaSku,
              jumlahQty,
              hargaProduk,
              statusPesanan,
              pencairanStatus: 'Belum Cair'
            });

            totalItems += 1;
            
            if (!isCancelled) {
              totalQtyPcs += jumlahQty;
              totalNilaiPesanan += (hargaProduk * jumlahQty);
            } else {
              totalBatalCount += 1;
            }
          }
        }

        resolve({
          namaFile: file.name,
          totalItems,
          totalQtyPcs,
          totalNilaiPesanan,
          totalBatalCount,
          orderList: parsedOrderList
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 3. EKSPOR KE CSV
 */
export const exportToCSV = (dataList, filename = 'export_data.csv') => {
  if (!dataList || !dataList.length) return false;

  let csvContent = "No SKU,Nama Barang,Stok,Harga Reseller,Harga Jual\n";
  dataList.forEach(row => {
    csvContent += `"${row.barcode || ''}","${row.namaProduk || ''}",${row.stok || 0},${row.hargaBeli || 0},${row.hargaJual || 0}\n`;
  });

  const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
};