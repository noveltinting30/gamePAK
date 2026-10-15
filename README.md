# Ruang Iman — Belajar PAK SMA

Aplikasi belajar lokal berbahasa Indonesia untuk Pendidikan Agama Kristen tingkat SMA. Dibangun dengan React, Vite, Tailwind CSS, dan Dexie.js (IndexedDB).

## Menjalankan aplikasi

```sh
npm install
npm run dev
```

Buka URL lokal yang ditampilkan Vite. Perintah pemeriksaan produksi dan tes logika:

```sh
npm run build
npm run preview
npm test
```

## Fitur

- Permainan Sambung Kata, Kata Rahasia, dan Teka-Teki Silang.
- Latihan CBT dengan pilihan ganda/isian, navigasi soal, penghitung waktu, tinjauan, pembahasan, dan hasil.
- Riwayat permainan/ujian per profil lokal.
- Profil siswa dan guru/admin tanpa autentikasi server.
- Guru dapat menambah dan menghapus materi, soal, rangkaian sambung kata, kata rahasia, teka-teki silang, dan ujian CBT.
- Kisi TTS baru dibentuk dari dua jawaban yang memiliki huruf persilangan; data puzzle tersimpan di IndexedDB.
- Service worker menyimpan halaman dan aset produksi untuk penggunaan offline setelah aplikasi pertama kali berhasil dimuat.
- Data contoh PAK disimpan pada IndexedDB dan dapat diubah melalui aplikasi.

## Catatan penggunaan

Semua data disimpan di perangkat yang sedang digunakan. Hapus data browser dapat menghapus profil, progres, dan konten. Ekspor cadangan secara berkala. Impor cadangan mengganti materi, soal, permainan kata, teka-teki silang, dan ujian yang tersimpan; hasil ujian dan riwayat profil lokal tidak dihapus.

Profil lokal hanya untuk pemisahan tampilan dan bukan sistem keamanan. Aplikasi offline setelah service worker selesai memasang cache produksi; pembukaan pertama memerlukan koneksi. Aplikasi lokal tidak menyediakan pengawasan ujian atau perlindungan terhadap akses ke data browser. Konten contoh harus ditinjau oleh guru sebelum digunakan dalam pembelajaran.
