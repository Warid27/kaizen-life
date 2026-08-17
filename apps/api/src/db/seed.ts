#!/usr/bin/env bun
/**
 * KaizenLife Seeder
 * ─────────────────────────────────────────────────────────────────────────────
 * Data realistis (Bahasa Indonesia) untuk user `default-user` — user yang
 * dipakai aplikasi web secara hardcode di semua route API.
 *
 * "Real" bukan dummy: semua konten berupa kehidupan nyata mahasiswa pekerja
 * (kuliah + freelance) dengan tanggal relatif terhadap hari ini, sehingga
 * seeder selalu menghasilkan data yang segar dan koheren antar-tabel.
 *
 * Cara pakai (dari apps/api):
 *   bun run src/db/seed.ts            # cetak SQL saja (tanpa eksekusi)
 *   bun run src/db/seed.ts --local    # eksekusi ke D1 lokal (wrangler dev)
 *   bun run src/db/seed.ts --remote   # eksekusi ke D1 produksi (kaizenlife-db)
 *
 * Aman dijalankan ulang: data lama user `default-user` dihapus dulu
 * (idempotent), lalu di-insert ulang dalam satu transaksi per batch.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Konfigurasi (sesuaikan bila perlu)
// ─────────────────────────────────────────────────────────────────────────────
const DB_NAME = "kaizenlife-db";
const USER_ID = "default-user";
const USER_NAME = "Warid";
const USER_EMAIL = "warid@warid.web.id";
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta (UTC+7)

// ─────────────────────────────────────────────────────────────────────────────
// Helper waktu & nilai
// ─────────────────────────────────────────────────────────────────────────────
const NOW = new Date();
const DAY_MS = 86_400_000;

/** YYYY-MM-DD untuk `offsetDays` dari hari ini (zona Jakarta, deterministik). */
const dateStr = (offsetDays: number): string =>
  new Date(NOW.getTime() + offsetDays * DAY_MS + TZ_OFFSET_MS)
    .toISOString()
    .slice(0, 10);

/** Epoch ms untuk `offsetDays` dari hari ini pada jam tertentu (waktu lokal mesin). */
const epochMs = (offsetDays: number, hour = 8, minute = 0): number => {
  const d = new Date(NOW.getTime() + offsetDays * DAY_MS);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};

const uuid = (): string => crypto.randomUUID();

