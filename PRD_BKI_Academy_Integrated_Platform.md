# Product Requirements Document
# BKI Academy — Integrated Leads & Certificate Platform

**Versi:** 1.0 · **Tanggal:** 25 September 2026  
**Status:** Draft implementasi berdasarkan kebutuhan pemilik produk  
**Pengguna:** Staf internal BKI Academy  
**Fokus:** Leads & Waiting List, database pusat yang rapi, dan integrasi Certificate Tracker existing.

> **Ketentuan utama: Certificate Tracker sudah siap dari sisi UI/UX, frontend, data existing, dan alur operasional menurut konfirmasi pemilik produk. Modul ini dipertahankan. Pekerjaan pada modul sertifikat dibatasi pada penyesuaian path bila diperlukan, navigasi, akses akun, dan penghubung data. Tidak ada mandat untuk mendesain ulang atau membangun ulang Certificate Tracker.**

## 1. Ringkasan produk

BKI Academy membutuhkan satu platform internal untuk mengelola leads dan waiting list sekaligus mengakses Certificate Tracker yang sudah berjalan. Kedua modul menggunakan fondasi data bersama, tetapi memiliki workflow masing-masing.

Platform harus mengurangi follow-up yang terlupakan, menunjukkan training dengan banyak peminat, serta membangun database yang bisa digunakan kembali untuk marketing, sales, dan sistem baru di masa depan.

Integrasi tidak berarti satu lead otomatis menjadi peserta. Lead dapat mewakili PIC perusahaan yang menghubungi BKI untuk beberapa orang. Peserta dapat masuk langsung melalui bulk import sertifikat tanpa pernah tercatat sebagai lead. Relasi langsung antara lead dan peserta bersifat opsional dan hanya dibuat jika diketahui.

**Keputusan produk:** satu platform, satu database utama secara logis, data master bersama, dan dua modul operasional mandiri. Struktur fisik database dapat dikembangkan bertahap tanpa memutus penggunaan Certificate Tracker existing.

## 2. Dasar kebutuhan dan batas kepastian

### 2.1 Kebutuhan yang sudah dikonfirmasi

- Leads masuk dari WhatsApp bisnis dan WhatsApp pribadi staf.
- Satu entri biasanya mewakili PIC perusahaan atau perorangan untuk satu kebutuhan training; tersedia jumlah peserta yang diminati.
- Setiap staf memiliki akun dan tanggung jawab atas leads masing-masing.
- Jika jadwal tersedia, staf mengirim link pendaftaran dan calon peserta mengisi formulir.
- Jika jadwal belum tersedia atau calon peserta melakukan reschedule, data masuk waiting list.
- PIC mencatat detail jadwal dan kebutuhan pelanggan dalam catatan.
- Aksi paling penting adalah perubahan progres yang cepat; tersedia kebutuhan pesan link pendaftaran dan konfirmasi terdaftar.
- Completed pada tracker leads berarti peserta sudah mengikuti training dan training telah selesai.
- Data sertifikat diinput secara massal; nomor sertifikat biasanya tersedia setelah training selesai.
- Tidak semua lead menjadi peserta dan tidak semua peserta berasal dari tracker leads.
- Pengguna internal lebih sering menggunakan laptop; halaman baru harus responsif.
- Kerapian dan kemudahan migrasi data merupakan tujuan utama, selain efisiensi operasional.

### 2.2 Sumber rancangan

PRD ini menggunakan klarifikasi pengguna dan dokumen `SYSTEM_ARCHITECTURE_AND_ROADMAP.md`. Dokumen arsitektur menjelaskan Next.js, React, TypeScript, Supabase, serta entitas trainings, participants, certificates, dan certificate_history.

Kesiapan Certificate Tracker ditetapkan sebagai baseline produk sesuai konfirmasi pengguna. PRD ini bukan hasil audit kode, keamanan, atau database produksi. Detail implementasi existing perlu dibaca pengembang sebelum penyesuaian dilakukan; temuan teknis tidak otomatis mengubah scope menjadi pembangunan ulang.

## 3. Tujuan dan ukuran keberhasilan

