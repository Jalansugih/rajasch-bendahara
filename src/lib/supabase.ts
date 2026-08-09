import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { Pemasukan, Pengeluaran, SiswaTagihan, AuditLog, SupabaseConfig } from '../types';

const STORAGE_KEY_URL = 'rajasch_supabase_url';
const STORAGE_KEY_KEY = 'rajasch_supabase_anon_key';

// PRIORITAS KREDENSIAL: environment variable (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// yang diset di server deploy (Vercel/Netlify/dst) SELALU didahulukan. localStorage hanya
// dipakai sebagai jalan pintas saat development lokal lewat modal "Pengaturan Supabase".
// Ini penting supaya saat sudah production, konfigurasi tidak bisa "ketiban" nilai lama
// yang kebetulan tersimpan di browser seseorang.
export function getSavedSupabaseCredentials(): { url: string; key: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = envUrl || localStorage.getItem(STORAGE_KEY_URL) || '';
  const localKey = envKey || localStorage.getItem(STORAGE_KEY_KEY) || '';

  const finalUrl = localUrl || 'https://xyzcompany.supabase.co';
  const finalKey = localKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_demo';

  // DEBUG: bantu diagnosa masalah konfigurasi tanpa membocorkan key penuh di console.
  // Boleh dihapus nanti setelah koneksi Supabase stabil.
  console.log('[Supabase Debug] Sumber URL:', envUrl ? 'ENV VAR' : (localStorage.getItem(STORAGE_KEY_URL) ? 'localStorage' : 'DUMMY/placeholder'));
  console.log('[Supabase Debug] URL dipakai:', finalUrl);
  console.log('[Supabase Debug] Sumber Key:', envKey ? 'ENV VAR' : (localStorage.getItem(STORAGE_KEY_KEY) ? 'localStorage' : 'DUMMY/placeholder'));
  console.log('[Supabase Debug] Key dipakai (masked):', finalKey ? `${finalKey.slice(0, 8)}...${finalKey.slice(-4)} (panjang: ${finalKey.length})` : '(KOSONG)');

  return { url: finalUrl, key: finalKey };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSavedSupabaseCredentials();
  if (!url || !key || url.includes('xyzcompany.supabase.co')) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key);
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
}

export function resetSupabaseClient(url: string, key: string) {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
  if (url && key) {
    try {
      supabaseInstance = createClient(url, key);
    } catch (err) {
      supabaseInstance = null;
    }
  } else {
    supabaseInstance = null;
  }
}

export async function testSupabaseConnection(urlInput?: string, keyInput?: string): Promise<{ success: boolean; message: string }> {
  const creds = getSavedSupabaseCredentials();
  const url = urlInput || creds.url;
  const key = keyInput || creds.key;

  if (!url || !key || url.includes('xyzcompany')) {
    return { success: false, message: 'Kredensial Supabase belum diatur. Sediakan URL & Anon Key valid.' };
  }

  try {
    const testClient = createClient(url, key);
    const { data, error } = await testClient.from('pemasukan').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "pemasukan" does not exist')) {
        return { success: false, message: 'Koneksi Berhasil, tetapi tabel "pemasukan" belum dibuat! Silakan jalankan SQL Script Migration.' };
      }
      return { success: false, message: `Error Supabase: ${error.message}` };
    }
    return { success: true, message: 'Koneksi Supabase Aktif & Terverifikasi!' };
  } catch (err: any) {
    return { success: false, message: `Gagal terkoneksi: ${err.message || 'Error jaringan'}` };
  }
}

// =========================================================================
// DATA SYNC WITH SUPABASE
// =========================================================================

export async function fetchPemasukanFromSupabase(): Promise<Pemasukan[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('pemasukan')
      .select('*')
      .order('tanggal', { ascending: false });

    if (error || !data) return null;
    return data.map((item: any) => ({
      id: item.id,
      noBukti: item.no_bukti || item.id,
      tanggal: item.tanggal,
      sumber: item.sumber,
      sub: item.sub,
      nominal: Number(item.nominal),
      keterangan: item.keterangan,
      status: item.status || 'Selesai',
      siswaId: item.siswa_id || undefined,
      createdAt: item.created_at,
      createdBy: item.created_by
    }));
  } catch {
    return null;
  }
}

