import React, { useState } from 'react';
import { Printer, RefreshCw, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { Pemasukan, Pengeluaran, SiswaTagihan } from '../types';

interface LaporanViewProps {
  pemasukanList: Pemasukan[];
  pengeluaranList: Pengeluaran[];
  currentLembaga: string;
  logoDataUrl: string | null;
  saldoAwal: number;
  siswaTagihanList: SiswaTagihan[];
  masterKelas: string[];
  formatRupiah: (val: number) => string;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LaporanView: React.FC<LaporanViewProps> = ({
  pemasukanList,
  pengeluaranList,
  currentLembaga,
  logoDataUrl,
  saldoAwal,
  siswaTagihanList,
  masterKelas,
  formatRupiah,
  onLogoUpload
}) => {
  const [selectedReportType, setSelectedReportType] = useState('Buku Kas Umum (BKU)');
  const [customReportType, setCustomReportType] = useState('');
  const [reportMonth, setReportMonth] = useState('Agustus 2026');
  const [selectedKelas, setSelectedKelas] = useState('ALL');

  const reportType = selectedReportType === 'Lainnya' 
    ? (customReportType.trim() || 'Laporan Custom') 
    : selectedReportType;

  // Month mapping to prefix YYYY-MM
  const getMonthPrefix = (label: string) => {
    if (label.includes('Agustus')) return '2026-08';
    if (label.includes('Juli')) return '2026-07';
    if (label.includes('Juni')) return '2026-06';
    return '2026-08';
  };

  const periodPrefix = getMonthPrefix(reportMonth);

  // All transactions sorted chronologically for BKU
  const allTxSorted = [
    ...pemasukanList.map(x => ({ ...x, type: 'IN' as const })),
    ...pengeluaranList.map(x => ({ ...x, type: 'OUT' as const }))
  ].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  let saldoAwalPeriode = saldoAwal;
  const txDalamPeriode: typeof allTxSorted = [];

  allTxSorted.forEach(tx => {
    const txPrefix = (tx.tanggal || '').slice(0, 7);
    if (txPrefix === periodPrefix) {
      txDalamPeriode.push(tx);
    } else if (txPrefix < periodPrefix) {
      saldoAwalPeriode += (tx.type === 'IN' ? tx.nominal : -tx.nominal);
    }
  });

  let totalIn = 0;
  let totalOut = 0;
  txDalamPeriode.forEach(tx => {
    if (tx.type === 'IN') totalIn += tx.nominal;
    if (tx.type === 'OUT') totalOut += tx.nominal;
  });

  const finalBalance = saldoAwalPeriode + totalIn - totalOut;

  // Rekap khusus Infaq / Pembayaran Siswa: satu sumber transaksi pemasukan,
  // difilter berdasarkan periode laporan dan kelas dari Master Kelas & Rombel.
  const siswaRekap = siswaTagihanList
    .filter(s => selectedKelas === 'ALL' || s.kelas === selectedKelas)
    .map(s => {
      const pembayaranPeriode = pemasukanList
        .filter(p => p.siswaId === s.id && (p.tanggal || '').slice(0, 7) === periodPrefix)
        .reduce((sum, p) => sum + p.nominal, 0);
      const totalTerbayar = pemasukanList
        .filter(p => p.siswaId === s.id)
        .reduce((sum, p) => sum + p.nominal, 0);
      const sisa = Math.max(s.target - totalTerbayar, 0);
      return { ...s, pembayaranPeriode, totalTerbayar, sisa, lunas: totalTerbayar >= s.target };
    });

  const totalRekapSiswa = siswaRekap.reduce((sum, s) => sum + s.pembayaranPeriode, 0);

  // Export report to Excel / CSV format
  const handleExportExcel = () => {
    let csvContent = `\uFEFF`; // UTF-8 BOM for Microsoft Excel
    csvContent += `LAPORAN KEUANGAN ${reportType.toUpperCase()}\n`;
    csvContent += `Lembaga: ${currentLembaga}\n`;
    csvContent += `Periode: ${reportMonth}\n`;
    csvContent += `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}\n\n`;

    csvContent += `No;Tanggal;No. Bukti;Tipe Transaksi;Kategori/Sumber;Pemasukan (Rp);Pengeluaran (Rp);Keterangan\n`;

    txDalamPeriode.forEach((tx, index) => {
      const typeText = tx.type === 'IN' ? 'Pemasukan' : 'Pengeluaran';
      const category = tx.type === 'IN' ? `${tx.sumber} (${tx.sub})` : (tx as any).kategori || 'Umum';
      const masuk = tx.type === 'IN' ? tx.nominal : 0;
      const keluar = tx.type === 'OUT' ? tx.nominal : 0;
      const cleanKet = (tx.keterangan || '').replace(/;/g, ',');

      csvContent += `${index + 1};"${tx.tanggal}";"${tx.noBukti || tx.id}";"${typeText}";"${category}";${masuk};${keluar};"${cleanKet}"\n`;
    });

    csvContent += `\n;TOTAL PEMASUKAN;;;;${totalIn};;\n`;
    csvContent += `;TOTAL PENGELUARAN;;;;;${totalOut};\n`;
    csvContent += `;SALDO AKHIR PERIODE;;;;;${finalBalance};\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `Laporan_${reportType.replace(/\s+/g, '_')}_${currentLembaga.replace(/\s+/g, '_')}_${reportMonth.replace(/\s+/g, '_')}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Print CSS stylesheet to ensure ONLY the document paper sheet is printed */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-report, #printable-report * {
            visibility: visible !important;
          }
          #printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            padding: 20px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Laporan Keuangan Otomatis</h1>
          <p className="text-xs text-slate-500">Dibuat instan dari transaksi harian. Siap cetak A4 atau ekspor Excel/CSV untuk Komite & Yayasan.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[14px] text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel / CSV</span>
          </button>
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-[14px] text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen (A4)</span>
          </button>
        </div>
      </div>

      {/* REPORT CONFIGURATION PANEL */}
      <div className="bg-white p-6 rounded-[14px] border border-slate-200/90 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jenis Laporan Administrasi</label>
          <select 
            value={selectedReportType}
            onChange={(e) => setSelectedReportType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="Buku Kas Umum (BKU)">Buku Kas Umum (BKU)</option>
            <option value="Rekapitulasi Pemasukan">Rekapitulasi Pemasukan</option>
            <option value="Rekapitulasi Pengeluaran">Rekapitulasi Pengeluaran</option>
            <option value="Laporan Saldo & Posisi Kas">Laporan Saldo & Posisi Kas</option>
            <option value="Laporan Pertanggungjawaban Bulanan">Laporan Pertanggungjawaban Bulanan</option>
            <option value="Infaq / Pembayaran Siswa">Infaq / Pembayaran Siswa</option>
            <option value="Lainnya">Jenis Laporan Lainnya (Ketik Manual)</option>
          </select>

          {selectedReportType === 'Lainnya' && (
            <input
              type="text"
              value={customReportType}
              onChange={(e) => setCustomReportType(e.target.value)}
              placeholder="Ketik nama / jenis laporan manual..."
              className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-[14px] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Periode Bulan</label>
          <select 
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="Agustus 2026">Agustus 2026</option>
            <option value="Juli 2026">Juli 2026</option>
            <option value="Juni 2026">Juni 2026</option>
          </select>
        </div>

        {selectedReportType === 'Infaq / Pembayaran Siswa' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="ALL">Semua Kelas</option>
              {masterKelas.map(kelas => <option key={kelas} value={kelas}>{kelas}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-end">
          <button 
            onClick={() => {}}
            className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-[14px] text-xs font-semibold border border-blue-200 transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Perbarui Preview Laporan</span>
          </button>
        </div>
      </div>

      {/* REALTIME A4 PRINT PREVIEW CANVAS */}
      <div className="bg-slate-300/60 p-6 md:p-10 rounded-[14px] border border-slate-300 overflow-x-auto flex justify-center">
        <div id="printable-report" className="bg-white w-[210mm] min-h-[297mm] p-12 shadow-2xl text-slate-900 text-xs font-sans relative flex flex-col justify-between">
          <div>
            {/* Official Header Kop Sekolah */}
            <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900 mb-6">
              <label className="w-16 h-16 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-300 font-bold text-slate-400 text-[10px] overflow-hidden cursor-pointer hover:border-blue-400 transition-all relative group" title="Klik untuk mengganti logo lembaga">
                {logoDataUrl ? (
                  <img src={logoDataUrl} className="w-full h-full object-contain p-1" alt="Logo" />
                ) : (
                  <span>LOGO</span>
                )}
                <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
              </label>
              <div className="flex-1 text-center">
                <h2 className="text-base font-bold uppercase tracking-wide text-slate-900">{currentLembaga}</h2>
                <p className="text-[11px] text-slate-600">Kp. Selajambe Rt/Rw : 04/05 Desa Hegarmanah, Kec. Sukaluyu, Cianjur 43284 Telp. 0263-2324180</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Email: smp.tungturunan@gmail.com | NPSN: 20252330</p>
              </div>
            </div>

            {/* Report Title */}
            <div className="text-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 underline">
                LAPORAN {reportType.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Periode: <span className="font-semibold">{reportMonth}</span>
                {selectedReportType === 'Infaq / Pembayaran Siswa' && (<> • Kelas: <span className="font-semibold">{selectedKelas === 'ALL' ? 'Semua Kelas' : selectedKelas}</span></>)}
              </p>
            </div>

            {/* Report Table Body */}
            {selectedReportType === 'Infaq / Pembayaran Siswa' ? (
              <div className="mb-8">
                <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold">
                      <th className="border border-slate-300 p-2 text-center w-8">No</th>
                      <th className="border border-slate-300 p-2">Nama Siswa</th>
                      <th className="border border-slate-300 p-2">Kelas</th>
                      <th className="border border-slate-300 p-2">Jenis/Tagihan</th>
                      <th className="border border-slate-300 p-2 text-right">Target</th>
                      <th className="border border-slate-300 p-2 text-right">Terbayar Periode</th>
                      <th className="border border-slate-300 p-2 text-right">Sisa</th>
                      <th className="border border-slate-300 p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siswaRekap.length === 0 ? (
                      <tr><td colSpan={8} className="border border-slate-300 p-4 text-center text-slate-400 italic">Tidak ada data siswa pada filter ini.</td></tr>
                    ) : siswaRekap.map((s, idx) => (
                      <tr key={s.id}>
                        <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-semibold">{s.nama}</td>
                        <td className="border border-slate-300 p-2">{s.kelas}</td>
                        <td className="border border-slate-300 p-2">{s.jenis}</td>
                        <td className="border border-slate-300 p-2 text-right">{formatRupiah(s.target)}</td>
                        <td className="border border-slate-300 p-2 text-right font-semibold text-emerald-700">{formatRupiah(s.pembayaranPeriode)}</td>
                        <td className="border border-slate-300 p-2 text-right">{formatRupiah(s.sisa)}</td>
                        <td className="border border-slate-300 p-2 text-center">{s.lunas ? 'Lunas' : 'Belum Lunas'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={5} className="border border-slate-300 p-2 text-right uppercase">Total Pembayaran Periode:</td>
                      <td className="border border-slate-300 p-2 text-right text-emerald-700">{formatRupiah(totalRekapSiswa)}</td>
                      <td colSpan={2} className="border border-slate-300 p-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
            <table className="w-full text-left border-collapse border border-slate-300 text-[11px] mb-8">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold">
                  <th className="border border-slate-300 p-2 text-center w-8">No</th>
                  <th className="border border-slate-300 p-2">Tanggal</th>
                  <th className="border border-slate-300 p-2">No. Bukti</th>
                  <th className="border border-slate-300 p-2">Keterangan</th>
                  <th className="border border-slate-300 p-2 text-right">Pemasukan (Rp)</th>
                  <th className="border border-slate-300 p-2 text-right">Pengeluaran (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {txDalamPeriode.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-slate-300 p-4 text-center text-slate-400 italic">
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  txDalamPeriode.map((tx, idx) => (
                    <tr key={tx.id}>
                      <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-mono">{tx.tanggal}</td>
                      <td className="border border-slate-300 p-2 font-mono">{tx.noBukti || tx.id}</td>
                      <td className="border border-slate-300 p-2">{tx.keterangan}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono">
                        {tx.type === 'IN' ? formatRupiah(tx.nominal) : '-'}
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-mono">
                        {tx.type === 'OUT' ? formatRupiah(tx.nominal) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-slate-900">
                  <td colSpan={4} className="border border-slate-300 p-2 text-right uppercase">Total Periode Ini:</td>
                  <td className="border border-slate-300 p-2 text-right text-emerald-700">{formatRupiah(totalIn)}</td>
                  <td className="border border-slate-300 p-2 text-right text-rose-700">{formatRupiah(totalOut)}</td>
                </tr>
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td colSpan={4} className="border border-slate-300 p-2 text-right uppercase">Saldo Kas Akhir Periode:</td>
                  <td colSpan={2} className="border border-slate-300 p-2 text-center text-blue-700 font-mono text-xs">
                    {formatRupiah(finalBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
            )}
          </div>

          {/* Formal Signature Block */}
          <div className="mt-12 pt-6">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <p className="text-slate-600">Mengetahui,</p>
                <p className="font-bold text-slate-900 mb-16">Kepala Sekolah {currentLembaga}</p>
                <p className="font-bold text-slate-900 underline">H. Fahru Rozi Ramdhan S.S., M.Pd</p>
                <p className="text-[10px] text-slate-500">NIP. .........................................</p>
              </div>
              <div>
                <p className="text-slate-600">Cianjur, {reportMonth}</p>
                <p className="font-bold text-slate-900 mb-16">Bendahara Sekolah</p>
                <p className="font-bold text-slate-900 underline">Rizki Mulyana, S.Pd</p>
                <p className="text-[10px] text-slate-500">NIP. .........................................</p>
              </div>
            </div>
            <div className="mt-8 text-[9px] text-slate-400 text-center border-t border-slate-100 pt-2 font-mono">
              Dokumen ini dicetak secara otomatis dari Portal Bendahara SMP Tungturunan • Yang Terintegrasi
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