/** PRNG deterministik supaya data antar-run konsisten. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semester (dihitung dari tanggal hari ini)
// ─────────────────────────────────────────────────────────────────────────────
const month = NOW.getMonth(); // 0-11
const year = NOW.getFullYear();
const isGanjil = month >= 7; // Agu–Des → Ganjil, Jan–Jul → Genap

const curStart = isGanjil ? new Date(year, 7, 1) : new Date(year, 1, 1);
const curEnd = isGanjil ? new Date(year + 1, 0, 31) : new Date(year, 6, 31);
const acadYear = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
const semesterLabel = `Semester ${isGanjil ? "Ganjil" : "Genap"} ${acadYear}`;
const prevStart = isGanjil ? new Date(year, 1, 1) : new Date(year - 1, 7, 1);
const prevEnd = isGanjil ? new Date(year, 6, 31) : new Date(year, 0, 31);
const prevLabel = `Semester ${isGanjil ? "Genap" : "Ganjil"} ${isGanjil ? `${year - 1}/${year}` : `${year}/${year + 1}`}`;

const semesterId = uuid();
const prevSemesterId = uuid();
const utsDate = new Date(curStart.getTime() + 70 * DAY_MS);
const uasDate = new Date(curEnd.getTime() - 14 * DAY_MS);

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
const R = mulberry32(20260817);

type Row = (string | number | null)[];
const T = {
  users: [] as Row[],
  semesters: [] as Row[],
  courses: [] as Row[],
  courseSchedule: [] as Row[],
  assignments: [] as Row[],
  semesterEvents: [] as Row[],
  teamMembers: [] as Row[],
  clients: [] as Row[],
  projects: [] as Row[],
  clientFollowups: [] as Row[],
  tasks: [] as Row[],
  habits: [] as Row[],
  habitLogs: [] as Row[],
  checkins: [] as Row[],
  diaryEntries: [] as Row[],
  standups: [] as Row[],
  meetings: [] as Row[],
  meetingActionItems: [] as Row[],
  transactions: [] as Row[],
  goals: [] as Row[],
  monthlyReviews: [] as Row[],
  reminders: [] as Row[],
};

// ─── Users ───────────────────────────────────────────────────────────────────
T.users.push([
  USER_ID,
  USER_NAME,
  USER_EMAIL,
  "Asia/Jakarta",
  epochMs(-240),
  epochMs(0, 7),
  null,
]);

// ─── Semesters ───────────────────────────────────────────────────────────────
T.semesters.push([
  semesterId, USER_ID, semesterLabel,
  toISO(curStart), toISO(curEnd),
  epochMs(-120), epochMs(0), null,
]);
T.semesters.push([
  prevSemesterId, USER_ID, prevLabel,
  toISO(prevStart), toISO(prevEnd),
  epochMs(-240), epochMs(-120), null,
]);

function toISO(d: Date): string {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

// ─── Courses ─────────────────────────────────────────────────────────────────
const courses = [
  ["Pemrograman Web Lanjut", "IF2123", "Budi Santoso, S.Kom., M.Kom.", "Lab Komputer 2", "#3b82f6"],
  ["Basis Data", "IF2111", "Sari Dewi, S.T., M.T.", "Ruang 301", "#22c55e"],
  ["Struktur Data & Algoritma", "IF2024", "Agus Salim, S.Kom., M.T.", "Ruang 204", "#f59e0b"],
  ["Jaringan Komputer", "IF3031", "Rina Marlina, S.T., M.Eng.", "Lab Jaringan 1", "#ef4444"],
  ["Manajemen Proyek TI", "IF3042", "Dedi Kurniawan, S.Kom., M.M.", "Ruang 402", "#8b5cf6"],
].map(([name, code, lecturer, room, color]) => ({
  id: uuid(),
  name,
  code,
  lecturer,
  room,
  color,
}));

for (const c of courses) {
  T.courses.push([
    c.id, USER_ID, semesterId, c.name, c.code, c.lecturer, c.room, c.color,
    epochMs(-120), epochMs(0), null,
  ]);
}

// ─── Course Schedule (Senin=1 … Jumat=5) ────────────────────────────────────
const schedule = [
  [courses[0], 1, "08:00", "09:40"],
  [courses[1], 2, "10:00", "11:40"],
  [courses[2], 3, "13:00", "14:40"],
  [courses[3], 4, "09:00", "10:40"],
  [courses[4], 5, "15:00", "16:40"],
  [courses[1], 5, "13:00", "14:40"], // praktikum Basis Data
];
for (const [course, dow, start, end] of schedule) {
  T.courseSchedule.push([
    uuid(), USER_ID, course.id, dow, start, end, course.room,
    epochMs(-120), epochMs(0), null,
  ]);
}

// ─── Assignments ─────────────────────────────────────────────────────────────
const assignments = [
  // [courseIdx, judul, deskripsi, dueOffset, status, grade]
  [0, "Tugas 1: Form Validasi dengan JavaScript", "Membuat form pendaftaran dengan validasi client-side memakai JavaScript murni.", -5, "submitted", "A"],
  [0, "Tugas 2: Fetch API & Rendering Data", "Ambil data dari REST API publik lalu tampilkan dalam tabel yang bisa diurutkan.", 9, "in_progress", null],
  [1, "Kuis Bab 4: Normalisasi Database", "Kuis 25 soal pilihan ganda tentang 1NF, 2NF, dan 3NF.", -2, "submitted", "B+"],
  [1, "Proyek Tengah Semester: Desain Skema", "Rancang skema ERD untuk sistem perpustakaan kampus, sertakan alasan normalisasi.", 16, "not_started", null],
  [2, "Tugas 2: Implementasi Binary Search Tree", "Implementasikan BST lengkap dengan insert, delete, dan traversal di C++.", 4, "in_progress", null],
  [2, "Tugas 3: Analisis Kompleksitas Sorting", "Bandingkan Insertion Sort vs Merge Sort pada 100.000 data acak, buat laporan singkat.", 23, "not_started", null],
  [3, "Praktikum: Konfigurasi VLAN", "Laporan praktikum konfigurasi VLAN di Cisco Packet Tracer.", -8, "submitted", "A-"],
  [3, "Tugas: Analisis Subnetting", "Hitung subnetting untuk 4 gedung kantor dengan total 512 host.", 12, "not_started", null],
  [4, "Tugas Kelompok: WBS Proyek Sistem Kasir", "Susun Work Breakdown Structure beserta estimasi durasi tiap paket kerja.", 6, "in_progress", null],
  [4, "Makalah: Studi Kasus Gagalnya Proyek IT", "Analisis studi kasus kegagalan proyek IT di Indonesia beserta rekomendasi mitigasi.", 30, "not_started", null],
] as [number, string, string, number, string, string | null][];

// Build with ids kept for later references (reminders)
const assignmentRows: { id: string; row: Row }[] = [];
for (const [ci, title, desc, dueOffset, status, grade] of assignments) {
  const submitted = status === "submitted";
  const id = uuid();
  assignmentRows.push({
    id,
    row: [
      id, USER_ID, courses[ci].id, title, desc, dateStr(dueOffset), "medium",
      status, grade,
      submitted ? epochMs(dueOffset - 1) : epochMs(-20),
      submitted ? epochMs(-1) : epochMs(0),
      null,
    ],
  });
}
for (const { row } of assignmentRows) T.assignments.push(row);

// ─── Semester Events ─────────────────────────────────────────────────────────
T.semesterEvents.push(
  [uuid(), USER_ID, semesterId, "UTS " + semesterLabel, toISO(utsDate), "midterm", epochMs(-100), epochMs(0), null],
  [uuid(), USER_ID, semesterId, "UAS " + semesterLabel, toISO(uasDate), "final", epochMs(-100), epochMs(0), null],
  [uuid(), USER_ID, semesterId, "Tenggat Pengisian KRS", dateStr(12), "deadline", epochMs(-60), epochMs(0), null],
);

// ─── Team Members ────────────────────────────────────────────────────────────
const teamMembers = [
  ["Andi Wijaya", "Frontend Developer"],
  ["Siti Rahayu", "UI/UX Designer"],
  ["Rizky Pratama", "Backend Developer"],
  ["Dewi Lestari", "Project Manager"],
].map(([name, role]) => ({
  id: uuid(),
  name,
  role,
}));

for (const m of teamMembers) {
  T.teamMembers.push([
    m.id, USER_ID, m.name, m.role, 1,
    epochMs(-200), epochMs(0), null,
  ]);
}

// ─── Clients ─────────────────────────────────────────────────────────────────
const clients = [
  ["PT Nusantara Digital", "Perusahaan", "0812-3456-7890 (Pak Hendra)", "Klien utama untuk proyek web; pembayaran termin 50/50."],
  ["Kopi Senja Coffee Shop", "F&B", "0821-9876-5432 (Mbak Rina, owner)", "Butuh aplikasi kasir sederhana; sudah trial manual 1 bulan."],
  ["Mekar Florist", "Retail", "0857-1111-2222 (Ibu Yanti)", "Rujukan dari klien lama; anggaran terbatas, prioritas POS sederhana."],
].map(([name, company, contact, notes]) => ({
  id: uuid(),
  name,
  company,
  contact,
  notes,
}));

for (const c of clients) {
  T.clients.push([
    c.id, USER_ID, c.name, c.company, c.contact, c.notes,
    epochMs(-180), epochMs(0), null,
  ]);
}

// ─── Projects ────────────────────────────────────────────────────────────────
const projects = [
  // [nama, clientIdx|null, status, priority, deadlineOffset, progress, pic, deskripsi]
  ["Website Company Profile PT Nusantara Digital", 0, "active", "high", 21, 65, "Rizky Pratama", "Website 5 halaman dengan CMS sederhana, desain modern, dan optimasi SEO."],
  ["Aplikasi Kasir Kopi Senja", 1, "active", "urgent", 14, 40, "Andi Wijaya", "Aplikasi kasir berbasis web dengan manajemen menu, stok, dan laporan harian."],
  ["Sistem POS Mekar Florist", 2, "planning", "medium", 45, 0, "Rizky Pratama", "POS ringan untuk pencatatan penjualan dan stok bunga; diskusi scope belum final."],
  ["Portofolio Pribadi 2026", null, "completed", "medium", -20, 100, null, "Redesign portofolio pribadi dengan Astro; sudah live di warid.web.id."],
].map(([name, ci, status, priority, deadlineOffset, progress, pic, desc]) => ({
  id: uuid(),
  name,
  clientId: ci === null ? null : clients[ci as number].id,
  status,
  priority,
  deadline: deadlineOffset === null ? null : dateStr(deadlineOffset as number),
  progress,
  pic,
  desc,
}));

for (const p of projects) {
  T.projects.push([
    p.id, USER_ID, p.name, p.clientId, p.status, p.priority,
    p.deadline, p.progress, p.pic, p.desc,
    epochMs(-150), epochMs(0), null,
  ]);
}

// ─── Client Follow-ups ───────────────────────────────────────────────────────
const followups = [
  [clients[0], -1, 3, "pending", "Kirim draft kontrak termin kedua."],
  [clients[1], -6, 7, "pending", "Jadwalkan demo aplikasi kasir."],
  [clients[2], -14, -7, "done", "Diskusi awal kebutuhan POS; sudah ditindaklanjuti via WA."],
];
for (const [client, lastOffset, nextOffset, status, notes] of followups) {
  T.clientFollowups.push([
    uuid(), USER_ID, client.id, dateStr(lastOffset), dateStr(nextOffset), status, notes,
    epochMs(-60), epochMs(0), null,
  ]);
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
const tasks = [
  // [judul, deskripsi, dateOffset, start, end, durMin, priority, status, projectIdx|null, courseIdx|null, tags]
  ["Selesaikan laporan keuangan klien Kopi Senja", "Rekap pemasukan-pengeluaran bulan lalu untuk laporan ke owner.", 0, "09:00", "11:00", 120, "high", "in_progress", 1, null, '["kerja","finansial"]'],
  ["Revisi proposal website Nusantara Digital", "Perbaiki bagian portofolio dan tambah testimoni sesuai masukan klien.", 0, "13:00", "15:00", 120, "high", "todo", 0, null, '["kerja"]'],
  ["Belajar Bab 5: Normalisasi Database", "Baca modul + kerjakan latihan soal 1-10.", 0, "19:00", "20:30", 90, "medium", "todo", null, 1, '["kuliah","basa-data"]'],
  ["Bayar tagihan listrik & internet", "Jangan lupa token listrik sebelum malam.", 0, null, null, 30, "urgent", "todo", null, null, '["rumah"]'],
  ["Persiapan presentasi proyek akhir", "Susun slide dan latihan presentasi 10 menit.", 1, "18:00", "20:00", 120, "high", "in_progress", null, 0, '["kuliah"]'],
  ["Kirim invoice ke Mekar Florist", "Invoice DP 30% untuk proyek POS.", 1, null, null, 15, "medium", "todo", 2, null, '["kerja","finansial"]'],
  ["Olahraga sore di lapangan", "Jogging 30 menit + stretching.", 2, "17:00", "18:00", 60, "low", "todo", null, null, '["kesehatan"]'],
  ["Kuis mingguan struktur data", "Selesaikan kuis online sebelum pukul 23.59.", 3, null, null, 60, "urgent", "todo", null, 2, '["kuliah"]'],
  ["Belanja kebutuhan mingguan", "Beras, minyak, telur, dan kebutuhan dapur.", 3, null, null, 90, "low", "todo", null, null, '["rumah"]'],
  ["Ngerjain tugas WBS kelompok", "Koordinasikan pembagian tugas via grup kelas.", 4, "19:00", "21:00", 120, "medium", "todo", null, 4, '["kuliah","kelompok"]'],
  ["Grooming kucing", "Bawa Milo ke groomer langganan.", 4, "10:00", "11:00", 60, "low", "todo", null, null, '["peliharaan"]'],
  ["Submit laporan praktikum VLAN", "Rapiin format laporan sesuai template lab.", -8, null, null, 90, "medium", "done", null, 3, '["kuliah"]'],
  ["Meeting sprint mingguan", "Sinkronisasi progres dengan tim freelance.", -3, "09:00", "09:45", 45, "high", "done", null, null, '["kerja"]'],
  ["Perbaiki bug halaman login", "Fix validasi email + handling error dari API.", -2, "13:00", "16:00", 180, "urgent", "done", 1, null, '["kerja","bug"]'],
  ["Beres-beres kamar", "Rapikan meja kerja dan lemari.", -1, null, null, 60, "low", "done", null, null, '["rumah"]'],
];
for (const [title, desc, dOffset, start, end, dur, priority, status, pIdx, cIdx, tags] of tasks) {
  const done = status === "done";
  T.tasks.push([
    uuid(), USER_ID, title, desc,
    dateStr(dOffset), start, end, dur, priority, status,
    pIdx === null ? null : projects[pIdx as number].id,
    cIdx === null ? null : courses[cIdx as number].id,
    tags,
    done ? epochMs(dOffset, 20) : null,
    epochMs(Math.min(dOffset, -10)), epochMs(done ? dOffset : 0), null,
  ]);
}

// ─── Habits ──────────────────────────────────────────────────────────────────
const habits = [
  // [nama, icon, kategori, frequency, target, customDays, rateKehadiran]
  ["Olahraga 30 menit", "🏃", "Kesehatan", "daily", 1, null, 0.85],
  ["Membaca buku 20 halaman", "📚", "Pengembangan Diri", "daily", 1, null, 0.75],
  ["Belajar bahasa Inggris", "🇬🇧", "Belajar", "daily", 1, null, 0.7],
  ["Tidur sebelum 23.00", "😴", "Kesehatan", "daily", 1, null, 0.65],
  ["Minum air 2 liter", "💧", "Kesehatan", "daily", 1, null, 0.9],
  ["Menulis jurnal harian", "✍️", "Produktivitas", "daily", 1, null, 0.55],
  ["Jogging pagi", "🌅", "Kesehatan", "weekly_n", 3, null, 0.8],
  ["Push up min 20x", "💪", "Kesehatan", "daily", 1, null, 0.8],
  ["Pull up min 5x", "🏋️", "Kesehatan", "daily", 1, null, 0.7],
  ["Dead hang min 40s", "🧗", "Kesehatan", "daily", 1, null, 0.75],
  ["Plank min 60s", "🧘", "Kesehatan", "daily", 1, null, 0.8],
  ["Body squat min 20x", "🦵", "Kesehatan", "daily", 1, null, 0.85],
  ["Wall sit min 40s", "🪑", "Kesehatan", "daily", 1, null, 0.7],
].map(([name, icon, category, frequency, target, customDays, rate]) => ({
  id: uuid(),
  name,
  icon,
  category,
  frequency,
  target: target as number,
  customDays,
  rate: rate as number,
}));

for (const [i, h] of habits.entries()) {
  T.habits.push([
    h.id, USER_ID, h.name, h.icon, h.category, h.frequency, h.target,
    h.customDays, 1, i,
    epochMs(-90), epochMs(0), null, null,
  ]);
  for (let d = -59; d <= 0; d++) {
    if (h.frequency === "weekly_n") {
      const dow = new Date(NOW.getTime() + d * DAY_MS).getDay();
      if (dow === 0 || dow === 6) continue; // Jogging hanya hari kerja
    }
    if (R() < h.rate) {
      T.habitLogs.push([
        uuid(), USER_ID, h.id, dateStr(d), 1, h.target, null,
        epochMs(d, 21), epochMs(d, 21), null,
      ]);
    }
  }
}

// ─── Check-ins (30 hari terakhir) ────────────────────────────────────────────
const checkinNotes: Record<number, string> = {
  [0]: "Tidur agak larut karena ngerjain tugas, badan masih pegel.",
  [3]: "Lega, presentasi lancar! Semangat buat hari ini.",
  [7]: "Kurang tidur setelah lembur revisi website klien.",
  [11]: "Hujan seharian, mood naik karena bisa kerja dari kos.",
  [14]: "Ujian praktikum berjalan mulus, alhamdulillah.",
  [18]: "Capek banget, habis demo ke klien + pulang macet.",
  [22]: "Badan agak masuk angin, minum vitamin dan istirahat cukup.",
  [26]: "Olahraga pagi bikin seharian lebih fokus!",
};
for (let d = -29; d <= 0; d++) {
  const sleep = 390 + Math.floor(R() * 120); // 6.5–8.5 jam
  T.checkins.push([
    uuid(), USER_ID, dateStr(d),
    "23:" + String(Math.floor(R() * 50)).padStart(2, "0"),
    "0" + (5 + Math.floor(R() * 3)) + ":30",
    Math.floor(R() * 30),
    sleep,
    3 + Math.floor(R() * 3), // kualitas tidur 3-5
    5 + Math.floor(R() * 5), // mood 5-9
    4 + Math.floor(R() * 5), // energi 4-8
    3 + Math.floor(R() * 5), // stres 3-7
    checkinNotes[-d] ?? null,
    epochMs(d, 21), epochMs(d, 21), null,
  ]);
}

// ─── Diary Entries (14 hari terakhir) ────────────────────────────────────────
const diaries = [
  ["Bisa submit laporan praktikum tepat waktu.", "Jangan menunda ngerjain tugas sampai malam.", "Mulai ngerjain tugas WBS kelompok.", "Hari ini cukup produktif walau sempat ngantuk siang."],
  ["Dapat feedback bagus dari dosen soal desain ERD.", "Deadline itu teman, bukan musuh — kalau dipakai bener.", "Revisi proposal klien sebelum jam 3 sore.", ""],
  ["Makan siang bareng teman sekelas setelah sekian lama.", "Quality time itu juga investasi.", "Jalan pagi sebelum kuliah.", ""],
  ["Klien setuju revisi dan lanjut ke tahap berikutnya.", "Komunikasi yang jelas menghemat revisi.", "Persiapan demo aplikasi kasir.", ""],
  ["Berhasil jogging 3 hari berturut-turut!", "Konsistensi kecil lebih baik dari target besar yang bolong.", "Lanjutkan rutinitas olahraga.", ""],
  ["Nilai kuis normalisasi dapat B+.", "Baca materi sebelum kelas itu sangat membantu.", "Belajar bab selanjutnya biar nggak ketinggalan.", ""],
  ["Milo (kucing) sudah sehat setelah ke dokter hewan.", "Perhatian kecil buat orang/peliharaan itu penting.", "Grooming kucing akhir pekan.", ""],
  ["Selesai integrasi payment gateway untuk demo.", "Debugging butuh kesabaran, tapi hasilnya memuaskan.", "Tulis dokumentasi API.", ""],
  ["Ikut webinar karir gratis dari kampus.", "Jaringan itu aset: kenalan 2 orang baru.", "Update LinkedIn dan portofolio.", ""],
  ["Beres-beres kamar dan meja kerja.", "Lingkungan yang rapi bikin pikiran rapi.", "Belanja kebutuhan mingguan.", ""],
  ["Nonton bareng keluarga via video call.", "Jarak bukan halangan buat tetap dekat.", "Telepon mama sore ini.", ""],
  ["Lulus uji coba deploy di staging.", "CI/CD yang rapi menghemat banyak waktu.", "Riset hosting untuk produksi.", ""],
  ["Hemat Rp 50 ribu minggu ini dari bawa bekal.", "Bawa bekal = sehat + hemat.", "Rencanakan menu mingguan.", ""],
  ["Baca 20 halaman buku Atomic Habits.", "Fokus ke sistem, bukan cuma target.", "Terapkan satu kebiasaan baru minggu ini.", ""],
];
for (let i = 0; i < 14; i++) {
  const [grateful, lesson, focus, freeText] = diaries[diaries.length - 1 - i] ?? diaries[0];
  T.diaryEntries.push([
    uuid(), USER_ID, dateStr(i - 13), grateful, lesson, focus, freeText,
    epochMs(i - 13, 22), epochMs(i - 13, 22), null,
  ]);
}

// ─── Standups (5 hari kerja terakhir, 4 anggota tim) ─────────────────────────
const standupPool = [
  ["Mengerjakan halaman login & register", "Selesaikan validasi form", "Validasi form selesai, tinggal styling", null, "on_track"],
  ["Revisi desain dashboard", "Finalisasi komponen UI", "Desain dikirim ke klien untuk review", "Menunggu feedback klien", "at_risk"],
  ["Integrasi API pembayaran", "Selesaikan webhook midtrans", "Webhook beres, tes transaksi sukses", null, "on_track"],
  ["Koordinasi jadwal demo", "Kirim undangan demo ke klien", "Demo dijadwalkan Jumat", null, "on_track"],
  ["Perbaiki bug tampilan mobile", "Fix navbar & tabel responsif", "Navbar beres, tabel masih aneh di layar kecil", "Butuh bantuan styling tabel", "blocked"],
  ["Setup environment staging", "Deploy build terbaru ke staging", "Staging ready, tinggal seed data", null, "on_track"],
  ["Dokumentasi API", "Tulis endpoint baru di Postman", "Selesai 60%", null, "on_track"],
  ["Testing flow checkout", "Tulis test case checkout", "3 dari 8 test case selesai", null, "on_track"],
];
for (let d = -6; d <= 0; d++) {
  const dow = new Date(NOW.getTime() + d * DAY_MS).getDay();
  if (dow === 0 || dow === 6) continue; // lewati akhir pekan
  for (const [mi, member] of teamMembers.entries()) {
    const poolIdx = (((mi * 3 + d) % standupPool.length) + standupPool.length) % standupPool.length;
    const [current, target, result, blocker, status] = standupPool[poolIdx];
    T.standups.push([
      uuid(), USER_ID, member.id, projects[Math.abs(d) % projects.length].id,
      dateStr(d), current, target, result, blocker, status,
      epochMs(d, 9), epochMs(d, 9), null,
    ]);
  }
}

// ─── Meetings + Action Items ─────────────────────────────────────────────────
const meetingDefs = [
  {
    dateOffset: -9,
    agenda: "Kick-off proyek website PT Nusantara Digital",
    decisions: "Scope final 5 halaman. Tech stack disetujui: Astro + Hono. Timeline 4 minggu dengan milestone per minggu.",
    actions: [
      ["Kirim draft kontrak ke Pak Hendra", "Dewi Lestari", 3, "done"],
      ["Siapkan sitemap & wireframe", "Siti Rahayu", -6, "done"],
      ["Setup repository dan CI/CD", "Rizky Pratama", -5, "done"],
    ],
  },
  {
    dateOffset: -2,
    agenda: "Review desain & progres aplikasi kasir",
    decisions: "Flow kasir disederhanakan: langsung ke daftar menu. Nota dicetak via printer thermal bluetooth.",
    actions: [
      ["Implementasi halaman kasir baru", "Andi Wijaya", 5, "open"],
      ["Cari referensi printer thermal yang support web", "Rizky Pratama", 4, "open"],
    ],
  },
  {
    dateOffset: 1,
    agenda: "Sprint planning minggu ini",
    decisions: "Prioritas: selesaikan kasir sebelum fokus ke POS Mekar. Demo internal setiap Jumat 16.00.",
    actions: [
      ["Update backlog dan assign task", "Dewi Lestari", 0, "open"],
    ],
  },
];
const meetingRows: { id: string; row: Row }[] = [];
for (const [mi, m] of meetingDefs.entries()) {
  const meetingId = uuid();
  meetingRows.push({
    id: meetingId,
    row: [
      meetingId, USER_ID, m.dateOffset >= 0 ? null : projects[0].id,
      dateStr(m.dateOffset), m.agenda, m.decisions,
      epochMs(m.dateOffset, 15), epochMs(m.dateOffset, 15), null,
    ],
  });
  for (const [desc, pic, deadlineOffset, status] of m.actions) {
    T.meetingActionItems.push([
      uuid(), USER_ID, meetingId, desc, pic, dateStr(deadlineOffset), status,
      epochMs(m.dateOffset, 15), epochMs(0), null,
    ]);
  }
}
for (const { row } of meetingRows) T.meetings.push(row);

// ─── Transactions (60 hari terakhir, nominal Rupiah × 100) ───────────────────
const txDefs: [number, "income" | "expense", number, string, "cash" | "bank", string | null][] = [
  [-58, "income", 4_500_000, "Gaji freelance bulanan", "bank", "Transfer dari PT Nusantara Digital"],
  [-55, "expense", 1_200_000, "Kos bulanan", "bank", "Transfer ke pemilik kos"],
  [-52, "expense", 350_000, "Tagihan listrik & internet", "bank", "Token listrik + paket wifi"],
  [-49, "expense", 25_000, "Makan siang", "cash", "Nasi padang + es teh"],
  [-47, "expense", 18_000, "Transportasi", "cash", "Gojek ke kampus"],
  [-45, "expense", 150_000, "Buku kuliah", "bank", "Buku Basis Data edisi terbaru"],
  [-42, "expense", 40_000, "Hiburan", "cash", "Nongkrong di Kopi Senja"],
  [-38, "expense", 22_000, "Makan malam", "cash", "Ayam geprek + jus"],
  [-35, "income", 2_500_000, "DP proyek website", "bank", "Termin pertama Nusantara Digital"],
  [-33, "expense", 60_000, "Kesehatan", "cash", "Vitamin + obat masuk angin"],
  [-30, "expense", 30_000, "Transportasi", "cash", "Bensin motor"],
  [-28, "expense", 120_000, "Kebutuhan kos", "cash", "Belanja mingguan di minimarket"],
  [-25, "expense", 45_000, "Makan siang", "cash", "Makan bareng tim freelance"],
  [-21, "expense", 15_000, "Transportasi", "cash", "Angkot pulang kampus"],
  [-18, "expense", 85_000, "Peliharaan", "cash", "Makanan kucing + pasir"],
  [-14, "expense", 200_000, "Pendidikan", "bank", "Biaya praktikum jaringan"],
  [-11, "expense", 20_000, "Hiburan", "cash", "Nonton bioskop (murah Senin)"],
  [-8, "expense", 55_000, "Makan malam", "cash", "Makan pecel lele + es jeruk"],
  [-5, "income", 750_000, "Bonus proyek kecil", "bank", "Jasa perbaikan bug Kopi Senja"],
  [-3, "expense", 95_000, "Kesehatan", "cash", "Konsultasi dokter hewan Milo"],
  [-1, "expense", 130_000, "Kebutuhan kos", "cash", "Belanja beras, minyak, telur"],
  [0, "expense", 10_000, "Transportasi", "cash", "Parkir kampus"],
];
for (const [dOffset, type, amountCents, category, account, note] of txDefs) {
  T.transactions.push([
    uuid(), USER_ID, dateStr(dOffset), type, amountCents, "idr", category, account, note,
    epochMs(dOffset, 19), epochMs(0), null,
  ]);
}

// ─── Goals (hierarki: tahunan → bulanan → mingguan) ─────────────────────────
const goalAnnual = uuid();
const goalMonthly = uuid();
const goalWeeklyStudy = uuid();
const goalWeeklyHabit = uuid();

T.goals.push(
  // Tahunan
  [goalAnnual, USER_ID, "Lulus kuliah tepat waktu dengan IPK minimal 3.5", "annual",
    `${year}-01-01`, `${year}-12-31`, 3.5, 3.42, "IPK", "in_progress", null, null,
    epochMs(-200), epochMs(0), null],
  // Bulanan (anak dari tahunan)
  [goalMonthly, USER_ID, "Menyelesaikan semua tugas kuliah bulan ini", "monthly",
    dateStr(-NOW.getDate() + 1), dateStr(30 - NOW.getDate() + 1), 10, 6, "tugas", "in_progress",
    goalAnnual, null, epochMs(-20), epochMs(0), null],
  [uuid(), USER_ID, "Menabung Rp 1.000.000", "monthly",
    dateStr(-NOW.getDate() + 1), dateStr(30 - NOW.getDate() + 1), 1_000_000, 350_000, "Rupiah", "in_progress",
    null, null, epochMs(-20), epochMs(0), null],
  // Mingguan (anak dari bulanan)
  [goalWeeklyStudy, USER_ID, "Belajar 5 jam untuk mata kuliah semester ini", "weekly",
    dateStr(-6), dateStr(0), 5, 3, "jam", "in_progress", goalMonthly, null,
    epochMs(-7), epochMs(0), null],
  [goalWeeklyHabit, USER_ID, "Olahraga minimal 4 kali minggu ini", "weekly",
    dateStr(-6), dateStr(0), 4, 3, "kali", "in_progress", goalMonthly, habits[0].id,
    epochMs(-7), epochMs(0), null],
);

// ─── Monthly Reviews (3 bulan terakhir) ──────────────────────────────────────
const reviewMonths = [
  // [offsetBulan, pencapaianTerbesar, pelajaranTerbesar, prioritasBulanDepan]
  [-3, "Menyelesaikan proyek portofolio pribadi dan submit 2 laporan praktikum tepat waktu.",
    "Menunda pekerjaan kecil hanya menumpuk beban di akhir bulan.",
    "Konsisten ngerjain tugas harian; mulai persiapan UTS."],
  [-2, "Menambah 1 klien freelance (Kopi Senja) dan stabil di angka 70% kehadiran olahraga.",
    "Klien kecil tetap butuh komunikasi terjadwal, jangan dianggap sepele.",
    "Finalisasi aplikasi kasir; tingkatkan frekuensi olahraga."],
  [-1, "Integrasi payment gateway selesai dan demo kasir diterima klien.",
    "Overcommit di awal bulan bikin jadwal minggu ketiga padat sekali.",
    "Fokus ke WBS kelompok dan jaga waktu tidur."],
];
for (const [mOffset, achievement, lesson, priorities] of reviewMonths) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() + mOffset, 15);
  T.monthlyReviews.push([
    uuid(), USER_ID, d.getFullYear(), d.getMonth() + 1, achievement, lesson, priorities, null,
    epochMs(mOffset * 30, 20), epochMs(0), null,
  ]);
}

// ─── Reminders ───────────────────────────────────────────────────────────────
const upcomingAssignment = assignmentRows.find((a) => a.row[5] > dateStr(0));
const upcomingMeeting = meetingRows.find((m) => m.row[3] > dateStr(0));
T.reminders.push(
  [uuid(), USER_ID, "habit", "habit", habits[4].id, epochMs(0, 20, 0), "pending", epochMs(-3), epochMs(0), null],
  [uuid(), USER_ID, "deadline", "assignment", upcomingAssignment?.id ?? assignmentRows[0].id, epochMs(3, 9, 0), "pending", epochMs(-2), epochMs(0), null],
  [uuid(), USER_ID, "followup", "client_followup", followups[0][0].id, epochMs(3, 10, 0), "pending", epochMs(-2), epochMs(0), null],
  [uuid(), USER_ID, "meeting", "meeting", upcomingMeeting?.id ?? meetingRows[0].id, epochMs(1, 8, 30), "pending", epochMs(-1), epochMs(0), null],
);

// ─────────────────────────────────────────────────────────────────────────────
// Emisi SQL
// ─────────────────────────────────────────────────────────────────────────────
const esc = (v: string): string => v.replaceAll("'", "''");

const toSql = (v: string | number | null): string => {
  if (v === null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${esc(v)}'`;
};

/** Multi-row INSERT — satu statement per tabel. */
const buildInserts = (): string[] => {
  const statements: string[] = [];
  for (const [key, rows] of Object.entries(T) as [keyof typeof T, Row[]][]) {
    if (rows.length === 0) continue;
    const table = TABLE_NAMES[key];
    const columns = tableToColumns[key];
    const values = rows.map((r) => `(${r.map(toSql).join(", ")})`).join(",\n  ");
    statements.push(
      `INSERT INTO "${table}" (${columns.join(", ")})\nVALUES\n  ${values};`,
    );
  }
  return statements;
};

