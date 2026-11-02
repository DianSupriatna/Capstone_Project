import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useReports() {
  const [riwayatList, setRiwayatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRiwayatLaporan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: reportsData, error: reportError } = await supabase
        .from('import_reports')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (reportError) throw reportError;

      if (reportsData && reportsData.length > 0) {
        const { data: detailsData, error: detailError } = await supabase
          .from('transaction_details')
          .select('*');

        if (detailError) throw detailError;

        const formattedList = reportsData.map(rep => {
          const matchSku = (detailsData || []).filter(item => item.report_id === rep.id);
          return {
            id: rep.id,
            namaFile: rep.file_name,
            tanggalSimpan: new Date(rep.uploaded_at).toISOString().replace('T', ' ').substring(0, 16),
            omset: Number(rep.total_omzet || 0),
            biayaPlatform: Number(rep.total_platform_fee || 0),
            biayaProgram: Number(rep.total_program_fee || 0),
            voucherIklan: Number(rep.total_voucher || 0),
            biayaOperasional: Number(rep.total_operational || 0),
            keuntunganBersih: Number(rep.net_profit || 0),
            skuList: matchSku.map(s => ({
              id: s.id,
              noPesanan: s.order_number,
              tanggal: s.transaction_date,
              idSku: s.product_sku ? s.product_sku.split(' - ')[0] : '-',
              namaSku: s.product_sku ? (s.product_sku.includes(' - ') ? s.product_sku.split(' - ').slice(1).join(' - ') : s.product_sku) : 'Produk Marketplace',
              jumlahQty: s.quantity,
              omsetMarketplace: Number(s.marketplace_omzet || 0),
              modalSatuan: Number(s.total_modal || 0) / (s.quantity || 1)
            }))
          };
        });

        setRiwayatList(formattedList);
      } else {
        setRiwayatList([]);
      }
    } catch (err) {
      console.error('Gagal mengambil data dari Supabase:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiwayatLaporan();
  }, [fetchRiwayatLaporan]);

  const deleteReport = async (id) => {
    const { error } = await supabase
      .from('import_reports')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchRiwayatLaporan();
  };

  return {
    riwayatList,
    loading,
    error,
    refreshReports: fetchRiwayatLaporan,
    deleteReport
  };
}