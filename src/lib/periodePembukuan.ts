import { getSupabaseClient } from './supabase';
import { PeriodePembukuan } from '../types';

const LOCAL_KEY = 'rajasch_periode_pembukuan_v2';

const mapRow = (row: any): PeriodePembukuan => ({
  id: row.id,
  namaPeriode: row.nama_periode,
  tahunAjaran: row.tahun_ajaran || row.nama_periode || '2025/2026',
  tanggalMulai: row.tanggal_mulai,
  tanggalAkhir: row.tanggal_akhir || null,
  saldoAwal: Number(row.saldo_awal || 0),
  saldoAkhir: row.saldo_akhir == null ? null : Number(row.saldo_akhir),
  status: row.status,
  createdAt: row.created_at,
  closedAt: row.closed_at || undefined
});

export function getLocalPeriodePembukuan(): PeriodePembukuan[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}

function saveLocal(items: PeriodePembukuan[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

export async function fetchPeriodePembukuan(): Promise<PeriodePembukuan[]> {
  const client = getSupabaseClient();
  if (!client) return getLocalPeriodePembukuan();
  const { data, error } = await client
    .from('periode_pembukuan')
    .select('*')
    .order('tanggal_mulai', { ascending: false });
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function ensurePeriodeAktif(tahunAjaran: string, saldoAwal: number): Promise<{ success: boolean; data?: PeriodePembukuan; message?: string }> {
  const existing = await fetchPeriodePembukuan();
  const active = existing.find(x => x.status === 'AKTIF');
  if (active) return { success: true, data: active };

  const client = getSupabaseClient();
  const item: PeriodePembukuan = {
    id: `PER-${Date.now()}`,
    namaPeriode: tahunAjaran,
    tahunAjaran,
    tanggalMulai: '1900-01-01',
    tanggalAkhir: null,
    saldoAwal,
    saldoAkhir: null,
    status: 'AKTIF',
    createdAt: new Date().toISOString()
  };

  if (!client) {
    saveLocal([item, ...existing]);
    return { success: true, data: item };
  }

  const { data, error } = await client.from('periode_pembukuan').insert({
    nama_periode: tahunAjaran,
    tahun_ajaran: tahunAjaran,
    tanggal_mulai: item.tanggalMulai,
    tanggal_akhir: null,
    saldo_awal: saldoAwal,
    status: 'AKTIF'
  }).select().single();

  if (error || !data) return { success: false, message: error?.message || 'Gagal membuat periode aktif.' };
  return { success: true, data: mapRow(data) };
}

/**
 * Cut-Off dihitung di database, bukan dari angka Dashboard/frontend.
 * RPC mengunci baris periode selama proses agar saldo akhir konsisten.
 */

export async function updateTahunAjaranPeriodeAktif(tahunAjaran: string): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    const items = getLocalPeriodePembukuan();
    const idx = items.findIndex(x => x.status === 'AKTIF');
    if (idx < 0) return { success: false, message: 'Periode aktif tidak ditemukan.' };
    items[idx] = { ...items[idx], namaPeriode: tahunAjaran, tahunAjaran };
    saveLocal(items);
    return { success: true };
  }
  const { error } = await client
    .from('periode_pembukuan')
    .update({ nama_periode: tahunAjaran, tahun_ajaran: tahunAjaran })
    .eq('status', 'AKTIF');
  if (error) return { success: false, message: error.message };
  return { success: true };
}

export async function hitungSaldoAkhirPeriode(id: string): Promise<{ success: boolean; saldoAkhir?: number; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    const periode = getLocalPeriodePembukuan().find(x => x.id === id);
    if (!periode) return { success: false, message: 'Periode tidak ditemukan.' };
    return { success: true, saldoAkhir: periode.saldoAwal };
  }
  const { data, error } = await client.rpc('hitung_saldo_akhir_periode', { p_periode_id: id });
  if (error) return { success: false, message: error.message };
  return { success: true, saldoAkhir: Number(data || 0) };
}

export async function tutupBuku(id: string, tahunAjaranBerikutnya: string, localSaldoAkhir?: number): Promise<{ success: boolean; saldoAkhir?: number; periodeBerikutnya?: PeriodePembukuan; message?: string }> {
  const client = getSupabaseClient();

  if (!client) {
    const items = getLocalPeriodePembukuan();
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return { success: false, message: 'Periode tidak ditemukan.' };
    if (items[idx].status !== 'AKTIF') return { success: false, message: 'Periode sudah ditutup.' };

    const periode = items[idx];
    const saldoAkhir = localSaldoAkhir ?? periode.saldoAwal;
    const next: PeriodePembukuan = {
      id: `PER-${Date.now()}`,
      namaPeriode: tahunAjaranBerikutnya,
      tahunAjaran: tahunAjaranBerikutnya,
      tanggalMulai: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      tanggalAkhir: null,
      saldoAwal: saldoAkhir,
      saldoAkhir: null,
      status: 'AKTIF',
      createdAt: new Date().toISOString()
    };
    items[idx] = { ...periode, status: 'DITUTUP', saldoAkhir, tanggalAkhir: new Date().toISOString().slice(0, 10), closedAt: new Date().toISOString() };
    saveLocal([next, ...items]);
    return { success: true, saldoAkhir, periodeBerikutnya: next };
  }

  const { data, error } = await client.rpc('tutup_buku', {
    p_periode_id: id,
    p_tahun_ajaran_berikutnya: tahunAjaranBerikutnya
  });
  if (error) return { success: false, message: error.message };

  return {
    success: true,
    saldoAkhir: Number(data?.saldo_akhir || 0),
    periodeBerikutnya: data?.periode_berikutnya ? mapRow(data.periode_berikutnya) : undefined
  };
}

export async function bukaKembaliBuku(id: string): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    const items = getLocalPeriodePembukuan();
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return { success: false, message: 'Periode tidak ditemukan.' };
    items[idx] = { ...items[idx], status: 'AKTIF', tanggalAkhir: null, saldoAkhir: null, closedAt: undefined };
    saveLocal(items.filter((x, i) => i === idx || x.status !== 'AKTIF'));
    return { success: true };
  }

  const { error } = await client.rpc('buka_kembali_buku', { p_periode_id: id });
  if (error) return { success: false, message: error.message };
  return { success: true };
}