export async function fetchPengeluaranFromSupabase(): Promise<Pengeluaran[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('pengeluaran')
      .select('*')
      .order('tanggal', { ascending: false });

    if (error || !data) return null;
    return data.map((item: any) => ({
      id: item.id,
      noBukti: item.no_bukti || item.id,
      tanggal: item.tanggal,
      kategori: item.kategori,
      nominal: Number(item.nominal),
      keterangan: item.keterangan,
      status: item.status || 'Terbayar',
      createdAt: item.created_at,
      createdBy: item.created_by
    }));
  } catch {
    return null;
  }
}

export async function fetchSiswaTagihanFromSupabase(): Promise<SiswaTagihan[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('siswa_tagihan')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;
    return data.map((item: any) => ({
      id: item.id,
      nama: item.nama,
      kelas: item.kelas,
      jenis: item.jenis,
      target: Number(item.target),
      catatan: item.catatan || '',
      createdAt: item.created_at,
      createdBy: item.created_by
    }));
  } catch {
    return null;
  }
}

export async function fetchAuditLogsFromSupabase(): Promise<AuditLog[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('audit_log')
      .select('*')
      .order('waktu', { ascending: false })
      .limit(50);

    if (error || !data) return null;
    return data as AuditLog[];
  } catch {
    return null;
  }
}

/**
 * RPC Function: catat_pengeluaran()
 * Calls Supabase RPC function which validates cash balance on the server side
 * and inserts expenditure atomically.
 */
export async function rpcCatatPengeluaran(item: {
  id?: string;
  noBukti: string;
  tanggal: string;
  kategori: string;
  nominal: number;
  keterangan: string;
  status?: string;
}): Promise<{ success: boolean; data?: any; message?: string }> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      success: false,
      message: 'Supabase client belum dikonfigurasi. Menggunakan mode simulasi lokal.'
    };
  }

  try {
    const { data, error } = await client.rpc('catat_pengeluaran', {
      p_no_bukti: item.noBukti,
      p_tanggal: item.tanggal,
      p_kategori: item.kategori,
      p_nominal: item.nominal,
      p_keterangan: item.keterangan,
      p_status: item.status || 'Terbayar',
      p_id: item.id || null
    });

    if (error) {
      return {
        success: false,
        message: error.message || 'Gagal mengeksekusi RPC catat_pengeluaran()'
      };
    }

    return {
      success: true,
      data
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Kesalahan koneksi RPC'
    };
  }
}

export async function insertPemasukanSupabase(item: Pemasukan): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase not connected' };

  try {
    const { error } = await client.from('pemasukan').insert([{
      id: item.id,
      no_bukti: item.noBukti,
      tanggal: item.tanggal,
      sumber: item.sumber,
      sub: item.sub,
      nominal: item.nominal,
      keterangan: item.keterangan,
      status: item.status,
      siswa_id: item.siswaId || null
    }]);

    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function deletePemasukanSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('pemasukan').delete().eq('id', id);
  return !error;
}

export async function deletePengeluaranSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('pengeluaran').delete().eq('id', id);
  return !error;
}

// =========================================================================
// AUTH SESSION HELPERS
// =========================================================================

/** Ambil sesi login saat ini dari Supabase (null jika belum login / belum terhubung). */
export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) return null;
  return data.session;
}

/** Daftarkan listener perubahan status login (login/logout/token refresh). */
export function onAuthStateChange(callback: (session: Session | null) => void) {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

/** Login dengan email & password. TIDAK ada fallback sesi palsu -- jika gagal, gagal. */
export async function signInWithPassword(email: string, password: string): Promise<{ success: boolean; session?: Session; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase belum dikonfigurasi. Hubungi admin untuk mengatur koneksi database.' };
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return { success: false, message: error?.message || 'Email atau kata sandi salah.' };
  }
  return { success: true, session: data.session };
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}
