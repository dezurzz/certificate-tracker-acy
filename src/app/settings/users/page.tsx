'use client';

import React, { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ConfirmationModal from '@/components/ConfirmationModal';
import LoadError from '@/components/LoadError';
import { TableSkeletonRows, type SkeletonColumn } from '@/components/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, useT } from '@/i18n/LanguageContext';
import { msg } from '@/i18n/msg';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';
import { formatRelativeTime } from '@/lib/relativeTime';
import { ROLES, type Role } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/roleLabels';
import type { ManagedUser } from '@/lib/auth/managedUser';
import { adminErrorCode, createUser, listUsers, updateUser } from '@/lib/adminUsers';

const SKELETON_COLUMNS: SkeletonColumn[] = [
  { w: 'w-40', kind: 'twoLine' },
  { w: 'w-28', kind: 'badge' },
  'w-24',
  { w: '', kind: 'action' },
];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: msg('Semua akses, termasuk kelola akun, peran, dan pengaturan sistem.'),
  staff: msg('Membaca, menambah, dan mengubah data. Hanya bisa menghapus data miliknya sendiri.'),
  executive: msg('Hanya melihat dashboard performa dan laporan. Tidak bisa mengubah data.'),
  viewer: msg('Hanya membaca data. Tidak bisa menambah, mengubah, atau menghapus.'),
};

/** 12 random characters from an unambiguous alphabet (no 0/O, 1/l/I). */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

