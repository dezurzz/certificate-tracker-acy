import type { TFunction } from '@/i18n/LanguageContext';
import type { Insight, OverallStatus } from '@/lib/executive/insights';

/**
 * The wording of every insight. Each one answers three questions an executive asks:
 *   headline : WHAT is the finding (a full sentence with the numbers, never a label)
 *   evidence : the raw facts behind it (counts, comparisons), so the conclusion can be checked
 *   why      : SO WHAT: what it costs, quantified from the data (gap to target, change vs before...)
 *   action   : NOW WHAT: the move that fits THIS situation (names the source, program, stage, reason)
 *   decision : (risks only) the choice to make, with the numbers, never a repeat of `action`
 * Every sentence uses the figures in `insight.params`; when a figure is missing a plainer sentence is used.
 * The engine in insights.ts decides WHICH insights appear and carries the parameters.
 */
export interface InsightCopy {
  headline: string;
  evidence?: string;
  why: string;
  action: string;
  decision?: string;
}

const num = (v: number | string | boolean | null | undefined) => (typeof v === 'number' || typeof v === 'string' ? v : '');
const has = (v: unknown) => v !== null && v !== undefined && v !== '';
/** Join sentences that exist (some depend on data that may be missing). */
const join = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function stageName(t: TFunction, stage: string): string {
  switch (stage) {
    case 'Baru': return t('Lead baru');
    case 'Jadwal Ditawarkan': return t('Jadwal ditawarkan');
    case 'Link Terkirim': return t('Link terkirim');
    case 'Terdaftar': return t('Terdaftar');
    case 'Selesai Training': return t('Selesai training');
    case 'Pending': return t('Menunggu');
    case 'Processing': return t('Proses QC');
    case 'Printing': return t('Cetak');
    default: return stage;
  }
}

/** Action that fits the funnel step where leads are lost. */
function leakAction(t: TFunction, to: string, lost: number): string {
  switch (to) {
    case 'Jadwal Ditawarkan':
      return t('Tawarkan jadwal pada hari yang sama lead masuk, dengan satu opsi cadangan, untuk {lost} lead yang tidak pernah ditawari.', { lost });
    case 'Link Terkirim':
      return t('Kirim tautan pendaftaran segera setelah jadwal disepakati; {lost} lead berhenti sebelum menerimanya.', { lost });
    case 'Terdaftar':
      return t('Hubungi {lost} lead yang sudah menerima tautan tetapi belum mendaftar, dan tanyakan hambatannya (harga, persetujuan atasan, jadwal).', { lost });
    case 'Selesai Training':
      return t('Konfirmasi ulang kehadiran menjelang pelaksanaan agar peserta terdaftar benar-benar mengikuti training ({lost} tidak selesai).', { lost });
    default:
      return t('Cari tahu mengapa {lost} lead berhenti di tahap ini dan standarkan follow-up berikutnya.', { lost });
  }
}

