import React, { useState, useEffect } from 'react';
import { 
  Pemasukan, Pengeluaran, SiswaTagihan, MasterSumberDana, 
  AuditLog, UserSession 
} from './types';

import { 
  INITIAL_MASTER_KELAS, INITIAL_MASTER_SUMBER, INITIAL_MASTER_KATEGORI, 
  INITIAL_PEMASUKAN, INITIAL_PENGELUARAN, INITIAL_SISWA_TAGIHAN, INITIAL_AUDIT_LOGS 
} from './data/initialData';

import { 
  getSupabaseClient, testSupabaseConnection, 
  fetchPemasukanFromSupabase, fetchPengeluaranFromSupabase, 
  fetchSiswaTagihanFromSupabase, fetchAuditLogsFromSupabase, 
  rpcCatatPengeluaran, insertPemasukanSupabase, 
  deletePemasukanSupabase, deletePengeluaranSupabase,
  getCurrentSession, onAuthStateChange, signOutSupabase
} from './lib/supabase';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { PemasukanView } from './components/PemasukanView';
import { PengeluaranView } from './components/PengeluaranView';
import { SiswaView } from './components/SiswaView';
import { LaporanView } from './components/LaporanView';
import { PengaturanView } from './components/PengaturanView';
import { AuthModal } from './components/AuthModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { 
  ModalPemasukan, ModalPengeluaran, 
  ModalSiswaTagihanPropsModal, ModalSiswaBayarPropsModal, 
  ModalBlueprint 
} from './components/Modals';