const TABLE_NAMES: Record<keyof typeof T, string> = {
  users: "users",
  semesters: "semesters",
  courses: "courses",
  courseSchedule: "course_schedule",
  assignments: "assignments",
  semesterEvents: "semester_events",
  teamMembers: "team_members",
  clients: "clients",
  projects: "projects",
  clientFollowups: "client_followups",
  tasks: "tasks",
  habits: "habits",
  habitLogs: "habit_logs",
  checkins: "checkins",
  diaryEntries: "diary_entries",
  standups: "standups",
  meetings: "meetings",
  meetingActionItems: "meeting_action_items",
  transactions: "transactions",
  goals: "goals",
  monthlyReviews: "monthly_reviews",
  reminders: "reminders",
};

const tableToColumns: Record<keyof typeof T, string[]> = {
  users: ["id", "name", "email", "timezone", "created_at", "updated_at", "deleted_at"],
  semesters: ["id", "user_id", "name", "start_date", "end_date", "created_at", "updated_at", "deleted_at"],
  courses: ["id", "user_id", "semester_id", "name", "code", "lecturer", "room", "color", "created_at", "updated_at", "deleted_at"],
  courseSchedule: ["id", "user_id", "course_id", "day_of_week", "start_time", "end_time", "room", "created_at", "updated_at", "deleted_at"],
  assignments: ["id", "user_id", "course_id", "title", "description", "due_date", "priority", "status", "grade", "created_at", "updated_at", "deleted_at"],
  semesterEvents: ["id", "user_id", "semester_id", "title", "date", "type", "created_at", "updated_at", "deleted_at"],
  teamMembers: ["id", "user_id", "name", "role", "active", "created_at", "updated_at", "deleted_at"],
  clients: ["id", "user_id", "name", "company", "contact_info", "notes", "created_at", "updated_at", "deleted_at"],
  projects: ["id", "user_id", "name", "client_id", "status", "priority", "deadline", "progress_pct", "pic", "description", "created_at", "updated_at", "deleted_at"],
  clientFollowups: ["id", "user_id", "client_id", "last_contact_date", "next_followup_date", "status", "notes", "created_at", "updated_at", "deleted_at"],
  tasks: ["id", "user_id", "title", "description", "date", "start_time", "end_time", "estimated_duration_min", "priority", "status", "project_id", "course_id", "tags", "completed_at", "created_at", "updated_at", "deleted_at"],
  habits: ["id", "user_id", "name", "icon", "category", "frequency", "target_count_per_period", "custom_days", "active", "sort_order", "created_at", "updated_at", "archived_at", "deleted_at"],
  habitLogs: ["id", "user_id", "habit_id", "date", "completed_count", "target_count", "note", "created_at", "updated_at", "deleted_at"],
  checkins: ["id", "user_id", "date", "bed_time", "wake_time", "nap_minutes", "total_sleep_minutes", "sleep_quality", "mood", "energy", "stress", "note", "created_at", "updated_at", "deleted_at"],
  diaryEntries: ["id", "user_id", "date", "grateful_for", "lesson_learned", "tomorrow_focus", "free_text", "created_at", "updated_at", "deleted_at"],
  standups: ["id", "user_id", "team_member_id", "project_id", "date", "current_task", "today_target", "actual_result", "blocker", "status", "created_at", "updated_at", "deleted_at"],
  meetings: ["id", "user_id", "project_id", "date", "agenda", "decisions", "created_at", "updated_at", "deleted_at"],
  meetingActionItems: ["id", "user_id", "meeting_id", "description", "pic", "deadline", "status", "created_at", "updated_at", "deleted_at"],
  transactions: ["id", "user_id", "date", "type", "amount_cents", "currency", "category", "account", "note", "created_at", "updated_at", "deleted_at"],
  goals: ["id", "user_id", "title", "type", "period_start", "period_end", "target_value", "current_value", "unit", "status", "parent_goal_id", "linked_habit_id", "created_at", "updated_at", "deleted_at"],
  monthlyReviews: ["id", "user_id", "year", "month", "biggest_achievement", "biggest_lesson", "next_month_priorities", "auto_summary_json", "created_at", "updated_at", "deleted_at"],
  reminders: ["id", "user_id", "type", "reference_type", "reference_id", "trigger_at", "status", "created_at", "updated_at", "deleted_at"],
};