export function insightCopy(t: TFunction, i: Insight): InsightCopy {
  const p = i.params;
  const v = (k: string) => num(p[k]);
  const n = (k: string) => Number(p[k] ?? 0);

  switch (i.code) {
    // ---------------- Leads ----------------
    case 'low_sample_leads':
      return {
        headline: t('Data lead belum cukup untuk disimpulkan: {total} lead (minimal {minSample})', { total: v('total'), minSample: v('minSample') }),
        why: t('Kesimpulan dari sampel sekecil ini bisa menyesatkan, jadi dashboard tidak menilai konversi dan pembatalan.'),
        action: t('Perluas periode atau tunggu sampai data lead bertambah.'),
      };

    case 'conversion': {
      const evidence = join(
        t('{registered} dari {total} lead terdaftar.', { registered: v('registered'), total: v('total') }),
        has(p.deltaPts) && t('Periode lalu {prev}% ({sign}{delta} poin).', { prev: v('prevRate'), sign: n('deltaPts') > 0 ? '+' : '', delta: v('deltaPts') }),
      );
      if (i.severity === 'good') {
        return {
          headline: t('Konversi lead ke pendaftaran {rate}%, di atas target {target}%', { rate: v('rate'), target: v('target') }),
          evidence,
          why: has(p.deltaPts) && n('deltaPts') < 0
            ? t('Masih di atas target, tetapi turun {delta} poin dari periode lalu; perhatikan agar tidak berlanjut.', { delta: Math.abs(n('deltaPts')) })
            : t('Pipeline menghasilkan {registered} pendaftaran dari {total} lead sesuai rencana.', { registered: v('registered'), total: v('total') }),
          action: has(p.bestSource)
            ? t('Pertahankan pola dari {source} (konversi {rate}%) dan tambah volume lead di sumber itu.', { source: String(p.bestSource), rate: v('bestSourceRate') })
            : t('Pertahankan pola follow-up saat ini dan fokus menambah volume lead.'),
        };
      }
      return {
        headline: i.severity === 'watch'
          ? t('Konversi lead ke pendaftaran {rate}%, tipis di bawah target {target}%', { rate: v('rate'), target: v('target') })
          : t('Konversi lead ke pendaftaran hanya {rate}%, jauh di bawah target {target}%', { rate: v('rate'), target: v('target') }),
        evidence,
        why: join(
          t('Menutup selisih ke target berarti sekitar {lost} pendaftaran tambahan dari {total} lead.', { lost: v('lostLeads'), total: v('total') }),
          has(p.deltaPts) && (n('deltaPts') < 0
            ? t('Turun {delta} poin dari periode lalu.', { delta: Math.abs(n('deltaPts')) })
            : n('deltaPts') > 0 ? t('Sudah membaik {delta} poin dari periode lalu, tetapi belum mencapai target.', { delta: v('deltaPts') }) : t('Tidak berubah dari periode lalu.')),
        ),
        action: has(p.bestSource)
          ? t('Terapkan cara menangani lead dari {source} (konversi {rate}%) pada sumber lain, mulai dari tahap dengan kebocoran terbesar.', { source: String(p.bestSource), rate: v('bestSourceRate') })
          : t('Tinjau proses penawaran dan follow-up, mulai dari tahap dengan kebocoran terbesar.'),
        decision: t('Pilih: menambah kapasitas follow-up atau menyederhanakan penawaran, agar {lost} pendaftaran yang tertinggal dari target {target}% terkejar.', { lost: v('lostLeads'), target: v('target') }),
      };
    }

    case 'funnel_leak': {
      const from = stageName(t, String(p.from));
      const to = stageName(t, String(p.to));
      return {
        headline: t('Kebocoran terbesar di {from} → {to}: {dropPct}% lead berhenti ({lost} dari {fromReached})', {
          from, to, dropPct: v('dropPct'), lost: v('lost'), fromReached: v('fromReached'),
        }),
        evidence: t('{fromReached} lead mencapai {from}, hanya {next} yang lanjut ke {to}.', { fromReached: v('fromReached'), from, next: n('fromReached') - n('lost'), to }),
        why: has(p.shareOfLosses)
          ? t('Satu transisi ini menyumbang {share}% dari seluruh lead yang tidak sampai terdaftar; lead ini sudah menunjukkan minat sehingga paling murah diselamatkan.', { share: v('shareOfLosses') })
          : t('Lead yang hilang di tahap ini paling murah diselamatkan karena sudah menunjukkan minat.'),
        action: leakAction(t, String(p.to), n('lost')),
        decision: t('Tetapkan satu pemilik dan tenggat untuk transisi {from} → {to}, dengan sasaran menyelamatkan sedikitnya separuh dari {lost} lead yang hilang.', { from, to, lost: v('lost') }),
      };
    }

    case 'cancel_rate': {
      const reasons = has(p.topReason)
        ? join(
            t('Alasan terbanyak: {reason} ({count} lead, {share}% dari pembatalan).', { reason: String(p.topReason), count: v('topReasonCount'), share: v('topReasonShare') }),
            has(p.secondReason) && t('Berikutnya: {reason} ({count}).', { reason: String(p.secondReason), count: v('secondReasonCount') }),
          )
        : t('Jumlah pembatalan belum cukup untuk menyimpulkan alasan dominan.');
      const evidence = join(t('{cancelled} dari {total} lead batal.', { cancelled: v('cancelled'), total: v('total') }), reasons);
      if (i.severity === 'good') {
        return {
          headline: t('Tingkat batal {rate}%, masih dalam batas {max}%', { rate: v('rate'), max: v('max') }),
          evidence,
          why: t('Kehilangan lead karena pembatalan masih terkendali ({cancelled} lead).', { cancelled: v('cancelled') }),
          action: has(p.topReason)
            ? t('Pantau alasan {reason} agar tidak naik.', { reason: String(p.topReason) })
            : t('Teruskan, dan pantau alasan batal agar tetap rendah.'),
        };
      }
      return {
        headline: i.severity === 'watch'
          ? (n('rate') >= n('max')
              ? t('Tingkat batal {rate}%, tepat di batas {max}%', { rate: v('rate'), max: v('max') })
              : t('Tingkat batal {rate}%, mendekati batas {max}%', { rate: v('rate'), max: v('max') }))
          : t('Tingkat batal {rate}% melewati batas {max}%', { rate: v('rate'), max: v('max') }),
        evidence,
        why: n('excess') > 0
          ? t('{excess} pembatalan melebihi yang dibolehkan batas {max}% untuk {total} lead; lead ini hilang sepenuhnya.', { excess: v('excess'), max: v('max'), total: v('total') })
          : (() => {
              const room = Math.floor((n('max') / 100) * n('total')) - n('cancelled');
              return room <= 0
                ? t('{cancelled} lead hilang sepenuhnya; satu pembatalan lagi akan melewati batas {max}%.', { cancelled: v('cancelled'), max: v('max') })
                : t('{cancelled} lead hilang sepenuhnya; tersisa {room} pembatalan lagi sebelum melewati batas {max}%.', { cancelled: v('cancelled'), room, max: v('max') });
            })(),
        action: has(p.topReason)
          ? t('Mulai dari alasan {reason} ({share}% pembatalan): periksa apa yang bisa dicegah sebelum lead memutuskan batal.', { reason: String(p.topReason), share: v('topReasonShare') })
          : t('Catat alasan setiap pembatalan agar penyebab dominannya bisa ditangani.'),
        decision: has(p.topReason)
          ? t('Putuskan kebijakan untuk alasan {reason}: menawarkan alternatif (jadwal, harga, format) atau menerimanya sebagai kehilangan wajar.', { reason: String(p.topReason) })
          : undefined,
      };
    }

    case 'demand_trend':
      if (i.severity === 'good') {
        return {
          headline: t('Lead masuk naik {pct}% menjadi {current} (sebelumnya {previous})', { pct: v('pct'), current: v('current'), previous: v('previous') }),
          evidence: has(p.topSource) ? t('Sumber terbesar: {source} ({share}% dari lead).', { source: String(p.topSource), share: v('topSourceShare') }) : undefined,
          why: n('waitingSeats') > 0
            ? t('Sudah ada {seats} kursi menunggu jadwal; tambahan lead akan memperpanjang antrean itu.', { seats: v('waitingSeats') })
            : t('Permintaan bertambah; kapasitas follow-up dan jadwal batch perlu ikut bertambah.'),
          action: n('waitingSeats') > 0
            ? t('Buka batch tambahan sebelum kenaikan ini menumpuk di waiting list.')
            : t('Pastikan jadwal batch dan kapasitas tim cukup untuk menampung kenaikan ini.'),
        };
      }
      return {
        headline: t('Lead masuk turun {pct}% menjadi {current} (sebelumnya {previous})', { pct: Math.abs(n('pct')), current: v('current'), previous: v('previous') }),
        evidence: has(p.topSource) ? t('Sumber terbesar: {source} ({share}% dari lead).', { source: String(p.topSource), share: v('topSourceShare') }) : undefined,
        why: t('Selisih {gap} lead dari periode lalu; dampaknya pada pendaftaran baru terasa beberapa minggu ke depan.', { gap: Math.abs(n('current') - n('previous')) }),
        action: has(p.topSource)
          ? t('Periksa {source} lebih dulu karena kontribusinya terbesar, lalu sumber lain yang melemah.', { source: String(p.topSource) })
          : t('Tinjau saluran pemasaran dan sumber lead yang melemah.'),
        decision: i.severity === 'risk' ? t('Pilih: menambah upaya pemasaran sekarang atau menerima volume lebih rendah untuk periode berikutnya.') : undefined,
      };

    case 'waiting_opportunity':
      return {
        headline: p.batches !== null && p.batches !== undefined
          ? t('{seats} kursi dari {leads} lead menunggu jadwal, setara sekitar {batches} batch tambahan', { seats: v('seats'), leads: v('leads'), batches: v('batches') })
          : t('{seats} kursi dari {leads} lead menunggu jadwal', { seats: v('seats'), leads: v('leads') }),
        evidence: has(p.topProgram) ? t('Antrean terbesar: {program} ({seats} kursi).', { program: String(p.topProgram), seats: v('topProgramSeats') }) : undefined,
        why: t('Permintaan sudah ada tetapi belum terlayani; makin lama menunggu, makin besar risiko lead batal atau pindah.'),
        action: has(p.topProgram)
          ? t('Jadwalkan batch tambahan untuk {program} lebih dulu ({seats} kursi menunggu).', { program: String(p.topProgram), seats: v('topProgramSeats') })
          : t('Buka batch tambahan pada program dengan antrean terbanyak.'),
      };

    case 'stale_leads':
      return {
        headline: t('{stale} dari {open} lead aktif tidak tersentuh lebih dari {days} hari', { stale: v('stale'), open: v('open'), days: v('days') }),
        evidence: n('oldestDays') > 0 ? t('Yang paling lama tidak disentuh: {days} hari.', { days: v('oldestDays') }) : undefined,
        why: n('overdueFollowUps') > 0
          ? t('Lead yang tidak ditindaklanjuti cepat mendingin; {overdue} lead aktif sudah melewati jadwal follow-up.', { overdue: v('overdueFollowUps') })
          : t('Lead yang tidak ditindaklanjuti cepat mendingin dan makin kecil peluang terdaftar.'),
        action: n('oldestDays') > 0
          ? t('Mulai dari lead yang terdiam {days} hari, lalu yang melewati jadwal follow-up, minggu ini.', { days: v('oldestDays') })
          : t('Alokasikan follow-up untuk lead terbengkalai minggu ini.'),
        decision: i.severity === 'risk' ? t('Tetapkan batas maksimal {days} hari tanpa aktivitas dan siapa yang bertanggung jawab menindaklanjuti.', { days: v('days') }) : undefined,
      };

    case 'source_gap':
      return {
        headline: t('{best} menghasilkan konversi {bestRate}%, sedangkan {worst} hanya {worstRate}%', { best: String(p.best), bestRate: v('bestRate'), worst: String(p.worst), worstRate: v('worstRate') }),
        evidence: t('{worst}: {worstLeads} lead dengan konversi {worstRate}%.', { worst: String(p.worst), worstLeads: v('worstLeads'), worstRate: v('worstRate') }),
        why: n('extra') > 0
          ? t('Bila {worst} dikonversi seperti {best}, ada sekitar {extra} pendaftaran tambahan dari lead yang sama.', { worst: String(p.worst), best: String(p.best), extra: v('extra') })
          : t('Usaha pada sumber dengan konversi rendah menghasilkan pendaftaran jauh lebih sedikit.'),
        action: t('Geser fokus ke {best}, atau perbaiki cara menangani lead dari {worst}.', { best: String(p.best), worst: String(p.worst) }),
      };

    case 'slow_conversion':
      return {
        headline: t('Median {days} hari dari lead masuk sampai terdaftar (dari {n} lead)', { days: v('days'), n: v('n') }),
        evidence: n('openLeads') > 0 ? t('Saat ini ada {open} lead aktif yang masih dalam proses.', { open: v('openLeads') }) : undefined,
        why: t('Makin lama keputusan, makin besar peluang lead batal atau beralih ke pesaing.'),
        action: t('Percepat penawaran jadwal dan kirim tautan pendaftaran lebih awal.'),
      };

    // ---------------- Certification ----------------
    case 'low_sample_cert':
      return {
        headline: t('Data sertifikat belum cukup untuk disimpulkan: {total} sertifikat (minimal {minSample})', { total: v('total'), minSample: v('minSample') }),
        why: t('Kesimpulan dari sampel sekecil ini bisa menyesatkan, jadi dashboard tidak menilai SLA dan backlog.'),
        action: t('Tunggu sampai data sertifikat bertambah.'),
      };

    case 'sla_compliance': {
      const evidence = t('{late} dari {total} sertifikat di luar batas SLA; target mengizinkan paling banyak {allowed}.', { late: v('lateNow'), total: v('total'), allowed: v('allowedLate') });
      if (i.severity === 'good') {
        return {
          headline: t('{compliance}% sertifikat dalam batas SLA, di atas target {target}%', { compliance: v('compliance'), target: v('target') }),
          evidence,
          why: t('Layanan sertifikat tepat waktu: {overdue} terlambat dari {open} yang sedang berjalan.', { overdue: v('overdue'), open: v('open') }),
          action: t('Pertahankan, dan pantau backlog agar tidak menumpuk.'),
        };
      }
      return {
        headline: i.severity === 'watch'
          ? t('Kepatuhan SLA {compliance}%, sedikit di bawah target {target}%', { compliance: v('compliance'), target: v('target') })
          : t('Kepatuhan SLA {compliance}%, jauh di bawah target {target}%', { compliance: v('compliance'), target: v('target') }),
        evidence,
        why: t('Perlu menekan sertifikat di luar SLA dari {late} menjadi paling banyak {allowed}; keterlambatan menurunkan kepuasan klien.', { late: v('lateNow'), allowed: v('allowedLate') }),
        action: has(p.worstStage)
          ? t('Tuntaskan dulu {count} sertifikat terlambat di tahap {stage}, tempat keterlambatan terbanyak.', { count: v('worstStageCount'), stage: stageName(t, String(p.worstStage)) })
          : t('Utamakan sertifikat yang terlambat sebelum pekerjaan baru.'),
        decision: t('Pilih: menambah kapasitas di tahap terlambat atau menunda pekerjaan baru sampai sertifikat di luar SLA turun ke {allowed}.', { allowed: v('allowedLate') }),
      };
    }

    case 'overdue_aging': {
      const ratio = n('slaDays') > 0 ? Math.round((n('oldestDays') / n('slaDays')) * 10) / 10 : 0;
      const evidence = n('oldestDays') > 0 ? t('Sertifikat tertua berjalan {days} hari ({ratio}× batas SLA).', { days: v('oldestDays'), ratio }) : undefined;
      if (i.severity === 'risk') {
        return {
          headline: t('{over2x} sertifikat berumur lebih dari 2× batas SLA ({slaDays} hari)', { over2x: v('over2x'), slaDays: v('slaDays') }),
          evidence,
          why: t('Ini kasus paling kritis: klien sudah menunggu lebih dari {days} hari dan risiko komplain tinggi.', { days: n('slaDays') * 2 }),
          action: t('Tuntaskan {over2x} kasus ini lebih dulu dan tetapkan eskalasi otomatis.', { over2x: v('over2x') }),
          decision: t('Tetapkan aturan eskalasi untuk sertifikat yang melewati {days} hari.', { days: n('slaDays') * 2 }),
        };
      }
      return {
        headline: t('{upTo2x} sertifikat sudah melewati batas SLA ({slaDays} hari)', { upTo2x: v('upTo2x'), slaDays: v('slaDays') }),
        evidence,
        why: t('Belum kritis, tetapi menjadi keterlambatan berat bila melewati {days} hari.', { days: n('slaDays') * 2 }),
        action: t('Selesaikan {upTo2x} sertifikat ini sebelum umurnya melewati {days} hari.', { upTo2x: v('upTo2x'), days: n('slaDays') * 2 }),
      };
    }

    case 'backlog': {
      const noPace = p.daysToClear === null || p.daysToClear === undefined;
      return {
        headline: noPace
          ? t('Tidak ada sertifikat selesai dalam 28 hari terakhir, sementara {backlog} masih berjalan', { backlog: v('backlog') })
          : t('Backlog {backlog} sertifikat, sekitar {days} hari untuk menghabiskannya pada laju {rate} per minggu', { backlog: v('backlog'), days: v('daysToClear'), rate: v('weeklyRate') }),
        evidence: t('Periode ini: {inflow} sertifikat masuk, {outflow} selesai.', { inflow: v('inflow'), outflow: v('outflow') }),
        why: join(
          p.growing
            ? t('Sertifikat masuk ({inflow}) melebihi yang selesai ({outflow}), jadi antrean cenderung membesar.', { inflow: v('inflow'), outflow: v('outflow') })
            : t('Antrean saat ini tidak bertambah, tetapi laju penyelesaian menentukan seberapa cepat ia habis.'),
          i.severity !== 'good' && (has(p.paceFactor)
            ? t('Agar habis dalam 30 hari dibutuhkan {rate} sertifikat per minggu, {factor}× laju sekarang.', { rate: v('requiredWeeklyRate30'), factor: v('paceFactor') })
            : t('Agar habis dalam 30 hari dibutuhkan {rate} sertifikat per minggu.', { rate: v('requiredWeeklyRate30') })),
        ),
        action: i.severity === 'good'
          ? t('Pertahankan laju penyelesaian saat ini.')
          : t('Naikkan laju penyelesaian ke sekitar {rate} per minggu, atau batasi pekerjaan baru sampai backlog turun.', { rate: v('requiredWeeklyRate30') }),
        decision: i.severity === 'risk'
          ? t('Pilih: menambah kapasitas hingga sekitar {rate} sertifikat per minggu atau menahan penerimaan pekerjaan baru sampai backlog di bawah {backlog}.', { rate: v('requiredWeeklyRate30'), backlog: Math.max(1, Math.round(n('backlog') / 2)) })
          : undefined,
      };
    }

    case 'pipeline_hold':
      return {
        headline: t('{printed} sertifikat sudah dicetak tetapi belum dikirim ({share}% dari backlog)', { printed: v('printed'), share: v('share') }),
        evidence: join(
          t('{notPrinted} belum dicetak, {printed} dicetak menunggu kirim, {completed} sudah selesai.', { notPrinted: v('notPrinted'), printed: v('printed'), completed: v('completed') }),
          n('oldestDays') > 0 && t('Yang menunggu paling lama: {days} hari sejak dicetak.', { days: v('oldestDays') }),
        ),
        why: t('Sertifikat ini sudah selesai dikerjakan; pengirimanlah yang menahan klien menerima dokumennya, dan {share}% antrean ada di langkah terakhir ini.', { share: v('share') }),
        action: n('oldestDays') > 0
          ? t('Jadwalkan pengiriman untuk {printed} sertifikat ini, mulai dari yang sudah dicetak {days} hari lalu.', { printed: v('printed'), days: v('oldestDays') })
          : t('Jadwalkan pengiriman untuk {printed} sertifikat yang sudah dicetak.', { printed: v('printed') }),
        decision: i.severity === 'risk'
          ? t('Pilih: menambah jadwal pengiriman harian atau mengirim per batch pelatihan, sampai sertifikat yang menunggu kirim di bawah {target}.', { target: Math.max(1, Math.round(n('printed') / 2)) })
          : undefined,
      };

    case 'bottleneck':
      if (p.mode === 'duration') {
        const stage = stageName(t, String(p.stage));
        const ratio = p.otherAvgDays ? Math.round((Number(p.avgDays) / Number(p.otherAvgDays)) * 10) / 10 : null;
        return {
          headline: t('Tahap {stage} paling lama: rata-rata {days} hari per sertifikat ({n} pengamatan)', { stage, days: v('avgDays'), n: v('n') }),
          evidence: ratio ? t('{ratio}× lebih lama dari tahap berikutnya ({other} hari).', { ratio, other: v('otherAvgDays') }) : undefined,
          why: has(p.shareOfTotal)
            ? t('Tahap ini menghabiskan {share}% dari seluruh waktu yang terukur, jadi memperbaikinya paling mempercepat alur.', { share: v('shareOfTotal') })
            : t('Tahap ini menentukan kecepatan seluruh alur; memperbaikinya mempercepat semua sertifikat.'),
          action: t('Periksa kapasitas dan antrean di tahap {stage} lebih dulu; satu hari lebih cepat di sini memangkas waktu semua sertifikat.', { stage }),
        };
      }
      return {
        headline: t('Tahap {stage} menahan {count} sertifikat yang terlambat', { stage: stageName(t, String(p.stage)), count: v('count') }),
        why: t('Keterlambatan menumpuk di satu tahap, sedangkan tahap lain relatif lancar.'),
        action: t('Periksa kapasitas dan proses di tahap {stage} lebih dulu.', { stage: stageName(t, String(p.stage)) }),
      };

    case 'throughput_trend':
      if (i.severity === 'good') {
        return {
          headline: t('Sertifikat selesai naik {pct}% menjadi {current} (sebelumnya {previous})', { pct: v('pct'), current: v('current'), previous: v('previous') }),
          why: t('Kapasitas penyelesaian membaik, yang membantu menurunkan backlog ({backlog} saat ini).', { backlog: v('backlog') }),
          action: t('Pertahankan; pastikan kenaikan ini tidak mengorbankan kualitas.'),
        };
      }
      return {
        headline: t('Sertifikat selesai turun {pct}% menjadi {current} (sebelumnya {previous})', { pct: Math.abs(n('pct')), current: v('current'), previous: v('previous') }),
        why: t('Penurunan {gap} sertifikat selesai menambah backlog ({backlog} saat ini) bila sertifikat yang masuk tidak ikut turun.', { gap: Math.abs(n('current') - n('previous')), backlog: v('backlog') }),
        action: t('Cari penyebabnya: kapasitas, hari libur, atau tahap yang tertahan.'),
      };
  }
}

export function overallCopy(t: TFunction, status: OverallStatus, insights: Insight[]): { title: string; summary: string } {
  const count = (s: Insight['severity']) => insights.filter(i => i.severity === s).length;
  const tally = t('{risks} risiko, {watch} perlu dipantau, {good} sesuai target.', { risks: count('risk'), watch: count('watch'), good: count('good') });
  switch (status) {
    case 'healthy': return { title: t('Kinerja sehat'), summary: `${t('Leads dan sertifikasi berjalan sesuai target.')} ${tally}` };
    case 'attention': return { title: t('Perlu perhatian'), summary: `${t('Ada hal yang perlu dipantau sebelum menjadi masalah.')} ${tally}` };
    case 'action': return { title: t('Perlu tindakan'), summary: `${t('Beberapa indikator utama jauh di bawah target.')} ${tally}` };
    default: return { title: t('Data belum cukup'), summary: t('Belum ada cukup data pada periode ini untuk menarik kesimpulan.') };
  }
}