| Tujuan | Ukuran | Ketentuan |
|---|---|---|
| Follow-up tidak terlupakan | Jumlah lead aktif tanpa PIC/tanggal tindak lanjut; jumlah follow-up terlambat | Lead aktif baru wajib memiliki PIC dan tindak lanjut; pengecualian data migrasi masuk antrean perbaikan |
| Pemetaan peminat | Peluang aktif dan estimasi peserta per jenis training | Angka peluang, estimasi peserta, dan peserta aktual dibedakan |
| Input dan progres lebih cepat | Waktu input lead dan jumlah interaksi untuk aksi rutin | Perubahan progres yang datanya lengkap dapat dilakukan satu klik dari daftar |
| Data lebih rapi | Jumlah kandidat duplikat dan data yang belum terpetakan | Tidak ada penggabungan orang otomatis hanya berdasarkan nama |
| Migrasi lebih mudah | Kelengkapan ekspor, dokumentasi, dan uji pemulihan | Ekspor mempertahankan ID, relasi, riwayat, serta referensi file |
| Certificate Tracker tetap berjalan | Hasil uji regresi workflow existing | Bulk import, detail batch, status, history, laporan, dan ekspor tetap berfungsi |

Target penurunan keterlambatan dan penghematan waktu ditetapkan setelah baseline penggunaan diukur. Tidak menetapkan angka keberhasilan bisnis tanpa data awal.

## 4. Ruang lingkup

### 4.1 MVP: pekerjaan baru

1. Modul Leads & Waiting List: input cepat, daftar, pencarian, filter, detail, aksi progres, PIC, catatan, dan riwayat.
2. Daftar pekerjaan harian: follow-up jatuh tempo, terlambat, dan lead yang belum memiliki tindak lanjut.
3. Rekap minat per training, jumlah peluang, dan estimasi peserta.
4. Template pesan WhatsApp untuk jadwal, link, follow-up, serta konfirmasi pendaftaran.
5. Fondasi data master: perusahaan, orang/kontak, jenis training, dan batch.
6. Import leads lama dengan pratinjau, validasi, pemetaan status, serta jejak sumber data.
7. Pengelolaan akses staf dan pembagian tanggung jawab lintas modul.
8. Ekspor data portabel dan dokumentasi struktur data.

### 4.2 Existing: dipertahankan

| Area Certificate Tracker | Ketentuan |
|---|---|
| UI/UX dan frontend | Sudah siap; gunakan komponen, tata letak, dan interaksi existing |
| Data sertifikat dan peserta | Dipertahankan termasuk ID, nomor, status, tanggal, PIC, dan riwayat |
| Bulk import existing | Tetap menjadi jalur utama input sertifikat; tidak mensyaratkan data leads |
| Kanban/perubahan status | Perilaku existing tetap berjalan |
| Perhitungan progres dan SLA | Tidak diubah oleh PRD ini |
| Laporan, history, dan ekspor existing | Dipertahankan |
| Path, sidebar, breadcrumb, tautan internal | Disesuaikan hanya untuk penyatuan platform |

### 4.3 Pengembangan lanjutan

- Bulk update nomor sertifikat bagi peserta yang sudah tercatat lebih awal, jika kebutuhan ini diaktifkan dan belum didukung existing.
- Hubungan langsung lead dengan keikutsertaan peserta untuk atribusi konversi yang terverifikasi.
- Integrasi formulir pendaftaran, sumber leads otomatis, dan notifikasi eksternal.
- Pencatatan pembayaran terperinci, invoice, dan integrasi keuangan.
- Segmentasi marketing lanjutan dan pengelolaan kampanye.

### 4.4 Di luar scope MVP

Redesign Certificate Tracker, pembuatan ulang frontend sertifikat, LMS, portal peserta, portal trainer, payment gateway, generator sertifikat baru, verifikasi QR publik, serta pengiriman broadcast otomatis.

## 5. Pengguna dan akses

Role berikut merupakan default rancangan yang dapat dikonfigurasi. Satu akun dapat memiliki lebih dari satu role.

| Peran | Akses utama |
|---|---|
| Admin platform | Mengelola akun, master data, pemetaan/duplikat, import, ekspor, dan pengalihan PIC |
| Staf leads | Mengelola leads miliknya, melakukan follow-up, mencatat progres, dan memakai kontak yang diizinkan |
| PIC sertifikat | Menggunakan Certificate Tracker sesuai akses existing |
| Supervisor | Melihat ringkasan tim dan detail yang diizinkan; hak edit diberikan secara terpisah |

