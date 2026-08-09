export const SUPABASE_SQL_SCRIPT = `-- =====================================================================
-- RAJASCH.ID MODUL BENDAHARA - DATABASE MIGRATION SCRIPT
-- Jalankan script ini di SQL Editor Supabase Project Anda
-- =====================================================================

-- 1. HAPUS TRIGGER & TABEL LAMA JIKA ADA
-- (dibungkus DO block supaya tidak error kalau tabelnya belum pernah ada
-- sama sekali -- kasus instalasi baru/pertama kali)
DO $$
BEGIN
  IF to_regclass('public.pengeluaran') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_check_saldo_pengeluaran ON pengeluaran;
    DROP TRIGGER IF EXISTS trigger_audit_pengeluaran ON pengeluaran;
  END IF;
  IF to_regclass('public.pemasukan') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_audit_pemasukan ON pemasukan;
  END IF;
  IF to_regclass('public.siswa_tagihan') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_audit_siswa_tagihan ON siswa_tagihan;
  END IF;
END $$;

DROP FUNCTION IF EXISTS check_saldo_sebelum_pengeluaran();
DROP FUNCTION IF EXISTS log_audit_change();
DROP FUNCTION IF EXISTS catat_pengeluaran(text, date, text, numeric, text, text, text);

-- 2. TABEL AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tabel_terkait VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    aksi VARCHAR(10) NOT NULL CHECK (aksi IN ('INSERT', 'UPDATE', 'DELETE')),
    data_sebelum JSONB,
    data_sesudah JSONB,
    user_id VARCHAR(100) DEFAULT 'bendahara_main',
    waktu TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL MASTER DATA
CREATE TABLE IF NOT EXISTS master_sumber_dana (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subs TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_kategori (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL SISWA TAGIHAN
CREATE TABLE IF NOT EXISTS siswa_tagihan (
    id VARCHAR(50) PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    kelas VARCHAR(50) NOT NULL,
    jenis VARCHAR(100) NOT NULL,
    target NUMERIC(15,2) NOT NULL DEFAULT 0,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'bendahara'
);

-- 5. TABEL PEMASUKAN
CREATE TABLE IF NOT EXISTS pemasukan (
    id VARCHAR(50) PRIMARY KEY,
    no_bukti VARCHAR(50) NOT NULL,
    tanggal DATE NOT NULL,
    sumber VARCHAR(50) NOT NULL,
    sub VARCHAR(100) NOT NULL,
    nominal NUMERIC(15,2) NOT NULL CHECK (nominal > 0),
    keterangan TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Selesai',
    siswa_id VARCHAR(50) REFERENCES siswa_tagihan(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'bendahara'
);

-- 6. TABEL PENGELUARAN
CREATE TABLE IF NOT EXISTS pengeluaran (
    id VARCHAR(50) PRIMARY KEY,
    no_bukti VARCHAR(50) NOT NULL,
    tanggal DATE NOT NULL,
    kategori VARCHAR(100) NOT NULL,
    nominal NUMERIC(15,2) NOT NULL CHECK (nominal > 0),
    keterangan TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Terbayar',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'bendahara'
);

-- 7. VIEW SALDO KAS BERJALAN (SALDO AWAL BUKU KAS = Rp 100.000.000)
CREATE OR REPLACE VIEW saldo_kas AS
SELECT 
    100000000.00 + COALESCE((SELECT SUM(nominal) FROM pemasukan), 0) - COALESCE((SELECT SUM(nominal) FROM pengeluaran), 0) AS total_saldo_kas;

-- 8. TRIGGER FUNCTION VALIDASI SALDO SEBELUM PENGELUARAN (SERVER-SIDE CONSTRAINT)
CREATE OR REPLACE FUNCTION check_saldo_sebelum_pengeluaran()
RETURNS TRIGGER AS $$
DECLARE
    v_saldo_saat_ini NUMERIC(15,2);
    v_saldo_setelah_pengeluaran NUMERIC(15,2);
BEGIN
    -- Hitung total saldo kas berjalan saat ini (tanpa record NEW ini jika INSERT)
    IF (TG_OP = 'INSERT') THEN
        SELECT total_saldo_kas INTO v_saldo_saat_ini FROM saldo_kas;
        v_saldo_setelah_pengeluaran := v_saldo_saat_ini - NEW.nominal;
    ELSIF (TG_OP = 'UPDATE') THEN
        SELECT total_saldo_kas INTO v_saldo_saat_ini FROM saldo_kas;
        v_saldo_setelah_pengeluaran := v_saldo_saat_ini + OLD.nominal - NEW.nominal;
    END IF;

    -- Batalkan transaksi jika nominal pengeluaran melebihi saldo kas yang tersedia!
    IF v_saldo_setelah_pengeluaran < 0 THEN
        RAISE EXCEPTION 'SALDO_TIDAK_CUKUP: Nominal pengeluaran (Rp %) melebihi total saldo kas tersedia (Rp %)! Transaksi dibatalkan oleh database Server.', 
            to_char(NEW.nominal, 'FM999,999,999,999'), 
            to_char(COALESCE(v_saldo_saat_ini, 0), 'FM999,999,999,999');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_saldo_pengeluaran
BEFORE INSERT OR UPDATE ON pengeluaran
FOR EACH ROW
EXECUTE FUNCTION check_saldo_sebelum_pengeluaran();

-- 9. TRIGGER FUNCTION AUDIT LOG (MENCATAT SETIAP INSERT/UPDATE/DELETE OTOMATIS)
CREATE OR REPLACE FUNCTION log_audit_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user TEXT;
BEGIN
    v_user := COALESCE(current_setting('app.current_user', true), 'bendahara_main');

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (tabel_terkait, record_id, aksi, data_sebelum, data_sesudah, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, row_to_json(NEW)::jsonb, v_user);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (tabel_terkait, record_id, aksi, data_sebelum, data_sesudah, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, v_user);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (tabel_terkait, record_id, aksi, data_sebelum, data_sesudah, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, NULL, v_user);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_pemasukan
AFTER INSERT OR UPDATE OR DELETE ON pemasukan
FOR EACH ROW EXECUTE FUNCTION log_audit_change();

CREATE TRIGGER trigger_audit_pengeluaran
AFTER INSERT OR UPDATE OR DELETE ON pengeluaran
FOR EACH ROW EXECUTE FUNCTION log_audit_change();

CREATE TRIGGER trigger_audit_siswa_tagihan
AFTER INSERT OR UPDATE OR DELETE ON siswa_tagihan
FOR EACH ROW EXECUTE FUNCTION log_audit_change();

-- 10. STORED PROCEDURE / RPC FUNCTION: catat_pengeluaran()
-- Membungkus 'cek saldo -> insert -> trigger audit' dalam satu transaksi atomic
CREATE OR REPLACE FUNCTION catat_pengeluaran(
    p_no_bukti TEXT,
    p_tanggal DATE,
    p_kategori TEXT,
    p_nominal NUMERIC,
    p_keterangan TEXT,
    p_status TEXT DEFAULT 'Terbayar',
    p_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_new_id TEXT;
    v_inserted_row RECORD;
BEGIN
    IF p_id IS NULL OR p_id = '' THEN
        v_new_id := 'OUT-' || LPAD((COALESCE((SELECT COUNT(*) FROM pengeluaran), 0) + 1)::TEXT, 3, '0');
    ELSE
        v_new_id := p_id;
    END IF;

    -- Validasi nominal
    IF p_nominal <= 0 THEN
        RAISE EXCEPTION 'NOMINAL_INVALID: Nominal pengeluaran harus lebih dari Rp 0';
    END IF;

    -- Insert pengeluaran (akan secara otomatis memicu trigger_check_saldo_pengeluaran)
    INSERT INTO pengeluaran (id, no_bukti, tanggal, kategori, nominal, keterangan, status)
    VALUES (v_new_id, p_no_bukti, p_tanggal, p_kategori, p_nominal, p_keterangan, p_status)
    RETURNING * INTO v_inserted_row;

    RETURN row_to_json(v_inserted_row)::jsonb;
END;
$$ LANGUAGE plpgsql;

-- 11. AKTIFKAN ROW LEVEL SECURITY, BATASI HANYA UNTUK PENGGUNA YANG SUDAH LOGIN
-- PENTING: Sebelumnya policy ini "USING (true)" yang berarti SIAPA SAJA yang
-- punya anon key (yang memang publik/terlihat di browser) bisa baca & tulis
-- SEMUA data keuangan tanpa login. Ini sudah diperbaiki: sekarang hanya
-- pengguna yang berhasil login lewat Supabase Auth (role 'authenticated')
-- yang bisa mengakses data. Pengguna anonim (belum login) tidak bisa apa-apa.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_sumber_dana ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswa_tagihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE pemasukan ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengeluaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Akses Publik audit_log" ON audit_log;
DROP POLICY IF EXISTS "Akses Publik master_sumber_dana" ON master_sumber_dana;
DROP POLICY IF EXISTS "Akses Publik master_kategori" ON master_kategori;
DROP POLICY IF EXISTS "Akses Publik siswa_tagihan" ON siswa_tagihan;
DROP POLICY IF EXISTS "Akses Publik pemasukan" ON pemasukan;
DROP POLICY IF EXISTS "Akses Publik pengeluaran" ON pengeluaran;
DROP POLICY IF EXISTS "Hanya user login - audit_log" ON audit_log;
DROP POLICY IF EXISTS "Hanya user login - master_sumber_dana" ON master_sumber_dana;
DROP POLICY IF EXISTS "Hanya user login - master_kategori" ON master_kategori;
DROP POLICY IF EXISTS "Hanya user login - siswa_tagihan" ON siswa_tagihan;
DROP POLICY IF EXISTS "Hanya user login - pemasukan" ON pemasukan;
DROP POLICY IF EXISTS "Hanya user login - pengeluaran" ON pengeluaran;

CREATE POLICY "Hanya user login - audit_log" ON audit_log
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Hanya user login - master_sumber_dana" ON master_sumber_dana
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Hanya user login - master_kategori" ON master_kategori
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Hanya user login - siswa_tagihan" ON siswa_tagihan
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Hanya user login - pemasukan" ON pemasukan
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Hanya user login - pengeluaran" ON pengeluaran
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 12. PENTING: RPC catat_pengeluaran() didefinisikan SECURITY INVOKER (default),
-- artinya RPC ini berjalan dengan hak akses pemanggilnya sehingga tetap tunduk
-- pada RLS di atas -> hanya user yang sudah login yang bisa memanggilnya.
-- Baris ini memastikan grant eksekusi hanya untuk role 'authenticated', bukan 'anon'.
REVOKE ALL ON FUNCTION catat_pengeluaran(text, date, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catat_pengeluaran(text, date, text, numeric, text, text, text) TO authenticated;

-- SELESAI. SILAKAN TEKAN "RUN" DI SUPABASE SQL EDITOR!
-- Setelah ini jalan, buat akun bendahara di Authentication > Users > Add User
-- (lihat panduan deploy yang saya berikan di chat).
`;