const buildSql = (): string => {
  const deletes = Object.entries(TABLE_NAMES)
    .filter(([key]) => key !== "users")
    .map(([, table]) => `DELETE FROM "${table}" WHERE user_id = '${USER_ID}';`);
  deletes.push(`DELETE FROM "users" WHERE id = '${USER_ID}';`);
  return [
    "-- KaizenLife Seed — data realistis Bahasa Indonesia",
    `-- Dihasilkan: ${new Date().toISOString()}`,
    `-- User target: ${USER_ID} (${USER_NAME} <${USER_EMAIL}>)`,
    "",
    "-- 1) Hapus data lama (idempotent)",
    ...deletes,
    "",
    "-- 2) Insert data baru",
    ...buildInserts(),
    "",
  ].join("\n");
};

const summary = (): string => {
  const lines = Object.entries(T)
    .map(([t, rows]) => `  ${t.padEnd(20)} ${String(rows.length).padStart(4)} baris`)
    .join("\n");
  return `\nRingkasan seed:\n${lines}\n`;
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI runner
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const mode = args.includes("--remote") ? "remote" : args.includes("--local") ? "local" : null;

const sql = buildSql();

if (mode === null) {
  console.log(sql);
  console.log(summary());
  console.log(
    "SQL dicetak tanpa eksekusi. Jalankan dengan --local (D1 lokal) atau --remote (D1 produksi).",
  );
} else {
  const apiRoot = resolve(import.meta.dir, "../..");
  const tmpDir = mkdtempSync(join(tmpdir(), "kaizenlife-seed-"));
  const sqlFile = join(tmpDir, "seed.sql");
  writeFileSync(sqlFile, sql);

  console.log(summary());
  console.log(
    `Mengeksekusi seed ke D1 ${mode === "local" ? "LOKAL" : "PRODUKSI (remote)"} (${DB_NAME})...\n`,
  );

  const res = spawnSync(
    process.execPath,
    ["x", "wrangler", "d1", "execute", DB_NAME, mode === "local" ? "--local" : "--remote", "--file", sqlFile],
    { cwd: apiRoot, stdio: "inherit" },
  );
  rmSync(tmpDir, { recursive: true, force: true });

  if (res.status !== 0) {
    console.error(`\nSeeder gagal (exit code ${res.status ?? "unknown"}).`);
    process.exit(res.status ?? 1);
  }
  console.log("\nSeed berhasil. Data siap dipakai aplikasi. 🎉");
}