Default halaman leads adalah **Pekerjaan Saya**. Daftar lintas staf mengikuti izin. Identitas PIC internal terhubung ke akun staf; PIC pelanggan terhubung ke data kontak. Keduanya tidak menggunakan kolom yang sama.

Pembatasan akses diterapkan pada layanan/database, bukan hanya menyembunyikan tombol. Akses existing PIC sertifikat tidak boleh hilang akibat pengenalan role baru.

## 6. Struktur navigasi dan path

### 6.1 Menu produk

| Menu | Konten |
|---|---|
| Dashboard | Ringkasan sesuai peran dan akses menuju pekerjaan |
| Leads & Waiting List | Daftar peluang, waiting list, tindak lanjut, riwayat |
| Training & Batch | Master program dan pelaksanaan training |
| Certificate Tracker | Halaman serta workflow existing |
| Kontak & Perusahaan | Direktori bersama dan riwayat yang diizinkan |
| Laporan | Rekap leads baru serta laporan sertifikat existing |
| Pengaturan | Akun, role, master, dan konfigurasi tindak lanjut |

### 6.2 Rekomendasi route

Strategi default adalah mempertahankan route Certificate Tracker existing untuk mengurangi perubahan. Namespace baru digunakan untuk modul leads. Tabel ini adalah kontrak rancangan, bukan instruksi untuk mengganti seluruh route.

| Fungsi | Path usulan | Perlakuan |
|---|---|---|
| Ringkasan platform | `/dashboard` | Pertahankan tampilan existing bagi role sertifikat; ringkasan leads ditambahkan sesuai peran |
| Leads | `/crm/leads` | Halaman baru |
| Detail lead | `/crm/leads/[id]` | Halaman atau panel detail baru |
| Waiting list | `/crm/waiting-list` | Tampilan terfilter atas data leads yang sama |
| Pekerjaan follow-up | `/crm/follow-ups` | Halaman baru |
| Rekap peminat | `/crm/reports` | Halaman baru |
| Kontak dan perusahaan | `/directory/contacts`, `/directory/companies` | Halaman baru |
| Katalog training | `/programs` | Master program bersama |
| Batch dan detail batch | `/trainings`, `/trainings/[id]` | Pertahankan halaman existing |
| Sertifikat | `/certificates` | Pertahankan |
| History/laporan sertifikat | `/history-logs`, `/reports` | Pertahankan |
| Pengaturan | `/settings/*` | Gunakan existing; perluas sesuai kebutuhan |

Jika route existing harus dipindah, sediakan redirect dari URL lama, pertahankan parameter yang relevan, dan perbarui sidebar, breadcrumb, tautan detail, serta callback autentikasi. Route baru tidak boleh mengubah arti data atau status sertifikat.

## 7. Workflow leads dan waiting list

### 7.1 Input cepat

Isian minimum: nama kontak, satu cara menghubungi yang valid, jenis training, dan sumber lead. Perusahaan opsional untuk perorangan. Jumlah peserta boleh belum diketahui; tidak otomatis diisi satu untuk kebutuhan perusahaan.

PIC internal terisi dari akun yang sedang login. Tanggal masuk terisi saat input baru. Sistem menawarkan penggunaan kontak existing bila ditemukan kandidat yang sesuai. Catatan, batch, dan preferensi periode dapat ditambahkan kemudian.

Lead aktif wajib memiliki tindakan berikutnya dan tanggal pengecekan. Sistem dapat menyediakan default yang dapat diubah agar input tetap singkat. Detail preferensi jadwal tetap boleh ditulis di catatan; pilihan bulan merupakan isian opsional.

### 7.2 Status utama

| Status | Definisi | Aksi lanjutan umum |
|---|---|---|
| Baru | Kebutuhan masuk dan belum ditindaklanjuti | Catat link terkirim atau masukkan waiting list |
| Waiting List | Menunggu jadwal, pilihan periode, atau reschedule | Tawarkan jadwal atau catat link terkirim |
| Jadwal Ditawarkan | Jadwal sudah ditawarkan dan menunggu tanggapan | Catat link terkirim, follow-up, atau kembali waiting list |
| Link Terkirim | Link pendaftaran benar-benar sudah dikirim | Follow-up atau konfirmasi terdaftar |
| Terdaftar | Pendaftaran sudah diperiksa dan dikonfirmasi PIC | Pantau pelaksanaan, reschedule, atau selesaikan |
| Selesai Training | Keikutsertaan dan selesainya training sudah dikonfirmasi PIC | Arsip operasional; riwayat tetap tersedia |
| Batal | Kebutuhan training tersebut tidak dilanjutkan | Aktifkan kembali bila diperlukan |

