-- RAJAKAS - MIGRASI TUTUP BUKU + TAHUN AJARAN
-- NON-DESTRUCTIVE: tidak DROP tabel dan tidak DELETE transaksi.
-- Jalankan SEKALI di Supabase SQL Editor setelah backup.

ALTER TABLE konfigurasi_lembaga
  ADD COLUMN IF NOT EXISTS tahun_ajaran_aktif VARCHAR(30) NOT NULL DEFAULT '2025/2026';

CREATE TABLE IF NOT EXISTS periode_pembukuan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_periode VARCHAR(100) NOT NULL,
  tahun_ajaran VARCHAR(30) NOT NULL,
  tanggal_mulai DATE NOT NULL,
  tanggal_akhir DATE,
  saldo_awal NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_akhir NUMERIC(15,2),
  status VARCHAR(10) NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF','DITUTUP')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_periode_satu_aktif
  ON periode_pembukuan(status) WHERE status = 'AKTIF';

ALTER TABLE periode_pembukuan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hanya user login - periode_pembukuan" ON periode_pembukuan;
CREATE POLICY "Hanya user login - periode_pembukuan"
  ON periode_pembukuan FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE ON periode_pembukuan TO authenticated;

-- Jika belum ada periode, buat satu periode awal dari saldo konfigurasi.
-- Rentang 1900 dipakai hanya untuk menampung seluruh histori lama tanpa
-- memindahkan/menghapus transaksi.
INSERT INTO periode_pembukuan
  (nama_periode, tahun_ajaran, tanggal_mulai, saldo_awal, status)
SELECT
  COALESCE(k.tahun_ajaran_aktif, '2025/2026'),
  COALESCE(k.tahun_ajaran_aktif, '2025/2026'),
  DATE '1900-01-01',
  COALESCE(k.saldo_awal, 0),
  'AKTIF'
FROM konfigurasi_lembaga k
WHERE k.id = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM periode_pembukuan WHERE status = 'AKTIF'
  );

