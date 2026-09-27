/**
 * WhatsApp Template Message & URL Generator
 * BKI Academy Integrated Platform
 */

export function cleanIndonesianPhone(phone: string): string {
  if (!phone) return '';
  // Remove non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export function createWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = cleanIndonesianPhone(phone);
  const encodedText = encodeURIComponent(text.trim());
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

export interface WAMessageParams {
  contactName: string;
  companyName?: string;
  programName: string;
  scheduleDates?: string;
  batchCode?: string;
  formUrl?: string;
  picName?: string;
}

export const WATemplates = {
  // 1. Penawaran Jadwal Training
  scheduleOffer(params: WAMessageParams): string {
    const greeting = params.companyName ? `Bpk/Ibu ${params.contactName} (${params.companyName})` : `Bpk/Ibu ${params.contactName}`;
    const scheduleInfo = params.scheduleDates ? `pada tanggal *${params.scheduleDates}*` : 'dalam waktu dekat';
    const pic = params.picName || 'Tim BKI Academy';

    return `Halo, Selamat Pagi/Siang ${greeting},

Terima kasih atas minat Anda terhadap pelatihan *${params.programName}* di BKI Academy.

Kami menginformasikan bahwa jadwal pelatihan terdekat telah tersedia ${scheduleInfo}. 

Apakah kuota ini ingin kami reservasikan untuk kebutuhan Bapak/Ibu? Mohon informasikan estimasi jumlah peserta yang akan didaftarkan.

Terima kasih,
*${pic}*
BKI Academy`;
  },

  // 2. Pengiriman Link Formulir Pendaftaran
  registrationLink(params: WAMessageParams): string {
    const greeting = `Bpk/Ibu ${params.contactName}`;
    const url = params.formUrl || 'https://bki.academy/register';
    const pic = params.picName || 'Tim BKI Academy';

    return `Halo ${greeting},

Berikut kami kirimkan tautan formulir pendaftaran untuk pelatihan *${params.programName}*:
👉 ${url}

Mohon dapat melengkapi data peserta agar kami dapat memproses registrasi dan penerbitan bukti pendaftaran resmi.

Jika ada kendala dalam pengisian, silakan hubungi kami kembali.

Salam hormat,
*${pic}*
BKI Academy`;
  },

  // 3. Follow-up Pengingat Pendaftaran
  followUpReminder(params: WAMessageParams): string {
    const greeting = `Bpk/Ibu ${params.contactName}`;
    const pic = params.picName || 'Tim BKI Academy';

    return `Halo ${greeting},

Semoga dalam keadaan sehat selalu. 

Kami izin follow-up terkait pendaftaran pelatihan *${params.programName}*. Apakah ada informasi tambahan mengenai jadwal atau kelengkapan berkas yang dapat kami bantu?

Mengingat kuota kelas terbatas, mohon konfirmasi ketersediaan keikutsertaan Anda.

Terima kasih,
*${pic}*
BKI Academy`;
  },

  // 4. Konfirmasi Pendaftaran & Selamat Bergabung
  registrationConfirmed(params: WAMessageParams): string {
    const greeting = `Bpk/Ibu ${params.contactName}`;
    const batchInfo = params.batchCode ? ` (${params.batchCode})` : '';
    const scheduleInfo = params.scheduleDates ? `\n📅 Jadwal: *${params.scheduleDates}*` : '';
    const pic = params.picName || 'Tim BKI Academy';

    return `Halo ${greeting},

Pendaftaran Anda untuk program pelatihan *${params.programName}*${batchInfo} telah *BERHASIL TERKONFIRMASI*.${scheduleInfo}

Detail teknis pelaksanaan (tata tertib, materi, dan tautan akses/ruangan) akan kami kirimkan menjelang hari pelaksanaan.

Selamat bergabung di BKI Academy!

Salam hormat,
*${pic}*
BKI Academy`;
  }
};