Jadwal Ditawarkan dapat dilewati bila PIC langsung mengirim link. Tidak perlu memaksa staf melewati status yang tidak relevan. Status pembayaran tidak menjadi bagian dari urutan ini.

Reschedule menggunakan status Waiting List dengan alasan terstruktur **Reschedule**. Batch sebelumnya disimpan dalam riwayat, bukan dihapus. Lead berstatus Baru sampai Terdaftar dianggap aktif selama masih ada tindak lanjut yang menjadi tanggung jawab PIC.

### 7.3 Aksi progres dan pesan

| Aksi | Perilaku |
|---|---|
| Buka WA: kirim link | Membuka pesan siap kirim; tidak langsung mencatat bahwa pesan sudah terkirim |
| Tandai link terkirim | Memperbarui status, aktor, waktu, riwayat, dan jadwal follow-up |
| Konfirmasi terdaftar | Setelah pemeriksaan formulir; memilih batch jika belum tersedia dan mencatat jumlah terkonfirmasi bila diketahui |
| Pesan konfirmasi pendaftaran | Membuka template ucapan terdaftar; terpisah dari pencatatan status |
| Sudah follow-up | Menyimpan aktivitas; hasil dan tindak lanjut berikutnya memakai pilihan singkat/default |
| Follow-up besok | Memindahkan tugas terbuka ke tanggal berikutnya; tidak menggandakan tugas yang sama |
| Waiting list / reschedule | Memilih alasan dan mencatat kebutuhan; riwayat batch terjaga |
| Selesai training | Konfirmasi PIC; tidak otomatis karena tanggal akhir batch lewat |
| Batal | Memerlukan alasan singkat; menutup tugas aktif untuk peluang tersebut |
| Undo | Mengembalikan perubahan rutin yang masih aman, dengan jejak audit baru |

Satu klik berlaku ketika informasi yang dibutuhkan sudah lengkap. Batch, alasan batal, atau data wajib yang belum tersedia ditanyakan melalui dialog kecil. Tidak menggunakan wizard panjang untuk aktivitas rutin.

### 7.4 Lead perusahaan dengan beberapa peserta

Lead menyimpan estimasi peserta, jumlah terkonfirmasi menurut PIC, dan bila diperlukan jumlah selesai menurut PIC. Angka ini merupakan rekap operasional lead, bukan pengganti daftar peserta sertifikat.

Contoh: estimasi lima, terkonfirmasi tiga. Dua kursi tersisa tetap terlihat sebagai kebutuhan belum diputuskan. Jika kebutuhan dua kursi dipindah, sistem dapat membuat lead lanjutan terkait dan memindahkan alokasi kursi tersebut; jangan menggandakan estimasi aktif pada kedua lead. Pembatalan sebagian dicatat sebagai penutupan sisa kebutuhan.

Selesai Training pada level lead digunakan setelah kebutuhan kelompok tersebut sudah diselesaikan atau sisa kebutuhannya dipisahkan/ditutup. Lead tidak otomatis selesai hanya karena satu peserta selesai training.

### 7.5 Follow-up dan pending

Antrean kerja menyediakan filter: terlambat, hari ini, link terkirim belum terdaftar, waiting list, reschedule, belum punya PIC, dan belum punya tanggal tindak lanjut. Waiting list dengan batch tersedia diberi kandidat kecocokan berdasarkan jenis training dan periode terstruktur jika ada; sistem tidak menyimpulkan preferensi secara pasti dari catatan bebas.

Pending berarti masih memerlukan tindakan dan ditampilkan menurut alasannya. Total pending dihitung dari lead unik; kartu kategori yang tumpang tindih tidak dijumlahkan. Menunggu pembayaran dapat dicatat sebagai alasan tindak lanjut manual tanpa menyatakan pembayaran telah diverifikasi.

Pengingat MVP tampil di aplikasi. Notifikasi email/WA di luar aplikasi merupakan pengembangan terpisah; MVP tidak menjanjikan pengiriman saat aplikasi ditutup. Semua waktu kerja ditampilkan dalam zona Asia/Jakarta.