CREATE OR REPLACE FUNCTION hitung_saldo_akhir_periode(p_periode_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  p periode_pembukuan%ROWTYPE;
  v_saldo NUMERIC(15,2);
  v_akhir DATE;
BEGIN
  SELECT * INTO p FROM periode_pembukuan WHERE id = p_periode_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERIODE_TIDAK_DITEMUKAN';
  END IF;

  v_akhir := COALESCE(p.tanggal_akhir, CURRENT_DATE);

  SELECT
    p.saldo_awal
    + COALESCE((SELECT SUM(nominal) FROM pemasukan
                WHERE tanggal >= p.tanggal_mulai AND tanggal <= v_akhir), 0)
    - COALESCE((SELECT SUM(nominal) FROM pengeluaran
                WHERE tanggal >= p.tanggal_mulai AND tanggal <= v_akhir), 0)
  INTO v_saldo;

  RETURN COALESCE(v_saldo, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION tutup_buku(
  p_periode_id UUID,
  p_tahun_ajaran_berikutnya TEXT
)
RETURNS JSONB AS $$
DECLARE
  p periode_pembukuan%ROWTYPE;
  v_saldo_akhir NUMERIC(15,2);
  v_tanggal_tutup DATE := CURRENT_DATE;
  v_next_start DATE := CURRENT_DATE + 1;
  v_next_id UUID;
  v_next JSONB;
BEGIN
  SELECT * INTO p
  FROM periode_pembukuan
  WHERE id = p_periode_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERIODE_TIDAK_DITEMUKAN';
  END IF;

  IF p.status <> 'AKTIF' THEN
    RAISE EXCEPTION 'PERIODE_SUDAH_DITUTUP';
  END IF;

  v_saldo_akhir := hitung_saldo_akhir_periode(p_periode_id);

  UPDATE periode_pembukuan
  SET status = 'DITUTUP',
      tanggal_akhir = v_tanggal_tutup,
      saldo_akhir = v_saldo_akhir,
      closed_at = NOW()
  WHERE id = p_periode_id;

  INSERT INTO periode_pembukuan
    (nama_periode, tahun_ajaran, tanggal_mulai, tanggal_akhir, saldo_awal, status)
  VALUES
    (p_tahun_ajaran_berikutnya, p_tahun_ajaran_berikutnya,
     v_next_start, NULL, v_saldo_akhir, 'AKTIF')
  RETURNING id INTO v_next_id;

  SELECT to_jsonb(x) INTO v_next
  FROM periode_pembukuan x
  WHERE x.id = v_next_id;

  UPDATE konfigurasi_lembaga
  SET tahun_ajaran_aktif = p_tahun_ajaran_berikutnya,
      updated_at = NOW()
  WHERE id = TRUE;

  RETURN jsonb_build_object(
    'saldo_akhir', v_saldo_akhir,
    'periode_berikutnya', v_next
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Membuka kembali hanya jika diperlukan koreksi.
-- Tidak menghapus histori. Setelah dibuka, periode berikutnya yang otomatis
-- dibuat oleh tutup_buku dihapus hanya jika masih kosong/baru dibuat.
CREATE OR REPLACE FUNCTION buka_kembali_buku(p_periode_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  p periode_pembukuan%ROWTYPE;
  n periode_pembukuan%ROWTYPE;
BEGIN
  SELECT * INTO p FROM periode_pembukuan WHERE id = p_periode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PERIODE_TIDAK_DITEMUKAN'; END IF;
  IF p.status <> 'DITUTUP' THEN RAISE EXCEPTION 'PERIODE_SUDAH_AKTIF'; END IF;

  SELECT * INTO n
  FROM periode_pembukuan
  WHERE status = 'AKTIF'
  ORDER BY tanggal_mulai DESC
  LIMIT 1
  FOR UPDATE;

  IF n.id IS NOT NULL THEN
    IF n.tanggal_mulai <> p.tanggal_akhir + 1 OR n.saldo_awal <> p.saldo_akhir THEN
      RAISE EXCEPTION 'PERIODE_BERIKUTNYA_SUDAH_BERJALAN';
    END IF;

    IF EXISTS (SELECT 1 FROM pemasukan x WHERE x.tanggal >= n.tanggal_mulai)
       OR EXISTS (SELECT 1 FROM pengeluaran x WHERE x.tanggal >= n.tanggal_mulai) THEN
      RAISE EXCEPTION 'PERIODE_BERIKUTNYA_SUDAH_MEMILIKI_TRANSAKSI';
    END IF;

    DELETE FROM periode_pembukuan WHERE id = n.id;
  END IF;

  UPDATE periode_pembukuan
  SET status = 'AKTIF', tanggal_akhir = NULL, saldo_akhir = NULL, closed_at = NULL
  WHERE id = p_periode_id;

  UPDATE konfigurasi_lembaga
  SET tahun_ajaran_aktif = p.tahun_ajaran, updated_at = NOW()
  WHERE id = TRUE;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION hitung_saldo_akhir_periode(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION tutup_buku(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION buka_kembali_buku(UUID) TO authenticated;

-- KUNCI TRANSAKSI LAMA SECARA SERVER-SIDE.
-- Setelah cut-off, transaksi sebelum tanggal mulai periode aktif tidak dapat
-- dihapus/diubah dan transaksi baru tidak boleh dibackdate ke periode lama.
CREATE OR REPLACE FUNCTION kunci_transaksi_periode_tertutup()
RETURNS TRIGGER AS $$
DECLARE
  v_mulai DATE;
BEGIN
  SELECT tanggal_mulai INTO v_mulai
  FROM periode_pembukuan
  WHERE status = 'AKTIF'
  ORDER BY tanggal_mulai DESC
  LIMIT 1;

  IF v_mulai IS NULL THEN
    RAISE EXCEPTION 'PERIODE_AKTIF_TIDAK_DITEMUKAN';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.tanggal < v_mulai THEN
      RAISE EXCEPTION 'TRANSAKSI_PERIODE_TERKUNCI: buka kembali buku untuk melakukan koreksi';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.tanggal < v_mulai THEN
    RAISE EXCEPTION 'TRANSAKSI_PERIODE_TERKUNCI: buka kembali buku untuk melakukan koreksi';
  END IF;

  IF NEW.tanggal < v_mulai THEN
    RAISE EXCEPTION 'TANGGAL_PERIODE_TERKUNCI: transaksi tidak boleh masuk ke periode yang sudah ditutup';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_kunci_periode_pemasukan ON pemasukan;
CREATE TRIGGER trigger_kunci_periode_pemasukan
BEFORE INSERT OR UPDATE OR DELETE ON pemasukan
FOR EACH ROW EXECUTE FUNCTION kunci_transaksi_periode_tertutup();

DROP TRIGGER IF EXISTS trigger_kunci_periode_pengeluaran ON pengeluaran;
CREATE TRIGGER trigger_kunci_periode_pengeluaran
BEFORE INSERT OR UPDATE OR DELETE ON pengeluaran
FOR EACH ROW EXECUTE FUNCTION kunci_transaksi_periode_tertutup();
