import React, { useState } from 'react';
import { 
  Building, Users, Vault, Tags, Wand2, ShieldAlert, 
  RefreshCw, Trash2, Plus, Eye, Wallet, Save, RotateCcw
} from 'lucide-react';
import { MasterSumberDana, AuditLog } from '../types';

interface PengaturanViewProps {
  currentLembaga: string;
  jenisLembaga: string;
  logoDataUrl: string | null;
  masterKelas: string[];
  masterSumberDana: MasterSumberDana[];
  masterKategoriPengeluaran: string[];
  auditLogs: AuditLog[];
  saldoAwal: number;
  onUpdateLembaga: (nama: string, jenis: string) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  onOpenWizard: () => void;
  onAddMasterKelas: () => void;
  onRemoveMasterKelas: (k: string) => void;
  onAddMasterSumber: () => void;
  onRemoveMasterSumber: (id: string) => void;
  onAddMasterKategori: () => void;
  onRemoveMasterKategori: (k: string) => void;
  onRefreshAuditLogs: () => void;
  onUpdateSaldoAwal: (nominal: number) => void;
  onResetAllData: () => void;
  showToast: (msg: string) => void;
}

export const PengaturanView: React.FC<PengaturanViewProps> = ({
  currentLembaga,
  jenisLembaga,
  logoDataUrl,
  masterKelas,
  masterSumberDana,
  masterKategoriPengeluaran,
  auditLogs,
  saldoAwal,
  onUpdateLembaga,
  onLogoUpload,
  onRemoveLogo,
  onOpenWizard,
  onAddMasterKelas,
  onRemoveMasterKelas,
  onAddMasterSumber,
  onRemoveMasterSumber,
  onAddMasterKategori,
  onRemoveMasterKategori,
  onRefreshAuditLogs,
  onUpdateSaldoAwal,
  onResetAllData,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'master' | 'audit'>('master');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [inputKasAwal, setInputKasAwal] = useState<string>(saldoAwal.toString());
  const [namaLembagaInput, setNamaLembagaInput] = useState<string>(currentLembaga);
  const [jenisLembagaInput, setJenisLembagaInput] = useState<string>(jenisLembaga);
  const [isWizardModalOpen, setIsWizardModalOpen] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);

  const handleSaveProfil = () => {
    if (!namaLembagaInput.trim()) {
      showToast('Nama Lembaga tidak boleh kosong');
      return;
    }
    onUpdateLembaga(namaLembagaInput.trim(), jenisLembagaInput);
    showToast('Profil & Identitas Lembaga berhasil disimpan!');
  };

  const handleSaveKasAwal = () => {
    const val = Number(inputKasAwal);
    if (isNaN(val) || val < 0) {
      showToast('Nominal Kas Awal tidak valid');
      return;
    }
    onUpdateSaldoAwal(val);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan & Audit Database</h1>
          <p className="text-xs text-slate-500">Profil lembaga, master data, dan Riwayat Audit Log</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setIsWizardModalOpen(true);
              onOpenWizard();
            }} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[14px] text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Setup Wizard</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('master')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'master' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Master Data & Profil</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('audit'); onRefreshAuditLogs(); }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'audit' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>Riwayat Audit Log</span>
          <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MASTER DATA & PROFIL */}
      {activeSubTab === 'master' && (
        <div className="bg-white rounded-[14px] border border-slate-200/90 shadow-sm p-6 space-y-8">
          {/* Institution Profile */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" /> Profil & Identitas Lembaga
              </h3>
              <button
                type="button"
                onClick={handleSaveProfil}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[14px] text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Profil Lembaga</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Lembaga</label>
                <select 
                  value={jenisLembagaInput}
                  onChange={(e) => setJenisLembagaInput(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-[14px] px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="SD">Sekolah Dasar (SD)</option>
                  <option value="SMP">Sekolah Menengah Pertama (SMP)</option>
                  <option value="SMA">Sekolah Menengah Atas (SMA)</option>
                  <option value="SMK">Sekolah Menengah Kejuruan (SMK)</option>
                  <option value="Pesantren">Pondok Pesantren</option>
                  <option value="Yayasan">Yayasan</option>
                  <option value="Kampus">Perguruan Tinggi / Kampus</option>
                  <option value="Ormas">Organisasi Masyarakat (Ormas)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lembaga</label>
                <input 
                  type="text" 
                  value={namaLembagaInput} 
                  onChange={(e) => setNamaLembagaInput(e.target.value)}
                  placeholder="Ketik Nama Sekolah / Lembaga..."
                  className="w-full bg-white border border-slate-200 rounded-[14px] px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tahun Ajaran Aktif</label>
                <input 
                  type="text" 
                  value="2025/2026" 
                  readOnly 
                  className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-3 py-2 text-xs font-medium text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="mt-4 flex items-center gap-4">
              <label className="w-16 h-16 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-300 font-bold text-slate-400 text-[10px] overflow-hidden cursor-pointer hover:border-blue-400 transition-all relative" title="Klik untuk mengganti logo">
                {logoDataUrl ? (
                  <img src={logoDataUrl} className="w-full h-full object-contain p-1" alt="Logo" />
                ) : (
                  <span>LOGO</span>
                )}
                <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
              </label>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Logo Lembaga</label>
                <p className="text-[11px] text-slate-500 mb-1.5">Klik kotak logo untuk mengunggah. Gambar otomatis disesuaikan ke ukuran tetap 64×64px.</p>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[14px] text-[11px] font-semibold transition-all cursor-pointer">
                    Ganti Logo
                    <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
                  </label>
                  {logoDataUrl && (
                    <button 
                      type="button" 
                      onClick={onRemoveLogo} 
                      className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-[14px] text-[11px] font-semibold transition-all"
                    >
                      Hapus Logo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Saldo Kas Awal & Reset Data Dashboard */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" /> Saldo Kas Awal & Reset Data
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box Pengisian Kas Awal */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-[14px] space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Saldo Kas Awal Lembaga
                  </h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Isi nominal Saldo Kas Awal yang menjadi saldo acuan utama perhitungan di Dashboard.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">Rp</span>
                    <input 
                      type="number"
                      value={inputKasAwal}
                      onChange={(e) => setInputKasAwal(e.target.value)}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-300 rounded-[12px] text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <button
                    onClick={handleSaveKasAwal}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[12px] text-xs font-semibold transition-all shrink-0 flex items-center gap-1 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Isi Kas Awal</span>
                  </button>
                </div>
              </div>

              {/* Box Reset Data Transaksi & Dashboard */}
              <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-[14px] space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" /> Reset Data & Kosongkan Dashboard
                  </h4>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    Mengosongkan/menghapus seluruh data pemasukan, pengeluaran, dan tagihan agar angka di Dashboard kembali ke angka 0.
                  </p>
                </div>
                <div>
                  <button
                    onClick={onResetAllData}
                    className="w-full py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-[12px] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Semua Angka & Data Transaksi</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Master Kelas */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Master Kelas & Rombel
              </h3>
              <button 
                onClick={onAddMasterKelas} 
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Kelas
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {masterKelas.map(k => (
                <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded-[14px]">
                  {k}
                  <button onClick={() => onRemoveMasterKelas(k)} className="text-slate-400 hover:text-rose-600">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Master Sumber Dana */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Vault className="w-4 h-4 text-blue-600" /> Master Sumber Dana (Pemasukan)
              </h3>
              <button 
                onClick={onAddMasterSumber} 
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Sumber Dana
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {masterSumberDana.map(s => (
                <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-[14px] text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-900">{s.name}</span>
                    <button onClick={() => onRemoveMasterSumber(s.id)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.subs.map(sub => (
                      <span key={sub} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] rounded">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Master Kategori Pengeluaran */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tags className="w-4 h-4 text-blue-600" /> Master Kategori Pengeluaran
              </h3>
              <button 
                onClick={onAddMasterKategori} 
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Kategori
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {masterKategoriPengeluaran.map(k => (
                <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 text-xs font-semibold rounded-[14px]">
                  {k}
                  <button onClick={() => onRemoveMasterKategori(k)} className="text-rose-400 hover:text-rose-800">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG (ITEM 7 REQUIREMENT) */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-[14px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-900">
                <strong>Postgres Trigger Audit Log:</strong> Setiap aksi <code>INSERT</code>, <code>UPDATE</code>, atau <code>DELETE</code> pada tabel <code>pemasukan</code> &amp; <code>pengeluaran</code> dicatat secara otomatis oleh trigger database tanpa perantara kode frontend.
              </p>
            </div>
            <button 
              onClick={onRefreshAuditLogs} 
              className="px-3 py-1.5 bg-white border border-amber-300 rounded-[14px] text-xs font-semibold text-amber-800 hover:bg-amber-100 flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="bg-white rounded-[14px] border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Waktu</th>
                    <th className="p-3.5">Aksi</th>
                    <th className="p-3.5">Tabel Terkait</th>
                    <th className="p-3.5">Record ID</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5 text-center">Detail JSON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-sans">
                        Belum ada riwayat audit log tercatat.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-slate-500">
                          {new Date(log.waktu).toLocaleString('id-ID')}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            log.aksi === 'INSERT' ? 'bg-emerald-100 text-emerald-800' :
                            log.aksi === 'UPDATE' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {log.aksi}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">{log.tabel_terkait}</td>
                        <td className="p-3.5 text-slate-600">{log.record_id}</td>
                        <td className="p-3.5 text-slate-500">{log.user_id}</td>
                        <td className="p-3.5 text-center font-sans">
                          <button 
                            onClick={() => setSelectedAuditLog(log)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold flex items-center gap-1 mx-auto"
                          >
                            <Eye className="w-3 h-3" /> Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG JSON INSPECTOR MODAL */}
      {selectedAuditLog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] max-w-lg w-full shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Detail Audit Log Inspector</h3>
              <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-500">Aksi &amp; Tabel:</span>
                <span className="ml-2 font-mono font-bold text-blue-600">{selectedAuditLog.aksi} on {selectedAuditLog.tabel_terkait}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">Record ID:</span>
                <span className="ml-2 font-mono text-slate-800">{selectedAuditLog.record_id}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">Data Sebelum (OLD):</span>
                <pre className="bg-slate-100 p-2.5 rounded font-mono text-[10px] mt-1 max-h-28 overflow-y-auto">
                  {JSON.stringify(selectedAuditLog.data_sebelum, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-bold text-slate-500">Data Sesudah (NEW):</span>
                <pre className="bg-slate-100 p-2.5 rounded font-mono text-[10px] mt-1 max-h-28 overflow-y-auto">
                  {JSON.stringify(selectedAuditLog.data_sesudah, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t text-right">
              <button onClick={() => setSelectedAuditLog(null)} className="px-4 py-2 bg-slate-800 text-white rounded-[14px] text-xs font-semibold">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* SETUP WIZARD MODAL */}
      {isWizardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-150">
            <div className="p-5 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wand2 className="w-5 h-5 text-blue-200" />
                <div>
                  <h3 className="font-bold text-sm">Setup Wizard Panduan Lembaga</h3>
                  <p className="text-[11px] text-blue-100">Langkah {wizardStep} dari 3: Konfigurasi Instan</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWizardModalOpen(false)} 
                className="text-blue-100 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {wizardStep === 1 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">Langkah 1: Profil &amp; Nama Lembaga</h4>
                  <p className="text-slate-500 text-[11px]">Tentukan nama unit/sekolah dan jenis tingkatannya:</p>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jenis Lembaga</label>
                    <select
                      value={jenisLembagaInput}
                      onChange={(e) => setJenisLembagaInput(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-[12px] font-medium"
                    >
                      <option value="SD">Sekolah Dasar (SD)</option>
                      <option value="SMP">Sekolah Menengah Pertama (SMP)</option>
                      <option value="SMA">Sekolah Menengah Atas (SMA)</option>
                      <option value="SMK">Sekolah Menengah Kejuruan (SMK)</option>
                      <option value="Pesantren">Pondok Pesantren</option>
                      <option value="Yayasan">Yayasan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lembaga</label>
                    <input
                      type="text"
                      value={namaLembagaInput}
                      onChange={(e) => setNamaLembagaInput(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-[12px] font-semibold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">Langkah 2: Saldo Kas Awal Periode</h4>
                  <p className="text-slate-500 text-[11px]">Masukkan posisi kas fisik awal lembaga Anda saat ini:</p>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Saldo Kas Awal (Rp)</label>
                    <input
                      type="number"
                      value={inputKasAwal}
                      onChange={(e) => setInputKasAwal(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-[12px] font-bold text-sm text-slate-900"
                    />
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-3 text-center py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center font-bold text-lg">
                    ✓
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Setup Selesai!</h4>
                  <p className="text-slate-600 text-xs">
                    Pengaturan untuk <strong className="text-slate-900">{namaLembagaInput} ({jenisLembagaInput})</strong> dengan Kas Awal <strong>Rp {Number(inputKasAwal).toLocaleString('id-ID')}</strong> siap disimpan.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {wizardStep > 1 ? (
                <button
                  onClick={() => setWizardStep(prev => prev - 1)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-[12px] font-semibold text-xs"
                >
                  Kembali
                </button>
              ) : <div />}

              {wizardStep < 3 ? (
                <button
                  onClick={() => setWizardStep(prev => prev + 1)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[12px] font-semibold text-xs"
                >
                  Lanjut
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleSaveProfil();
                    handleSaveKasAwal();
                    setIsWizardModalOpen(false);
                    setWizardStep(1);
                    showToast('Setup Wizard berhasil diselesaikan!');
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[12px] font-semibold text-xs shadow-sm"
                >
                  Simpan &amp; Terapkan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