export default function UsersPage() {
  const t = useT();
  const { locale } = useLanguage();
  const { user: me, can } = useAuth();
  const allowed = can('users.manage');

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [roleChange, setRoleChange] = useState<{ user: ManagedUser; role: Role } | null>(null);
  const [passwordFor, setPasswordFor] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<Role>('viewer');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    async function load() {
      try {
        setUsers(await listUsers());
        setLoadError(null);
      } catch (e) {
        setLoadError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [allowed, reloadKey]);

  const errorText = (e: unknown) => {
    const known: Record<string, string> = {
      service_role_missing: t('Pembuatan akun belum aktif: isi SUPABASE_SERVICE_ROLE_KEY di environment server.'),
      email_exists: t('Email ini sudah terdaftar.'),
      invalid_input: t('Data tidak valid. Email harus valid dan password minimal 8 karakter.'),
      forbidden: t('Hanya admin yang boleh mengelola akun.'),
      self_demote: t('Anda tidak bisa mencabut peran admin Anda sendiri.'),
      last_admin: t('Harus ada minimal satu admin.'),
      not_found: t('Akun tidak ditemukan.'),
    };
    const code = adminErrorCode(e);
    return (code && known[code]) || getErrorMessage(e);
  };

  const confirmRoleChange = async () => {
    if (!roleChange) return;
    const { user: target, role } = roleChange;
    setRoleChange(null);
    try {
      await updateUser(target.id, { role });
      notify.success(t('Peran {email} diubah menjadi {role}', { email: target.email, role: t(ROLE_LABELS[role]) }));
      setReloadKey(k => k + 1);
    } catch (e) {
      notify.error(t('Gagal mengubah peran'), errorText(e));
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordFor) return;
    setSubmitting(true);
    try {
      await updateUser(passwordFor.id, { password: newPassword });
      notify.success(t('Password {email} diperbarui', { email: passwordFor.email }));
      setPasswordFor(null);
      setNewPassword('');
    } catch (err) {
      notify.error(t('Gagal mengatur password'), errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUser({ email: addEmail.trim(), password: addPassword, role: addRole });
      notify.success(t('Akun untuk {email} berhasil dibuat', { email: addEmail.trim() }));
      setAddOpen(false);
      setAddEmail('');
      setAddPassword('');
      setAddRole('viewer');
      setReloadKey(k => k + 1);
    } catch (err) {
      notify.error(t('Gagal membuat akun'), errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) {
    return (
      <div className="cms-card w-full !p-6 text-center" role="alert">
        <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">lock</span>
        <p className="mt-2 text-sm font-semibold text-slate-900">{t('Halaman ini khusus admin')}</p>
        <p className="mt-1 text-xs text-slate-500">{t('Hubungi admin untuk mengubah peran atau membuat akun.')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 cms-card w-full !p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t('Pengguna & Peran')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('Atur siapa yang boleh melihat, mengubah, atau mengelola data. Perubahan peran berlaku setelah pengguna memuat ulang sesi (maksimal sekitar 1 jam) atau masuk kembali.')}</p>
        </div>
        <Button variant="primary" icon="person_add" onClick={() => setAddOpen(true)}>
          {t('Tambah Akun')}
        </Button>
      </div>

      {loadError && (
        <div className="mb-4">
          <LoadError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="table-scroll overflow-x-auto">
          <table className="cms-table w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
                <th className="px-4 py-3">{t('Pengguna')}</th>
                <th className="px-4 py-3">{t('Peran')}</th>
                <th className="px-4 py-3">{t('Terakhir masuk')}</th>
                <th className="px-4 py-3 text-right">{t('Tindakan')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeletonRows label={t('Memuat akun...')} columns={SKELETON_COLUMNS} rows={4} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">{t('Belum ada akun.')}</td>
                </tr>
              ) : (
                users.map(u => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {u.name} {isMe && <span className="font-normal text-slate-500">({t('Anda')})</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={e => setRoleChange({ user: u, role: e.target.value as Role })}
                          disabled={isMe}
                          title={isMe ? t('Anda tidak bisa mengubah peran Anda sendiri') : undefined}
                          aria-label={t('Peran untuk {email}', { email: u.email })}
                          className="cms-select-filter min-w-[140px] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {u.lastSignInAt ? formatRelativeTime(new Date(u.lastSignInAt), t, locale) : t('Belum pernah')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="key"
                          onClick={() => {
                            setPasswordFor(u);
                            setNewPassword('');
                          }}
                        >
                          {t('Atur Password')}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role legend */}
      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES.map(r => (
          <div key={r} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-xs font-semibold text-slate-900">{t(ROLE_LABELS[r])}</dt>
            <dd className="mt-0.5 text-[11px] text-slate-500">{t(ROLE_DESCRIPTIONS[r])}</dd>
          </div>
        ))}
      </dl>

      <ConfirmationModal
        isOpen={roleChange !== null}
        title={t('Ubah Peran')}
        message={
          roleChange
            ? t('Ubah peran {email} dari {from} menjadi {to}?', {
                email: roleChange.user.email,
                from: t(ROLE_LABELS[roleChange.user.role]),
                to: t(ROLE_LABELS[roleChange.role]),
              })
            : ''
        }
        confirmLabel={t('Ya, Ubah Peran')}
        type={roleChange?.user.role === 'admin' ? 'warning' : 'info'}
        onConfirm={confirmRoleChange}
        onCancel={() => setRoleChange(null)}
      />

      {addOpen && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setAddOpen(false)}
          title={t('Tambah Akun')}
          description={t('Akun langsung aktif. Berikan email dan password ini kepada pengguna.')}
          icon="person_add"
          onSubmit={submitAdd}
          submitLabel={t('Buat Akun')}
          submitting={submitting}
        >
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">{t('Alamat Email Pengguna')}</label>
              <input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" required className="cms-input text-xs" placeholder={t('operator@bkiacademy.com')} />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">{t('Password Awal')}</label>
              <div className="flex gap-2">
                <input value={addPassword} onChange={e => setAddPassword(e.target.value)} type="text" required minLength={8} className="cms-input font-mono text-xs" placeholder={t('mis. BKI12345')} />
                <Button type="button" variant="secondary" size="sm" icon="autorenew" onClick={() => setAddPassword(generatePassword())}>
                  {t('Acak')}
                </Button>
              </div>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">{t('Peran')}</label>
              <select value={addRole} onChange={e => setAddRole(e.target.value as Role)} className="cms-input text-xs">
                {ROLES.map(r => (
                  <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">{t(ROLE_DESCRIPTIONS[addRole])}</p>
            </div>
          </div>
        </Modal>
      )}

      {passwordFor && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setPasswordFor(null)}
          title={t('Atur Password')}
          description={passwordFor.email}
          icon="key"
          onSubmit={submitPassword}
          submitLabel={t('Simpan Password')}
          submitting={submitting}
        >
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">{t('Password Baru')}</label>
              <div className="flex gap-2">
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="text" required minLength={8} className="cms-input font-mono text-xs" />
                <Button type="button" variant="secondary" size="sm" icon="autorenew" onClick={() => setNewPassword(generatePassword())}>
                  {t('Acak')}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">{t('Sampaikan password ini lewat jalur yang aman, lalu minta pengguna menggantinya di Keamanan & Akses.')}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