## 8. Fondasi database pusat

### 8.1 Model data konseptual

Nama di bawah merupakan nama logis. Pengembang dapat mempertahankan tabel existing dan menggunakan relasi tambahan atau adapter; tidak wajib mengganti nama atau ID data sertifikat.

| Entitas | Informasi penting | Hubungan |
|---|---|---|
| Akun staf | ID, nama, role, status aktif | Menjadi PIC dan aktor aktivitas |
| Perusahaan | ID, nama baku, alias penulisan | Terhubung ke orang dan transaksi |
| Orang/kontak | ID, nama, kanal kontak, sumber data | Dapat menjadi PIC pelanggan dan/atau peserta |
| Afiliasi orang–perusahaan | Orang, perusahaan, peran, periode jika diketahui | Mendukung perpindahan perusahaan tanpa menghapus sejarah |
| Jenis training | ID, nama baku, kode, alias | Digunakan leads dan batch |
| Batch | ID existing, jenis training, kode batch, jadwal, lokasi, PIC | Digunakan modul existing dan lead yang sudah memilih jadwal |
| Lead | ID, kontak, perusahaan terkait, program, batch opsional, jumlah, status, sumber, PIC, catatan | Relasi ke peserta opsional |
| Aktivitas dan tugas lead | Lead, aktor, aksi, waktu, jatuh tempo, hasil | Mendukung audit dan antrean kerja |
| Keikutsertaan peserta | ID, orang, batch, perusahaan pada saat training, sumber | Dapat dibuat dari bulk import setelah training |
| Sertifikat | ID existing, peserta/batch, jenis, nomor, status, waktu, PIC | Relasi existing dipertahankan; pemetaan ke keikutsertaan ditambahkan bila dibutuhkan |
| Riwayat sertifikat | ID existing, status lama/baru, aktor, waktu, catatan | Dipertahankan utuh |
| Import dan pemetaan asal | ID proses, sumber, ID/baris lama, hasil, versi pemetaan | Menelusuri migrasi dan mencegah penggandaan |

### 8.2 Aturan kualitas data

1. Gunakan ID internal yang tetap. Nomor sertifikat, nama, nomor telepon, dan nomor baris Excel bukan primary key identitas orang.
2. Satu orang dapat memiliki beberapa kontak; nomor WA bersama milik perusahaan bukan bukti bahwa semua peserta adalah orang yang sama.
3. Normalisasi nomor telepon untuk pencarian. Simpan nilai sumber bila dibutuhkan untuk penelusuran.
4. Nama perusahaan dan training dipetakan ke master dan alias. Kemiripan nama hanya menghasilkan kandidat pemeriksaan.
5. Kontak boleh tidak memiliki perusahaan. Informasi yang belum diketahui tetap null/belum diketahui.
6. Tanggal kejadian lama yang tidak diketahui tidak diganti dengan tanggal migrasi; waktu import disimpan terpisah.
7. Perubahan master identitas tidak boleh diam-diam mengubah nama/perusahaan historis pada catatan sertifikat yang sudah diterbitkan. Simpan snapshot historis atau sumber existing yang setara.
8. Penggabungan duplikat dilakukan oleh pengguna berwenang dengan pratinjau relasi terdampak dan pemetaan ID lama ke ID yang dipertahankan.
9. Data yang direferensikan riwayat diarsipkan, bukan dihapus berantai.
10. Sumber WA bisnis/pribadi, PIC internal, dan kontak pelanggan menggunakan atribut berbeda.
11. Flag tidak ingin menerima promosi dapat dicatat; daftar marketing mengecualikan kontak tersebut.

### 8.3 Hubungan dengan Certificate Tracker existing

Bangun pemetaan antara participants existing dan identitas orang pusat. Pertahankan ID participants, trainings, certificates, serta certificate_history. Jika satu identitas masih meragukan, tandai untuk pemeriksaan; jangan memblokir seluruh alur sertifikat yang sudah valid.

Keikutsertaan dapat diturunkan dari pasangan peserta–batch existing. Satu keikutsertaan dapat memiliki lebih dari satu jenis sertifikat. Tidak boleh menganggap semua sertifikat dengan peserta dan batch sama sebagai duplikat tanpa memeriksa jenis dan aturan existing.

