'use client';

import React, { useEffect, useState } from 'react';
import Button from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, useT } from '@/i18n/LanguageContext';
import { notify } from '@/lib/notify';
import { formatRelativeTime } from '@/lib/relativeTime';
import { DEFAULT_TARGETS, TARGET_LIMITS, invalidTargetField, type ExecutiveTargets } from '@/lib/executive/targets';
import { fetchExecutiveTargets, saveExecutiveTargets, type TargetsResult } from '@/lib/executive/targetsStore';

type Field = { key: keyof ExecutiveTargets; label: string; hint: string; unit: string };

/** Admin form for the thresholds the executive dashboard judges leads and certificates against. */
export default function ExecutiveTargetsCard() {
  const t = useT();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const [values, setValues] = useState<Record<keyof ExecutiveTargets, string>>(
    () => Object.fromEntries(Object.entries(DEFAULT_TARGETS).map(([k, v]) => [k, String(v)])) as Record<keyof ExecutiveTargets, string>
  );
  const [info, setInfo] = useState<TargetsResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchExecutiveTargets().then(r => {
      if (cancelled) return;
      setInfo(r);
      setValues(Object.fromEntries(Object.entries(r.targets).map(([k, v]) => [k, String(v)])) as Record<keyof ExecutiveTargets, string>);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fields: Field[] = [
    { key: 'conversionPct', label: t('Target konversi lead ke pendaftaran'), hint: t('Persentase lead yang seharusnya sampai berstatus Terdaftar.'), unit: '%' },
    { key: 'cancelMaxPct', label: t('Batas tingkat batal'), hint: t('Di atas angka ini, tingkat batal ditandai sebagai risiko.'), unit: '%' },
    { key: 'slaCompliancePct', label: t('Target kepatuhan SLA sertifikat'), hint: t('Persentase sertifikat yang seharusnya berumur dalam batas SLA.'), unit: '%' },
    { key: 'staleDays', label: t('Lead dianggap diam setelah'), hint: t('Lead aktif tanpa aktivitas lebih lama dari ini dihitung terbengkalai.'), unit: t('hari') },
    { key: 'minSample', label: t('Sampel minimum untuk kesimpulan'), hint: t('Jika data lebih sedikit dari ini, dashboard menulis "data belum cukup".'), unit: '' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) as unknown as ExecutiveTargets;
    const bad = invalidTargetField(next);
    if (bad) {
      const { min, max } = TARGET_LIMITS[bad];
      notify.warning(t('Nilai tidak valid'), t('{field} harus bilangan bulat {min} sampai {max}.', { field: fields.find(f => f.key === bad)?.label ?? bad, min, max }));
      return;
    }
    setSaving(true);
    try {
      await saveExecutiveTargets(next, user?.name);
      setInfo({ targets: next, source: 'server', updatedAt: new Date().toISOString(), updatedBy: user?.name });
      notify.success(t('Target dashboard eksekutif disimpan'));
    } catch (err) {
      notify.error(t('Gagal menyimpan target'), err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="executive-targets" className="mt-6 border-t border-slate-200 pt-6">
      <div className="mb-4 text-left">
        <h2 className="text-base font-semibold text-slate-900">{t('Target Dashboard Eksekutif')}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t('Dashboard eksekutif menilai leads dan sertifikat terhadap angka-angka ini. Ubah sesuai target bisnis Anda.')}
        </p>
        {info?.source === 'server' && info.updatedAt && (
          <p className="mt-1 text-[11px] text-slate-500">
            {t('Terakhir diubah {when} oleh {by}', { when: formatRelativeTime(new Date(info.updatedAt), t, locale), by: info.updatedBy || '-' })}
          </p>
        )}
        {info?.source === 'default' && (
          <p className="mt-1 text-[11px] text-slate-500">{t('Memakai nilai bawaan (belum pernah disimpan).')}</p>
        )}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
        {fields.map(f => (
          <div key={f.key} className="flex flex-col gap-1.5 text-left">
            <label htmlFor={`target-${f.key}`} className="text-[13px] font-medium text-slate-700">{f.label}</label>
            <div className="flex items-center gap-2">
              <input
                id={`target-${f.key}`}
                type="number"
                inputMode="numeric"
                min={TARGET_LIMITS[f.key].min}
                max={TARGET_LIMITS[f.key].max}
                value={values[f.key]}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                className="cms-input w-28 text-xs font-semibold tabular-nums"
                required
              />
              {f.unit && <span className="text-xs text-slate-500">{f.unit}</span>}
            </div>
            <p className="text-[11px] text-slate-500">{f.hint}</p>
          </div>
        ))}
        <div className="flex items-end justify-end gap-2 md:col-span-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setValues(Object.fromEntries(Object.entries(DEFAULT_TARGETS).map(([k, v]) => [k, String(v)])) as Record<keyof ExecutiveTargets, string>)}
          >
            {t('Kembalikan ke bawaan')}
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            {t('Simpan Target')}
          </Button>
        </div>
      </form>
    </section>
  );
}
