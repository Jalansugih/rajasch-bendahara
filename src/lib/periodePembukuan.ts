import { getSupabaseClient } from './supabase';
import { PeriodePembukuan } from '../types';

const LOCAL_KEY = 'rajasch_periode_pembukuan_v1';

const mapRow = (row: any): PeriodePembukuan => ({
  id: row.id,
  namaPeriode: row.nama_periode,
  tanggalMulai: row.tanggal_mulai,
  tanggalAkhir: row.tanggal_akhir,
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
  const { data, error } = await client.from('periode_pembukuan').select('*').order('tanggal_mulai', { ascending: false });
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function createPeriodePembukuan(input: Omit<PeriodePembukuan, 'id' | 'createdAt' | 'closedAt' | 'saldoAkhir' | 'status'>): Promise<{ success: boolean; data?: PeriodePembukuan; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    const items = getLocalPeriodePembukuan();
    if (items.some(x => x.status === 'AKTIF')) return { success: false, message: 'Masih ada periode aktif. Tutup periode tersebut terlebih dahulu.' };
    const item: PeriodePembukuan = { ...input, id: `PER-${Date.now()}`, saldoAkhir: null, createdAt: new Date().toISOString() };
    saveLocal([item, ...items]);
    return { success: true, data: item };
  }
  const { data: active } = await client.from('periode_pembukuan').select('id').eq('status', 'AKTIF').limit(1);
  if ((active || []).length) return { success: false, message: 'Masih ada periode aktif. Tutup periode tersebut terlebih dahulu.' };
  const { data, error } = await client.from('periode_pembukuan').insert({
    nama_periode: input.namaPeriode,
    tanggal_mulai: input.tanggalMulai,
    tanggal_akhir: input.tanggalAkhir,
    saldo_awal: input.saldoAwal,
    status: 'AKTIF'
  }).select().single();
  if (error || !data) return { success: false, message: error?.message || 'Gagal membuat periode.' };
  return { success: true, data: mapRow(data) };
}

export async function closePeriodePembukuan(id: string, saldoAkhir: number): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    const items = getLocalPeriodePembukuan();
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return { success: false, message: 'Periode tidak ditemukan.' };
    items[idx] = { ...items[idx], status: 'DITUTUP', saldoAkhir, closedAt: new Date().toISOString() };
    saveLocal(items);
    return { success: true };
  }
  const { error } = await client.from('periode_pembukuan').update({ status: 'DITUTUP', saldo_akhir: saldoAkhir, closed_at: new Date().toISOString() }).eq('id', id).eq('status', 'AKTIF');
  if (error) return { success: false, message: error.message };
  return { success: true };
}