Pembuatan keikutsertaan tidak mewajibkan input peserta sebelum training. Bulk import pascatraining tetap dapat membentuk peserta, keikutsertaan, serta sertifikat sekaligus di belakang layar.

## 9. Import, migrasi, dan portabilitas

### 9.1 Import leads lama

Sediakan upload, pemetaan kolom, pratinjau, validasi per baris, lalu penyimpanan. Status lama dipetakan: potensi → Baru atau Waiting List setelah konteks diperiksa; Reschedule → Waiting List dengan alasan Reschedule; Cancel → Batal; Completed → Selesai Training. Sudah isi link dipetakan menjadi Terdaftar hanya bila pendaftaran sudah diverifikasi; selain itu masuk antrean pemeriksaan.

Status yang bertentangan dengan catatan tidak diselesaikan otomatis. Data kontak yang sebenarnya berisi email atau teks lain dipisahkan/ditandai. Pertahankan catatan asli dan referensi sumber.

### 9.2 Import sertifikat existing

Format dan langkah pengguna existing dipertahankan. Integrasi master dilakukan di lapisan pengolahan data bila diperlukan. Setiap penyesuaian harus menjaga validasi dan hasil existing serta menambahkan pencegahan duplikasi bila masih diperlukan.

Hasil import membedakan data baru, cocok existing, kandidat duplikat, konflik, dan baris gagal. Baris gagal tidak boleh hilang diam-diam. Jika implementasi existing menggunakan penyimpanan sebagian, hasil sukses/gagal harus jelas dan retry tidak menggandakan baris yang sudah berhasil.

Import ulang sumber yang sama tidak boleh menambah sertifikat identik. Perubahan terhadap nomor/status existing memerlukan identifikasi target yang pasti dan pratinjau. Kolom kosong tidak otomatis menghapus nilai lama.

Bulk update nomor sertifikat merupakan fitur bersyarat: gunakan template peserta/keikutsertaan yang memiliki ID stabil dan jenis sertifikat. Pembaruan hanya mengenai kolom yang dipilih, bukan membuat ulang seluruh batch.

### 9.3 Migrasi bertahap

1. Inventaris tabel, file sumber, route, aturan import, dan relasi existing.
2. Ambil backup yang dapat dipulihkan; siapkan lingkungan uji.
3. Tambahkan master dan pemetaan secara aditif. Jangan langsung menghapus kolom atau tabel lama.
4. Jalankan normalisasi/pemetaan pada salinan data dan buat daftar pengecualian.
5. Rekonsiliasi ID, jumlah data, nomor sertifikat, status, riwayat, serta relasi; seluruh selisih harus memiliki penjelasan.
6. Uji workflow sertifikat existing dan workflow leads sebelum aktivasi.
7. Saat cutover, gunakan jendela perubahan singkat atau sinkronisasi perubahan terakhir agar input baru tidak tertinggal.
8. Aktifkan platform dengan rencana rollback. Jika sudah ada transaksi baru setelah cutover, rollback harus membawa transaksi tersebut atau direkonsiliasi; tidak sekadar memulihkan backup lama.

### 9.4 Ekspor dan backup

Sediakan ekspor per entitas dalam CSV/JSON dengan ID dan foreign key. Paket migrasi mencakup kamus data, daftar status, versi skema, zona waktu, jumlah baris, pemetaan ID lama, riwayat, serta manifest file/lampiran. File disertakan atau tersedia melalui mekanisme pemindahan; tautan sementara saja tidak cukup.

Backup mencakup database dan file yang diperlukan. Uji pemulihan pada lingkungan terpisah menjadi gate kesiapan migrasi. Kredensial rahasia tidak dimasukkan ke ekspor operasional.

## 10. UI/UX halaman baru

- Ikuti bahasa visual existing: warna, tipografi, komponen, dan pola navigasi. Certificate Tracker menjadi referensi konsistensi.
- Desktop menggunakan tabel ringkas dengan kontak/perusahaan, training, jumlah peserta, status, PIC, follow-up, dan dua atau tiga aksi kontekstual.
- Detail lead dapat dibuka sebagai panel tanpa kehilangan posisi daftar/filter.
- Pencarian mendukung nama, perusahaan, nomor kontak, dan training. Filter minimal: PIC, status, training, batch, sumber, serta jatuh tempo.
- Waiting list adalah tampilan dari entitas lead yang sama, bukan salinan data.
- Mobile menampilkan kartu ringkas; tombol utama mudah diakses dan formulir tidak memerlukan scroll horizontal.
- Tampilkan status loading, kosong, error, sukses, dan konflik perubahan. Warna status disertai label teks.
- Pilihan bulan/periode training yang belum diketahui tidak dipaksakan; tanggal tindak lanjut tetap terstruktur.
- Aksi rutin menyediakan Undo jika aman. Undo yang bertabrakan dengan perubahan terbaru ditolak dengan penjelasan dan opsi memuat ulang.

