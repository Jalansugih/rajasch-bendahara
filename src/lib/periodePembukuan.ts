import { getSupabaseClient } from './supabase';
import { PeriodePembukuan } from '../types';

function mapRow(row: any): PeriodePembukuan {
  return {
    id: row.id,
    namaPeriode: row.nama_periode,
    tanggalMulai: row.tanggal_mulai,
    tanggalAkhir: row.tanggal_akhir,
    saldoAwal: Number(row.saldo_awal) || 0,
    saldoAkhir: row.saldo_akhir == null ? null : Number(row.saldo_akhir),
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    createdBy: row.created_by,
    closedBy: row.closed_by
  };
}

export async function fetchPeriodePembukuan(): Promise<PeriodePembukuan[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('periode_pembukuan')
    .select('*')
    .order('tanggal_mulai', { ascending: false });
  if (error) return [];
  return (data || []).map(mapRow);
}

export async function createPeriodePembukuan(input: {
  namaPeriode: string;
  tanggalMulai: string;
  tanggalAkhir: string;
  saldoAwal: number;
}): Promise<{ success: boolean; data?: PeriodePembukuan; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase belum terhubung.' };

  const { data: existing } = await client
    .from('periode_pembukuan')
    .select('id')
    .eq('status', 'AKTIF')
    .limit(1);
  if (existing && existing.length > 0) {
    return { success: false, message: 'Masih ada periode pembukuan yang aktif. Tutup periode tersebut terlebih dahulu.' };
  }

  const { data, error } = await client
    .from('periode_pembukuan')
    .insert({
      nama_periode: input.namaPeriode,
      tanggal_mulai: input.tanggalMulai,
      tanggal_akhir: input.tanggalAkhir,
      saldo_awal: input.saldoAwal,
      status: 'AKTIF'
    })
    .select('*')
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, data: mapRow(data) };
}

export async function tutupPeriodePembukuan(
  id: string,
  saldoAkhir: number
): Promise<{ success: boolean; data?: PeriodePembukuan; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase belum terhubung.' };

  const { data, error } = await client
    .from('periode_pembukuan')
    .update({
      status: 'DITUTUP',
      saldo_akhir: saldoAkhir,
      closed_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('status', 'AKTIF')
    .select('*')
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, data: mapRow(data) };
}