export default function App() {
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOpenMobileSidebar, setIsOpenMobileSidebar] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Institution Context
  const [currentLembaga, setCurrentLembaga] = useState('SD Negeri 1 Merdeka');
  const [jenisLembaga, setJenisLembaga] = useState('SD');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  // App Master Data & Local Store
  const [masterKelas, setMasterKelas] = useState<string[]>(INITIAL_MASTER_KELAS);
  const [masterSumberDana, setMasterSumberDana] = useState<MasterSumberDana[]>(INITIAL_MASTER_SUMBER);
  const [masterKategoriPengeluaran, setMasterKategoriPengeluaran] = useState<string[]>(INITIAL_MASTER_KATEGORI);

  const [pemasukanList, setPemasukanList] = useState<Pemasukan[]>(INITIAL_PEMASUKAN);
  const [pengeluaranList, setPengeluaranList] = useState<Pengeluaran[]>(INITIAL_PENGELUARAN);
  const [siswaTagihanList, setSiswaTagihanList] = useState<SiswaTagihan[]>(INITIAL_SISWA_TAGIHAN);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // Auth & Supabase Status
  // PENTING: tidak ada lagi sesi default otomatis. Sebelumnya app langsung
  // "login" sebagai Bendahara Utama tanpa autentikasi apa pun -- ini sudah
  // diperbaiki. Sesi hanya terisi setelah login sungguhan (mode Supabase)
  // atau otomatis di mode Demo lokal (yang ditandai jelas di UI).
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isConnectedToSupabase, setIsConnectedToSupabase] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Modals visibility
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isPemasukanModalOpen, setIsPemasukanModalOpen] = useState(false);
  const [isPengeluaranModalOpen, setIsPengeluaranModalOpen] = useState(false);
  const [isSiswaTagihanModalOpen, setIsSiswaTagihanModalOpen] = useState(false);
  const [isSiswaBayarModalOpen, setIsSiswaBayarModalOpen] = useState(false);
  const [selectedSiswaForBayar, setSelectedSiswaForBayar] = useState<SiswaTagihan | null>(null);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);

  const [saldoAwal, setSaldoAwal] = useState<number>(100000000); // Rp 100.000.000

  const handleUpdateSaldoAwal = (nominal: number) => {
    setSaldoAwal(nominal);
    showToast(`Kas Awal berhasil diisi: ${formatRupiah(nominal)}`);
  };

  const handleResetAllData = () => {
    if (confirm('Apakah Anda yakin ingin menghapus/mengosongkan seluruh data transaksi pemasukan, pengeluaran, dan tagihan? Semua angka di Dashboard akan direset ke 0.')) {
      setPemasukanList([]);
      setPengeluaranList([]);
      setSiswaTagihanList([]);
      setAuditLogs([]);
      showToast('Seluruh data transaksi & angka di dashboard berhasil direset!');
    }
  };

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Sync / Test Supabase on mount
  useEffect(() => {
    checkAndSyncSupabase();
    // Dengarkan perubahan status login (login/logout dari tab lain, token expired, dll)
    const unsubscribe = onAuthStateChange((session) => {
      if (session) {
        setUserSession({
          id: session.user.id,
          email: session.user.email || '',
          role: 'Bendahara Utama'
        });
      } else if (isConnectedToSupabase) {
        // Hanya paksa logout kalau memang mode Supabase (bukan demo lokal)
        setUserSession(null);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAndSyncSupabase = async () => {
    const res = await testSupabaseConnection();
    setIsConnectedToSupabase(res.success);

    if (res.success) {
      // Cek apakah sudah ada sesi login yang tersimpan (mis. refresh halaman)
      const session = await getCurrentSession();
      if (session) {
        setUserSession({
          id: session.user.id,
          email: session.user.email || '',
          role: 'Bendahara Utama'
        });
      } else {
        setUserSession(null);
        setIsAuthModalOpen(true);
      }

      // Pull real data from Supabase tables
      const inData = await fetchPemasukanFromSupabase();
      if (inData) setPemasukanList(inData);

      const outData = await fetchPengeluaranFromSupabase();
      if (outData) setPengeluaranList(outData);

      const stData = await fetchSiswaTagihanFromSupabase();
      if (stData) setSiswaTagihanList(stData);

      const logs = await fetchAuditLogsFromSupabase();
      if (logs) setAuditLogs(logs);
    } else {
      // Mode Demo Lokal: tidak ada Supabase terhubung -> tidak perlu login,
      // tapi data hanya tersimpan di browser ini (tidak permanen/tidak aman
      // untuk data keuangan sungguhan). Beri sesi demo yang jelas ditandai.
      // Alasan gagal konek ditampilkan supaya mudah didiagnosa (sebelumnya
      // gagal secara diam-diam tanpa pesan apa pun).
      console.error('[Supabase] Gagal terhubung:', res.message);
      showToast(`Supabase belum terhubung: ${res.message}`);
      setUserSession({
        id: 'demo_local',
        email: 'demo@local (mode tanpa Supabase)',
        role: 'Demo Lokal'
      });
    }
    setAuthChecked(true);
  };

  const refreshAuditLogs = async () => {
    if (isConnectedToSupabase) {
      const logs = await fetchAuditLogsFromSupabase();
      if (logs) setAuditLogs(logs);
    }
  };

  // Helper ID generator
  const generateNextId = (list: { id: string }[], prefix: string) => {
    let maxNum = 0;
    list.forEach(item => {
      const parts = String(item.id).split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const formatRupiah = (num: number) => {
    if (isNaN(num)) return 'Rp 0';
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  };

  // Handlers for Save / Delete
  const handleSavePemasukan = async (data: {
    tanggal: string;
    noBukti: string;
    sumber: string;
    sub: string;
    nominal: number;
    keterangan: string;
  }) => {
    const id = generateNextId(pemasukanList, 'IN');
    const newTx: Pemasukan = {
      id,
      noBukti: data.noBukti || id,
      tanggal: data.tanggal,
      sumber: data.sumber,
      sub: data.sub,
      nominal: data.nominal,
      keterangan: data.keterangan,
      status: 'Selesai'
    };

    setPemasukanList(prev => [newTx, ...prev]);

    if (isConnectedToSupabase) {
      const res = await insertPemasukanSupabase(newTx);
      if (!res.success) {
        showToast(`Warning Supabase: ${res.message}. Tersimpan lokal.`);
      }
      refreshAuditLogs();
    }

    showToast('Pemasukan Kas berhasil disimpan!');
  };

  const handleSavePengeluaran = async (data: {
    tanggal: string;
    noBukti: string;
    kategori: string;
    nominal: number;
    keterangan: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const id = generateNextId(pengeluaranList, 'OUT');
    const noBukti = data.noBukti || id;

    if (isConnectedToSupabase) {
      // Call Postgres RPC Function catat_pengeluaran() with server-side cash balance checks!
      const res = await rpcCatatPengeluaran({
        id,
        noBukti,
        tanggal: data.tanggal,
        kategori: data.kategori,
        nominal: data.nominal,
        keterangan: data.keterangan
      });

      if (!res.success) {
        return { success: false, message: res.message };
      }

      // Re-fetch list
      const outData = await fetchPengeluaranFromSupabase();
      if (outData) setPengeluaranList(outData);
      refreshAuditLogs();
      showToast('Pengeluaran berhasil dicatat & diverifikasi server Supabase!');
      return { success: true };
    }

    // Local validation check for cash balance if offline
    const totalInAll = pemasukanList.reduce((acc, curr) => acc + curr.nominal, 0);
    const totalOutAll = pengeluaranList.reduce((acc, curr) => acc + curr.nominal, 0);
    const currentSaldo = saldoAwal + totalInAll - totalOutAll;

    if (data.nominal > currentSaldo) {
      return {
        success: false,
        message: `VALIDASI SALDO KAS SERVER: Nominal pengeluaran (${formatRupiah(data.nominal)}) melebihi total saldo kas tersedia (${formatRupiah(currentSaldo)})!`
      };
    }

    const newTx: Pengeluaran = {
      id,
      noBukti,
      tanggal: data.tanggal,
      kategori: data.kategori,
      nominal: data.nominal,
      keterangan: data.keterangan,
      status: 'Terbayar'
    };

    setPengeluaranList(prev => [newTx, ...prev]);

    // Local audit log entry
    const localAudit: AuditLog = {
      id: String(Date.now()),
      tabel_terkait: 'pengeluaran',
      record_id: id,
      aksi: 'INSERT',
      data_sebelum: null,
      data_sesudah: newTx,
      user_id: userSession?.id || 'bendahara_main',
      waktu: new Date().toISOString()
    };
    setAuditLogs(prev => [localAudit, ...prev]);

    showToast('Pengeluaran Kas berhasil dicatat!');
    return { success: true };
  };

  const handleDeletePemasukan = async (id: string) => {
    if (!confirm('Hapus transaksi pemasukan ini?')) return;
    setPemasukanList(prev => prev.filter(x => x.id !== id));
    if (isConnectedToSupabase) {
      await deletePemasukanSupabase(id);
      refreshAuditLogs();
    }
    showToast('Transaksi pemasukan dihapus');
  };

  const handleDeletePengeluaran = async (id: string) => {
    if (!confirm('Hapus transaksi pengeluaran ini?')) return;
    setPengeluaranList(prev => prev.filter(x => x.id !== id));
    if (isConnectedToSupabase) {
      await deletePengeluaranSupabase(id);
      refreshAuditLogs();
    }
    showToast('Transaksi pengeluaran dihapus');
  };

  const handleSaveSiswaTagihan = (data: {
    nama: string;
    kelas: string;
    jenis: string;
    target: number;
    catatan?: string;
  }) => {
    const id = generateNextId(siswaTagihanList, 'ST');
    const newSiswa: SiswaTagihan = {
      id,
      nama: data.nama,
      kelas: data.kelas,
      jenis: data.jenis,
      target: data.target,
      catatan: data.catatan
    };
    setSiswaTagihanList(prev => [...prev, newSiswa]);
    showToast(`Tagihan siswa a.n ${data.nama} berhasil ditambahkan`);
  };

  const handleSaveBayarSiswa = (data: {
    siswaId: string;
    tanggal: string;
    noBukti: string;
    nominal: number;
  }) => {
    const siswa = siswaTagihanList.find(s => s.id === data.siswaId);
    if (!siswa) return;

    const idBaru = generateNextId(pemasukanList, 'IN');
    const newIn: Pemasukan = {
      id: idBaru,
      noBukti: data.noBukti || idBaru,
      tanggal: data.tanggal,
      sumber: 'Pembayaran',
      sub: siswa.jenis,
      nominal: data.nominal,
      keterangan: `Pembayaran ${siswa.jenis} a.n ${siswa.nama} (${siswa.kelas})`,
      status: 'Selesai',
      siswaId: siswa.id
    };

    setPemasukanList(prev => [newIn, ...prev]);
    showToast(`Pembayaran ${siswa.nama} sebesar ${formatRupiah(data.nominal)} berhasil dicatat!`);
  };

  const handleDeleteTagihan = (id: string) => {
    const siswa = siswaTagihanList.find(s => s.id === id);
    if (!siswa) return;
    if (!confirm(`Hapus data tagihan a.n ${siswa.nama}?`)) return;
    setSiswaTagihanList(prev => prev.filter(s => s.id !== id));
    showToast('Data tagihan dihapus');
  };

  // Logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoDataUrl(ev.target?.result as string);
      showToast('Logo lembaga diperbarui!');
    };
    reader.readAsDataURL(file);
  };

  const unreadBelumLunasCount = siswaTagihanList.filter(s => {
    const paid = pemasukanList.filter(p => p.siswaId === s.id).reduce((a, b) => a + b.nominal, 0);
    return paid < s.target;
  }).length;

  // Tunggu pengecekan sesi selesai dulu sebelum render apa pun, supaya data
  // keuangan tidak "berkedip" tampil sebelum status login diketahui.
  if (!authChecked) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAFAFC] text-slate-500 text-sm font-semibold">
        Memeriksa sesi login...
      </div>
    );
  }

  // GERBANG LOGIN: kalau terhubung ke Supabase (mode produksi sungguhan) tapi
  // belum ada sesi yang valid, jangan render app/data sama sekali -- hanya
  // tampilkan layar login. Ini menutup celah lama di mana seluruh dashboard
  // keuangan bisa diakses tanpa login sama sekali.
  if (isConnectedToSupabase && !userSession) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAFAFC]">
        <AuthModal
          isOpen={true}
          onClose={() => { /* tidak bisa ditutup tanpa login saat mode Supabase */ }}
          userSession={null}
          onLoginSuccess={(session) => {
            setUserSession(session);
            setIsAuthModalOpen(false);
          }}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden relative bg-[#FAFAFC] text-slate-800 antialiased font-sans">
      {/* Peringatan Mode Demo Lokal */}
      {!isConnectedToSupabase && (
        <div className="fixed top-0 inset-x-0 z-40 bg-amber-500 text-white text-[11px] font-semibold text-center py-1">
          Mode Demo Lokal -- belum terhubung ke Supabase. Data hanya tersimpan sementara di browser ini, tidak aman untuk data keuangan sungguhan.
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-[14px] shadow-2xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-200 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
        pemasukanCount={pemasukanList.length}
        pengeluaranCount={pengeluaranList.length}
        siswaBelumLunasCount={unreadBelumLunasCount}
        isOpenMobile={isOpenMobileSidebar}
        onCloseMobile={() => setIsOpenMobileSidebar(false)}
        onOpenBlueprint={() => setIsBlueprintModalOpen(true)}
      />

      {/* Main Area */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${!isConnectedToSupabase ? 'pt-5' : ''}`}>
        {/* Top Navbar */}
        <Navbar 
          currentLembaga={currentLembaga}
          onSelectLembaga={(nama, jenis) => {
            setCurrentLembaga(nama);
            setJenisLembaga(jenis);
            showToast(`Lembaga dialihkan ke ${nama}`);
          }}
          onOpenPemasukanModal={() => setIsPemasukanModalOpen(true)}
          onOpenPengeluaranModal={() => setIsPengeluaranModalOpen(true)}
          onSwitchTab={setActiveTab}
          onToggleSidebar={() => setIsOpenMobileSidebar(!isOpenMobileSidebar)}
          userSession={userSession}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onSignOut={async () => {
            if (isConnectedToSupabase) {
              await signOutSupabase();
            }
            setUserSession(null);
            if (isConnectedToSupabase) setIsAuthModalOpen(true);
            showToast('Sesi pengguna telah keluar');
          }}
        />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <DashboardView 
              pemasukanList={pemasukanList}
              pengeluaranList={pengeluaranList}
              masterSumberDana={masterSumberDana}
              saldoAwal={saldoAwal}
              formatRupiah={formatRupiah}
              onSwitchTab={setActiveTab}
            />
          )}

          {activeTab === 'pemasukan' && (
            <PemasukanView 
              pemasukanList={pemasukanList}
              masterSumberDana={masterSumberDana}
              onOpenModal={() => setIsPemasukanModalOpen(true)}
              onDeletePemasukan={handleDeletePemasukan}
              formatRupiah={formatRupiah}
              onSwitchTab={setActiveTab}
            />
          )}

          {activeTab === 'pengeluaran' && (
            <PengeluaranView 
              pengeluaranList={pengeluaranList}
              masterKategoriPengeluaran={masterKategoriPengeluaran}
              onOpenModal={() => setIsPengeluaranModalOpen(true)}
              onDeletePengeluaran={handleDeletePengeluaran}
              formatRupiah={formatRupiah}
            />
          )}

          {activeTab === 'siswa' && (
            <SiswaView 
              siswaTagihanList={siswaTagihanList}
              pemasukanList={pemasukanList}
              masterKelas={masterKelas}
              onOpenModalTambahTagihan={() => setIsSiswaTagihanModalOpen(true)}
              onOpenModalBayar={(siswaId) => {
                const s = siswaTagihanList.find(x => x.id === siswaId);
                if (s) {
                  setSelectedSiswaForBayar(s);
                  setIsSiswaBayarModalOpen(true);
                }
              }}
              onOpenRiwayat={(siswaId) => {
                const s = siswaTagihanList.find(x => x.id === siswaId);
                if (s) {
                  showToast(`Membuka riwayat pembayaran a.n ${s.nama}`);
                }
              }}
              onDeleteTagihan={handleDeleteTagihan}
              formatRupiah={formatRupiah}
            />
          )}

          {activeTab === 'laporan' && (
            <LaporanView 
              pemasukanList={pemasukanList}
              pengeluaranList={pengeluaranList}
              currentLembaga={currentLembaga}
              logoDataUrl={logoDataUrl}
              saldoAwal={saldoAwal}
              formatRupiah={formatRupiah}
              onLogoUpload={handleLogoUpload}
            />
          )}

          {activeTab === 'pengaturan' && (
            <PengaturanView 
              currentLembaga={currentLembaga}
              jenisLembaga={jenisLembaga}
              logoDataUrl={logoDataUrl}
              masterKelas={masterKelas}
              masterSumberDana={masterSumberDana}
              masterKategoriPengeluaran={masterKategoriPengeluaran}
              auditLogs={auditLogs}
              saldoAwal={saldoAwal}
              onUpdateLembaga={(nama, jenis) => {
                setCurrentLembaga(nama);
                setJenisLembaga(jenis);
                showToast('Profil lembaga disimpan');
              }}
              onLogoUpload={handleLogoUpload}
              onRemoveLogo={() => setLogoDataUrl(null)}
              onOpenWizard={() => showToast('Menjalankan Setup Wizard...')}
              onAddMasterKelas={() => {
                const name = prompt('Nama Kelas/Rombel baru:');
                if (name) setMasterKelas(prev => [...prev, name.trim()]);
              }}
              onRemoveMasterKelas={(k) => setMasterKelas(prev => prev.filter(x => x !== k))}
              onAddMasterSumber={() => {
                const name = prompt('Nama Sumber Dana baru:');
                if (name) {
                  const id = name.replace(/[^a-zA-Z0-9]/g, '');
                  setMasterSumberDana(prev => [...prev, { id, name: name.trim(), subs: [] }]);
                }
              }}
              onRemoveMasterSumber={(id) => setMasterSumberDana(prev => prev.filter(x => x.id !== id))}
              onAddMasterKategori={() => {
                const name = prompt('Nama Kategori Pengeluaran baru:');
                if (name) setMasterKategoriPengeluaran(prev => [...prev, name.trim()]);
              }}
              onRemoveMasterKategori={(k) => setMasterKategoriPengeluaran(prev => prev.filter(x => x !== k))}
              onRefreshAuditLogs={refreshAuditLogs}
              onUpdateSaldoAwal={handleUpdateSaldoAwal}
              onResetAllData={handleResetAllData}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* MODALS */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        userSession={userSession}
        onLoginSuccess={(session) => setUserSession(session)}
        showToast={showToast}
        isDemoMode={!isConnectedToSupabase}
      />

      <SupabaseConfigModal 
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={() => checkAndSyncSupabase()}
        showToast={showToast}
      />

      <ModalPemasukan 
        isOpen={isPemasukanModalOpen}
        onClose={() => setIsPemasukanModalOpen(false)}
        masterSumberDana={masterSumberDana}
        masterKelas={masterKelas}
        onSave={handleSavePemasukan}
      />

      <ModalPengeluaran 
        isOpen={isPengeluaranModalOpen}
        onClose={() => setIsPengeluaranModalOpen(false)}
        masterKategoriPengeluaran={masterKategoriPengeluaran}
        onSave={handleSavePengeluaran}
      />

      <ModalSiswaTagihanPropsModal 
        isOpen={isSiswaTagihanModalOpen}
        onClose={() => setIsSiswaTagihanModalOpen(false)}
        masterKelas={masterKelas}
        onSave={handleSaveSiswaTagihan}
      />

      <ModalSiswaBayarPropsModal 
        isOpen={isSiswaBayarModalOpen}
        onClose={() => setIsSiswaBayarModalOpen(false)}
        siswa={selectedSiswaForBayar}
        pemasukanList={pemasukanList}
        formatRupiah={formatRupiah}
        onSave={handleSaveBayarSiswa}
      />

      <ModalBlueprint 
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
      />
    </div>
  );
}