## 11. Laporan dan aturan angka

| Metrik | Definisi |
|---|---|
| Peluang aktif | Jumlah lead unik pada status aktif sesuai filter |
| Estimasi peserta | Jumlah kursi yang masih diminati; jumlah tidak diketahui dilaporkan terpisah |
| Waiting list | Lead aktif berstatus Waiting List beserta estimasi kursinya |
| Terdaftar menurut PIC | Rekap jumlah terkonfirmasi pada leads; diberi label sumber yang jelas |
| Peserta tercatat per batch | Jumlah keikutsertaan unik hasil data peserta, bukan jumlah sertifikat |
| Sertifikat | Jumlah dokumen sertifikat; satu peserta dapat memiliki beberapa jenis |
| Follow-up terlambat | Tugas terbuka dengan jatuh tempo yang sudah lewat |
| Training paling diminati | Peringkat berdasarkan peluang aktif dan estimasi peserta, ditampilkan terpisah |

Jangan menganggap peserta sertifikat pasti berasal dari leads dalam batch yang sama. Atribusi konversi lead-ke-peserta hanya dihitung untuk relasi yang terverifikasi. Perbandingan jumlah leads dan peserta tanpa hubungan langsung diberi label sebagai dua ukuran berbeda.

## 12. Persyaratan operasional

- Pengguna mendapatkan konfirmasi tersimpan hanya setelah penyimpanan pusat berhasil.
- Draft lokal, jika digunakan, harus berlabel belum tersinkron; tidak menjadi sumber kebenaran bersama.
- Perubahan progres dan audit harus konsisten. Klik ganda/retry tidak membuat aktivitas atau transaksi ganda.
- Edit bersamaan tidak boleh diam-diam menimpa perubahan terbaru; gunakan deteksi konflik atau perilaku setara.
- Pengalihan PIC menyertakan tugas terbuka dan riwayat; menonaktifkan akun tidak menghapus aktor lama.
- Daftar memiliki pagination dan filter agar tetap dapat digunakan saat volume meningkat.
- Sasaran awal performa: daftar/filter rutin tampil dalam dua detik pada data uji representatif dan jaringan kantor yang disepakati. Ukuran data serta hasil pengukuran dicatat saat validasi.
- Kemampuan sinkronisasi antarstaf diuji secara terpisah; event dalam satu tab browser tidak dianggap sebagai bukti sinkronisasi antarperangkat.

## 13. Tahapan implementasi

| Tahap | Hasil | Gate selesai |
|---|---|---|
| 0. Inventaris existing | Peta route, data, import, akses, dan baseline Certificate Tracker | Batas perubahan terdokumentasi |
| 1. Fondasi data | Master, ID/pemetaan, akses, dokumentasi, backup | Uji pemetaan dan pemulihan berhasil tanpa merusak data existing |
| 2. Penyatuan platform | Navigasi, akun, dan penyesuaian path seperlunya | Workflow Certificate Tracker lulus regresi |
| 3. Leads MVP | Input, status, waiting list, tugas, WA, riwayat, rekap | Skenario kerja PIC lulus UAT |
| 4. Migrasi dan peluncuran | Import data lama, rekonsiliasi, ekspor lengkap | Selisih dijelaskan, pengecualian terlihat, rollback siap |
| 5. Pengembangan lanjutan | Bulk update tambahan, form, atribusi, notifikasi eksternal | Diprioritaskan berdasarkan penggunaan nyata |

Estimasi durasi ditentukan setelah tahap inventaris; PRD tidak mengasumsikan ukuran codebase atau kapasitas tim pengembang.

## 14. Acceptance criteria

