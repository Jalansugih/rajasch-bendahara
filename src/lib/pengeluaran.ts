import { getSupabaseClient } from './supabase';
import { Pengeluaran } from '../types';

/**
 * src/lib/pengeluaran.ts
 * Poin 13 panduan: RPC catat_pengeluaran() dipertahankan (validasi saldo
 * server-side), tapi TIDAK LAGI mengirim ID buatan frontend -- server yang
 * membuat ID (UUID default pada tabel pengeluaran).
 */

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

export async function rpcCatatPengeluaran(item: {
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
      p_status: item.status || 'Terbayar'
    });

    if (error) {
      return { success: false, message: error.message || 'Gagal mengeksekusi RPC catat_pengeluaran()' };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, message: err.message || 'Kesalahan koneksi RPC' };
  }
}

export async function deletePengeluaranSupabase(id: string): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase belum terhubung.' };
  const { error } = await client.from('pengeluaran').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true };
}
