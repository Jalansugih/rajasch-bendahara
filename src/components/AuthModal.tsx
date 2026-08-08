import React, { useState } from 'react';
import { UserCheck, Key, Mail, Lock, ShieldCheck, X, AlertTriangle } from 'lucide-react';
import { UserSession } from '../types';
import { signInWithPassword } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userSession: UserSession | null;
  onLoginSuccess: (session: UserSession) => void;
  showToast: (msg: string) => void;
  /** Jika true (mode demo lokal tanpa Supabase), form login tidak ditampilkan sama sekali. */
  isDemoMode?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  showToast,
  isDemoMode
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const res = await signInWithPassword(email, password);
    setLoading(false);

    if (!res.success || !res.session) {
      // TIDAK ADA FALLBACK: kalau login gagal, akses tetap ditolak.
      setErrorMsg(res.message || 'Login gagal. Periksa kembali email & kata sandi.');
      return;
    }

    onLoginSuccess({
      id: res.session.user.id,
      email: res.session.user.email || email,
      role: 'Bendahara Utama'
    });
    showToast('Login berhasil!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[14px] max-w-md w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Autentikasi Pengguna (Supabase Auth)</h3>
              <p className="text-[11px] text-blue-100">Login aman Bendahara & Hak Akses Role</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDemoMode ? (
          <div className="p-6 space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[14px] text-[11px] text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Aplikasi belum terhubung ke Supabase, jadi login akun sungguhan belum tersedia. Silakan konfigurasi koneksi Supabase terlebih dahulu di menu Pengaturan.</span>
            </div>
            <div className="pt-2 flex items-center justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[14px]"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" /> Email Bendahara
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@sekolah.sch.id"
                className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" /> Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-[14px] px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-[14px] text-[11px] text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-[14px] text-[11px] text-blue-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Sistem terhubung langsung ke Supabase Auth dengan Row Level Security &amp; Audit Log terintegrasi.</span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[14px]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-[14px] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{loading ? 'Memproses...' : 'Masuk Aplikasi'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