| ID | Skenario | Kriteria lulus |
|---|---|---|
| AC-01 | HR meminta lima peserta | Tercatat satu lead dengan kontak HR dan estimasi lima; HR tidak otomatis menjadi peserta |
| AC-02 | Peserta tanpa leads | Bulk import sertifikat sukses tanpa wajib membuat lead |
| AC-03 | Lead tidak jadi ikut | Dapat dibatalkan tanpa membuat peserta/sertifikat |
| AC-04 | Orang mengikuti training lain | Identitas terverifikasi dipakai kembali; keikutsertaan berbeda tetap terpisah |
| AC-05 | Nomor WA bersama/nama sama | Tidak otomatis menggabungkan identitas peserta |
| AC-06 | Link dibuka melalui WA | Status tetap sampai pengiriman dikonfirmasi staf |
| AC-07 | Aksi progres lengkap | Satu klik memperbarui status, aktor, waktu, audit, dan tugas sesuai aturan |
| AC-08 | Reschedule | Waiting list aktif, alasan tercatat, riwayat batch sebelumnya tetap ada |
| AC-09 | Pendaftaran sebagian | Estimasi lima dan terkonfirmasi tiga terlihat; dua sisanya tidak hilang atau dihitung ganda |
| AC-10 | Training selesai | Lead tidak otomatis selesai hanya karena tanggal batch lewat |
| AC-11 | Follow-up | Lead aktif baru memiliki PIC/jadwal; data migrasi yang belum lengkap masuk antrean perbaikan |
| AC-12 | Import ulang | Sertifikat/keikutsertaan identik tidak bertambah; konflik dan kegagalan ditampilkan |
| AC-13 | Data historis | Nomor, status, PIC, tanggal, ID dan history sertifikat existing terjaga |
| AC-14 | UI/UX sertifikat | Tampilan dan workflow existing tetap berfungsi; hanya perubahan integrasi yang disepakati diterapkan |
| AC-15 | URL lama | Route tetap berfungsi atau redirect ke tujuan yang benar dengan konteks data terjaga |
| AC-16 | Perhitungan dashboard | Lead, estimasi kursi, keikutsertaan, dan jumlah sertifikat tidak dicampur |
| AC-17 | Akses dan konkurensi | Role bekerja; perubahan pengguna lain tidak ditimpa diam-diam |
| AC-18 | Koneksi gagal | Tidak muncul konfirmasi tersimpan pusat untuk perubahan yang gagal disimpan |
| AC-19 | Ekspor migrasi | Data dapat direkonstruksi beserta relasi dan referensi file pada lingkungan uji |
| AC-20 | Responsif | Halaman leads dapat dioperasikan di laptop dan mobile; aksi utama serta isian dapat diakses |

## 15. Asumsi implementasi yang perlu dikonfigurasi

Butir berikut bukan alasan untuk menunda penyusunan fondasi; gunakan default yang dinyatakan dan tetapkan sebelum peluncuran.

| Keputusan | Default rancangan |
|---|---|
| Kapan dianggap terdaftar | PIC memeriksa formulir dan mengonfirmasi; pembayaran dipisahkan |
| Interval follow-up | Dapat diatur admin dan diubah per lead; nilai awal ditetapkan tim operasional |
| Visibilitas antarstaf | Staf mengedit lead sendiri; supervisor/admin melihat tim sesuai izin |
| Penentuan selesai training | Konfirmasi PIC berdasarkan keikutsertaan, bukan tanggal saja |
| Preferensi jadwal | Catatan bebas; bulan/periode terstruktur opsional |
| Form pendaftaran | Form existing tetap digunakan pada MVP |
| Bulk update nomor sertifikat | Ditambahkan hanya jika dibutuhkan; bulk import existing tetap prioritas |
| Lokasi menu sertifikat | Route existing dipertahankan sejauh memungkinkan |

## 16. Arahan untuk pengembang

**Bangun modul leads dan fondasi data bersama dengan mempertahankan Certificate Tracker yang sudah siap.** Mulai dengan membaca implementasi existing dan membuat perubahan aditif. Penyesuaian route, navigasi, akun, serta relasi data harus menjaga UI/UX, frontend, bulk import, dan data sertifikat existing.

Jangan mewajibkan lead sebagai prasyarat peserta, jangan menjadikan kontak HR otomatis sebagai peserta, dan jangan menggabungkan identitas berdasarkan nama saja. Jangan menghapus atau mengganti ID existing untuk memaksakan skema baru. Setiap perubahan di luar batas integrasi tersebut harus dicatat sebagai perubahan scope tersendiri.
