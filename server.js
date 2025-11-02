// File: server.js (UPDATED CODE - Tambah Endpoint API)

const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/auth');

dotenv.config();

const app = express();
const port = 3000;

// ===================================
// === 🟢 MIDDLEWARE BARU (WAJIB) ===
// ===================================
app.use(express.json()); // Menerima data JSON dari request body
app.use(cors());         // Mengizinkan akses dari domain luar (frontend)
// ===================================

// ... (Bagian Pool Konfigurasi tetap sama) ...
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: 5432,
});

// Root: Test koneksi DB
app.get('/', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() AS current_time');
        client.release();

        const dbTime = (result.rows[0] && result.rows[0].current_time) || 'unknown';
        res.send(`Weew, WaaAI SISTUNIS Berhasil Running... ✅ KONEKSI RDS SUCCESS! Database Time: ${dbTime}`);
    } catch (err) {
        res.status(500).send(`🚨 ERROR KONEKSI RDS: ${err.message}`);
    }
});

// =======================================================
// === 🟢 PROTEKSI API: AMBIL SEMUA DATA USER (CONTOH) ===
// =======================================================
// PASANG 'auth' SEBAGAI ARGUMEN KEDUA!
app.get('/api/users', auth, async (req, res) => {
    try {
        const client = await pool.connect();

        // Di sini, kita tahu req.user sudah ada karena lolos middleware!
        console.log(`User ID yang mengakses: ${req.user.id}`);

        const result = await client.query('SELECT id, name, email, created_at FROM users ORDER BY id ASC LIMIT 100');
        client.release();

        res.json({
            status: "success",
            message: `Halo, ${req.user.name}! Data berhasil diambil dari RDS!`, // Pesan Personal
            data: result.rows
        });
    } catch (err) {
        console.error('Error fetching users:', err.stack);
        res.status(500).json({
            status: "error",
            message: "Gagal query database",
            error: err.message
        });
    }
});
// =======================================================

// ================================================
// === 🟢 ENDPOINT BARU: REGISTER USER (POST) ===
// ================================================
app.post('/api/users/register', async (req, res) => {
    let client;
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ status: 'error', message: 'Name, email, dan password wajib diisi, bro!' });
        }

        // 1. ENKRIPSI PASSWORD!
        const salt = await bcrypt.genSalt(10); // Menghasilkan "garam"
        const password_hash = await bcrypt.hash(password, salt); // Hashing password

        client = await pool.connect();

        // 2. INSERT HASH BARU KE KOLOM password_hash
        const result = await client.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
            [name, email, password_hash] // <--- Tambahkan password_hash
        );

        res.status(201).json({
            status: 'success',
            message: 'Registrasi berhasil! Password sudah dienkripsi!',
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Database INSERT error', err);
        if (err.code === '23505') {
            return res.status(409).json({ status: 'error', message: 'Email sudah terdaftar, bro!' });
        }
        res.status(500).json({ status: 'error', message: 'Gagal saat registrasi', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// ================================================

// ===========================================
// === 🟢 ENDPOINT FINAL: LOGIN USER (JWT) ===
// ===========================================
app.post('/api/users/login', async (req, res) => {
    let client;
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email dan password wajib diisi, bro!' });
        }

        client = await pool.connect();

        // 1. Cari user berdasarkan email & ambil password_hash
        const userResult = await client.query(
            // 🟢 TAMBAH role_id DI SINI!
            'SELECT id, name, email, password_hash, role_id FROM users WHERE email = $1',
            [email]
        );

        const user = userResult.rows[0];

        // Cek user & hash
        if (!user || !user.password_hash) {
            // Berikan pesan error generik agar tidak membocorkan informasi
            return res.status(401).json({ status: 'error', message: 'Email atau password salah, bro!' });
        }

        // 2. VERIFIKASI PASSWORD DENGAN BCRYPT!
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Email atau password salah, bro!' });
        }

        // 3. GENERATE JSON WEB TOKEN (JWT)
        // Payload token berisi data user yang tidak sensitif
        const payload = {
            user: {
                id: user.id,
                name: user.name,
                // 🟢 TAMBAH ROLE_ID DI PAYLOAD UNTUK CHECK HAK AKSES
                role_id: user.role_id
            }
        };

        // Signature JWT: ENTE HARUS ganti 'SISTUNIS_SECRET_KEY' ini
        // dengan string yang sangat panjang dan rahasia di file .env!
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }, // Token kedaluwarsa dalam 1 jam
            (err, token) => {
                if (err) throw err;

                // 4. KIRIM TOKEN KE FRONTEND!
                res.status(200).json({
                    status: 'success',
                    message: 'Login berhasil! Token siap digunakan!',
                    token // <-- Kunci akses frontend selanjutnya!
                });
            }
        );

    } catch (err) {
        console.error('Database LOGIN error', err);
        res.status(500).json({ status: 'error', message: 'Gagal saat login', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// ===========================================

// ===================================================
// === 🟢 ENDPOINT BARU: MEMBUAT POSTINGAN (POST) ===
// ===================================================
app.post('/api/posts', auth, async (req, res) => {
    let client;
    try {
        // req.user.id didapat dari middleware 'auth' (payload JWT)
        const user_id = req.user.id;
        const { title, content } = req.body;

        // 🚨 VALIDASI DASAR
        if (!title || !content) {
            return res.status(400).json({ status: 'error', message: 'Judul dan konten wajib diisi, bro!' });
        }

        client = await pool.connect();

        // 1. INSERT data ke tabel posts
        const result = await client.query(
            'INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, title, content, created_at',
            [user_id, title, content]
        );

        res.status(201).json({
            status: 'success',
            message: `Postingan berhasil dibuat oleh User ID: ${user_id}!`,
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Database POST error', err);
        // Jika user_id tidak valid (walaupun harusnya tidak terjadi jika lolos auth)
        if (err.code === '23503') {
            return res.status(400).json({ status: 'error', message: 'User ID tidak valid, bro!' });
        }
        res.status(500).json({ status: 'error', message: 'Gagal saat membuat postingan', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// ===================================================

// =========================================================
// === 🟢 ENDPOINT BARU: MENGAMBIL SEMUA POSTINGAN (GET) ===
// =========================================================
app.get('/api/posts', async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // 1. Ambil data Posts, JOIN dengan tabel Users
        // Kita tampilkan nama user (u.name) dan email
        const result = await client.query(`
            SELECT 
                p.id, 
                p.title, 
                p.content, 
                p.created_at,
                p.user_id,
                usr.name AS author_name,
                usr.email AS author_email
            FROM 
                posts p
            JOIN 
                users usr ON p.user_id = usr.id  
            ORDER BY 
                p.created_at DESC
        `);

        res.status(200).json({
            status: 'success',
            message: 'Semua postingan berhasil diambil!',
            total: result.rowCount,
            data: result.rows
        });

    } catch (err) {
        console.error('Database GET posts error', err);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil data postingan', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =========================================================

// ===============================================
// === 🟢 CEK ROLE: ADMIN TU (role_id = 3) ===
// ===============================================

const ADMIN_TU_ROLE_ID = 3;

const isAdminTu = (req, res, next) => {
    // req.user adalah data dari payload JWT (setelah lolos middleware 'auth')
    if (req.user && req.user.role_id === ADMIN_TU_ROLE_ID) {
        next(); // Lanjut ke fungsi handler (berhak akses)
    } else {
        // Jika user tidak punya role_id atau role_id-nya bukan Admin TU
        return res.status(403).json({
            status: "error",
            message: "Weew, Akses Ditolak. Ente tidak punya izin Admin TU, bro!"
        });
    }
};

// =======================================================
// === 🟢 ENDPOINT BARU: SCAN QR CODE SANTRI (GET DATA) ===
// =======================================================
// Diproteksi oleh 'auth' (valid JWT) dan 'isAdminTu' (Role Check)
app.post('/api/scanner/scan', auth, isAdminTu, async (req, res) => {
    let client;
    try {
        const { qr_code_uid } = req.body;
        const executed_by_user_id = req.user.id; // Admin TU yang sedang bertugas

        if (!qr_code_uid) {
            return res.status(400).json({ status: 'error', message: 'QR Code wajib diisi, bro!' });
        }

        client = await pool.connect();

        // 1. Cari Santri berdasarkan QR Code UID
        const result = await client.query(
            'SELECT id, name, nis, saldo_uang_saku, wali_santri_id FROM students WHERE qr_code_uid = $1',
            [qr_code_uid]
        );

        const student = result.rows[0];

        if (!student) {
            return res.status(404).json({ status: 'error', message: 'Santri dengan QR Code tersebut tidak ditemukan, bro.' });
        }

        // 2. Response: Data Santri + Saldo
        res.status(200).json({
            status: 'success',
            message: `Halo, ${student.name}! Admin ID: ${executed_by_user_id} siap bertransaksi.`,
            data: {
                student_id: student.id,
                name: student.name,
                nis: student.nis,
                current_balance: student.saldo_uang_saku,
                // Kita tampilkan opsi pengambilan berdasarkan Saldo
                allowance_options: [7000, 10000, 15000, 20000].filter(n => n <= parseFloat(student.saldo_uang_saku))
            }
        });

    } catch (err) {
        console.error('Error Scan QR:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat memproses scan QR', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// ==========================================================
// === 🟢 ENDPOINT BARU: AMBIL UANG SAKU HARIAN (WITHDRAW) ===
// ==========================================================
// Diproteksi oleh 'auth' (valid JWT) dan 'isAdminTu' (Role Check)
app.post('/api/scanner/withdraw', auth, isAdminTu, async (req, res) => {
    let client;
    try {
        const { qr_code_uid, nominal } = req.body;
        // ID Admin TU yang sedang bertugas, diambil dari payload JWT
        const executed_by_user_id = req.user.id;
        const parsedNominal = parseFloat(nominal);

        // 🚨 Validasi Input
        if (!qr_code_uid || isNaN(parsedNominal) || parsedNominal <= 0) {
            return res.status(400).json({ status: 'error', message: 'QR Code dan Nominal yang valid wajib diisi, bro!' });
        }

        // Cek apakah nominal sesuai aturan harian (Rp7.000, Rp10.000, dst.)
        const validNominals = [7000, 10000, 15000, 20000];
        if (!validNominals.includes(parsedNominal)) {
            return res.status(400).json({ status: 'error', message: 'Weew, Nominal tidak valid. Harus 7000, 10000, 15000, atau 20000.' });
        }

        client = await pool.connect();

        // 🔑 START TRANSACTION BLOCK (Penting untuk Keuangan!)
        await client.query('BEGIN');

        // 1. Ambil Santri dan Saldo Saat Ini
        const studentResult = await client.query(
            'SELECT id, name, saldo_uang_saku FROM students WHERE qr_code_uid = $1 FOR UPDATE', // Kunci row Santri agar tidak diubah proses lain (Penting!)
            [qr_code_uid]
        );

        const student = studentResult.rows[0];

        if (!student) {
            await client.query('ROLLBACK'); // Batalkan jika Santri tidak ditemukan
            return res.status(404).json({ status: 'error', message: 'Santri dengan QR Code tersebut tidak ditemukan, bro.' });
        }

        const balanceBefore = parseFloat(student.saldo_uang_saku);

        // 2. Cek Saldo
        if (balanceBefore < parsedNominal) {
            await client.query('ROLLBACK'); // Batalkan jika saldo kurang
            return res.status(400).json({
                status: 'error',
                message: `Weew, Saldo ${student.name} tidak cukup (${balanceBefore} kurang dari ${parsedNominal}).`
            });
        }

        // 3. Hitung Saldo Baru & Update Saldo Santri
        const balanceAfter = balanceBefore - parsedNominal;

        await client.query(
            'UPDATE students SET saldo_uang_saku = $1 WHERE id = $2',
            [balanceAfter, student.id]
        );

        // 4. Catat Transaksi (Audit Trail!)
        await client.query(
            `INSERT INTO transactions 
            (student_id, executed_by_user_id, transaction_type, nominal, balance_before, balance_after, is_daily_allowance, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'Pengambilan uang saku harian')`,
            [student.id, executed_by_user_id, 'cash_withdrawal', parsedNominal, balanceBefore, balanceAfter]
        );

        // 🔑 END TRANSACTION BLOCK
        await client.query('COMMIT');

        res.status(200).json({
            status: 'success',
            message: `Weew, Transaksi SUKSES! ${student.name} mengambil ${parsedNominal}.`,
            data: {
                student_id: student.id,
                name: student.name,
                nominal_taken: parsedNominal,
                balance_before: balanceBefore,
                balance_after: balanceAfter // Saldo yang baru
            }
        });

    } catch (err) {
        // Jika terjadi error di tengah proses, lakukan rollback
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Database WITHDRAW error:', err.stack);
        res.status(500).json({ status: 'error', message: '🚨 ERROR FATAL: Transaksi gagal di sistem!', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// ==========================================================

// Middleware untuk Mudiir (ID 2) atau Admin TU (ID 3)
const isFinanceAuditor = (req, res, next) => {
    // req.user.role_id: 2 (Mudiir) atau 3 (Admin TU)
    if (req.user && (req.user.role_id === 2 || req.user.role_id === 3)) {
        next();
    } else {
        res.status(403).json({ status: "error", message: "Akses Ditolak. Ente bukan Mudiir/Admin TU, bro!" });
    }
};

// =======================================================
// === 🟢 ENDPOINT BARU: HISTORY TRANSAKSI (AUDIT) ===
// =======================================================
app.get('/api/transactions/history', auth, isFinanceAuditor, async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // Query untuk mengambil data gabungan dari 3 tabel
        const historyQuery = `
            SELECT 
                t.transaction_time,
                s.name AS student_name,
                u.name AS executed_by_name,
                t.transaction_type,
                t.nominal,
                t.balance_after,
                t.notes
            FROM transactions t
            JOIN students s ON t.student_id = s.id
            JOIN users u ON t.executed_by_user_id = u.id
            ORDER BY t.transaction_time DESC
            LIMIT 20;
        `;

        const result = await client.query(historyQuery);

        res.status(200).json({
            status: 'success',
            message: 'Data history transaksi keuangan berhasil diambil.',
            data: result.rows
        });

    } catch (err) {
        console.error('Error mengambil history:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat mengambil data history.', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// =======================================================
// === 🟢 ENDPOINT: CREATE CLASS ===
// =======================================================
app.post('/api/classes', auth, isFinanceAuditor, async (req, res) => {
    let client;
    try {
        const { class_name, level, description } = req.body;

        if (!class_name || !level) {
            return res.status(400).json({ status: 'error', message: 'Nama Kelas dan Jenjang wajib diisi, bro!' });
        }

        client = await pool.connect();

        const insertQuery = `
            INSERT INTO classes (class_name, level, description)
            VALUES ($1, $2, $3)
            RETURNING id, class_name, level;
        `;

        const result = await client.query(insertQuery, [class_name, level, description]);

        res.status(201).json({
            status: 'success',
            message: 'Kelas baru berhasil ditambahkan!',
            data: result.rows[0]
        });

    } catch (err) {
        if (err.code === '23505') { // Error code for unique violation
            return res.status(409).json({ status: 'error', message: 'Nama Kelas sudah ada, bro!' });
        }
        console.error('Error CREATE CLASS:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat menambahkan kelas.', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// =======================================================
// === 🟢 ENDPOINT: READ ALL CLASSES ===
// =======================================================
app.get('/api/classes', auth, isFinanceAuditor, async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        const result = await client.query('SELECT id, class_name, level, description FROM classes ORDER BY level, class_name');

        res.status(200).json({
            status: 'success',
            message: 'Daftar kelas berhasil diambil.',
            data: result.rows
        });

    } catch (err) {
        console.error('Error READ ALL CLASSES:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat mengambil daftar kelas.', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// =======================================================
// === 🟢 ENDPOINT: READ SINGLE CLASS ===
// =======================================================
app.get('/api/classes/:id', auth, isFinanceAuditor, async (req, res) => {
    let client;
    try {
        const { id } = req.params;

        client = await pool.connect();

        const result = await client.query('SELECT id, class_name, level, description FROM classes WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Kelas tidak ditemukan, bro!' });
        }

        res.status(200).json({
            status: 'success',
            message: 'Data kelas berhasil diambil.',
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Error READ SINGLE CLASS:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat mengambil data kelas.', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

const IS_WALI_SANTRI_ROLE_ID = 5;

const isWaliSantri = (req, res, next) => {
    // Memastikan user yang mengakses punya role_id = 5
    if (req.user && req.user.role_id === IS_WALI_SANTRI_ROLE_ID) {
        next(); // Lanjut jika Role-nya benar
    } else {
        res.status(403).json({
            status: "error",
            message: "Akses Ditolak. Weew, Ente bukan Wali Santri, bro!"
        });
    }
};
// =======================================================
// =======================================================
// === 🟢 ENDPOINT: GET SANTRI BY WALI SANTRI ID ===
// =======================================================
// Hanya bisa diakses oleh Wali Santri (ID 5)
app.get('/api/students/mine', auth, isWaliSantri, async (req, res) => {
    let client;
    try {
        // ID user yang login (ID Wali Santri) diambil dari payload JWT
        const wali_santri_id = req.user.id;

        client = await pool.connect();

        // 1. Cari Santri yang wali_santri_id-nya sesuai dengan ID user yang login
        const result = await client.query(
            'SELECT id, name, nis, saldo_uang_saku, qr_code_uid FROM students WHERE wali_santri_id = $1',
            [wali_santri_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'warning',
                message: 'Tidak ada data santri yang terhubung dengan akun ini, bro.'
            });
        }

        // 2. Response: Data Santri + Saldo
        res.status(200).json({
            status: 'success',
            message: `Berhasil mengambil ${result.rows.length} data santri anak ente.`,
            data: result.rows
        });

    } catch (err) {
        console.error('Error GET students/mine:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat memproses permintaan data santri', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// =======================================================
// === 🟢 ENDPOINT: HISTORY TRANSAKSI KHUSUS WALI SANTRI ===
// =======================================================
app.get('/api/transactions/mine', auth, isWaliSantri, async (req, res) => {
    let client;
    try {
        const wali_santri_id = req.user.id; // ID Wali Santri dari JWT (misalnya ID 7)
        client = await pool.connect();

        // STEP 1: Ambil SEMUA ID Santri yang terhubung ke Wali ini
        const studentResult = await client.query(
            'SELECT id, name FROM students WHERE wali_santri_id = $1',
            [wali_santri_id]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                status: 'warning',
                message: 'Weew, tidak ada data santri terhubung untuk mengambil history, bro.'
            });
        }

        // Buat array dari ID Santri yang ditemukan (misalnya: [1, 5, 8])
        const studentIds = studentResult.rows.map(row => row.id);

        // Ubah array ID menjadi format string yang aman untuk SQL IN clause
        // Contoh: $1, $2, $3...
        const placeholders = studentIds.map((_, i) => `$${i + 1}`).join(', ');

        // STEP 2: Ambil SEMUA Transaksi untuk ID Santri di atas
        const historyQuery = `
            SELECT 
                t.transaction_time,
                s.name AS student_name,
                u.name AS executed_by_name,
                t.transaction_type,
                t.nominal,
                t.balance_after,
                t.notes
            FROM transactions t
            JOIN students s ON t.student_id = s.id
            JOIN users u ON t.executed_by_user_id = u.id
            WHERE t.student_id IN (${placeholders})  -- FILTER HANYA TRANSAKSI ANAK MEREKA
            ORDER BY t.transaction_time DESC
            LIMIT 50;
        `;

        const result = await client.query(historyQuery, studentIds);

        res.status(200).json({
            status: 'success',
            message: 'History transaksi anak berhasil diambil.',
            data: result.rows
        });

    } catch (err) {
        console.error('Error GET transactions/mine:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil history transaksi.', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// =======================================================
// === 🟢 ENDPOINT BARU: ATTENDANCE (FINAL LOGIC) ===
// =======================================================
app.post('/api/scanner/attendance', auth, isAdminTu, async (req, res) => {
    let client;
    try {
        // Menerima activity_id dari frontend. Jika tidak ada, default-nya ID 1 (PONDOK)
        const { qr_code_uid, activity_id = 1 } = req.body;
        const executed_by_user_id = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Ambil data Santri dan Aktivitas (JOIN)
        const dataRes = await client.query(
            `SELECT 
                s.id AS student_id, s.name AS student_name, 
                a.activity_code, a.activity_name, a.is_daily
             FROM students s
             JOIN activities a ON a.id = $2
             WHERE s.qr_code_uid = $1`,
            [qr_code_uid, activity_id]
        );

        if (dataRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'QR Code Santri atau Activity ID tidak valid, bro!' });
        }
        const { student_id, student_name, activity_code, activity_name, is_daily } = dataRes.rows[0];

        // 2. Cek apakah sudah ada record untuk TANGGAL DAN AKTIVITAS ini
        const checkRes = await client.query(
            'SELECT check_in_time, check_out_time FROM attendance WHERE student_id = $1 AND date = $2 AND activity_id = $3',
            [student_id, today, activity_id]
        );

        if (is_daily) {
            // =================================================
            // LOGIC PONDOK (PONDOK/KEGIATAN HARIAN): CHECK-IN / CHECK-OUT
            // =================================================
            if (checkRes.rows.length === 0) {
                // INSERT CHECK-IN
                await client.query('INSERT INTO attendance (student_id, executed_by_user_id, check_in_time, date, activity_id) VALUES ($1, $2, NOW(), $3, $4)', [student_id, executed_by_user_id, today, activity_id]);
                await client.query('COMMIT');
                return res.status(201).json({ status: 'success', message: `Absen Masuk ${activity_name} SUKSES! Halo ${student_name}.`, data: { status: 'check_in' } });
            } else if (!checkRes.rows[0].check_out_time) {
                // UPDATE CHECK-OUT
                await client.query('UPDATE attendance SET check_out_time = NOW() WHERE student_id = $1 AND date = $2 AND activity_id = $3', [student_id, today, activity_id]);
                await client.query('COMMIT');
                return res.status(200).json({ status: 'success', message: `Absen Pulang ${activity_name} SUKSES! Sampai jumpa ${student_name}.`, data: { status: 'check_out' } });
            } else {
                // SUDAH SELESAI PONDOK
                await client.query('ROLLBACK');
                return res.status(409).json({ status: 'warning', message: `Weew, ${student_name} sudah absen Masuk dan Pulang ${activity_name} hari ini, bro!` });
            }
        } else {
            // =================================================
            // LOGIC NON-RUTIN (RIHLAH, SOSIAL, DLL.): HANYA CHECK-IN
            // =================================================
            if (checkRes.rows.length === 0) {
                // INSERT CHECK-IN (HANYA SEKALI)
                await client.query('INSERT INTO attendance (student_id, executed_by_user_id, check_in_time, date, activity_id) VALUES ($1, $2, NOW(), $3, $4)', [student_id, executed_by_user_id, today, activity_id]);
                await client.query('COMMIT');
                return res.status(201).json({ status: 'success', message: `Absen Kegiatan ${activity_name} SUKSES! ${student_name} tercatat hadir.`, data: { status: 'check_in_activity' } });
            } else {
                // SUDAH ABSEN KEGIATAN
                await client.query('ROLLBACK');
                return res.status(409).json({ status: 'warning', message: `Weew, ${student_name} sudah tercatat hadir di kegiatan ${activity_name} hari ini, bro!` });
            }
        }

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Error Absensi:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat memproses absensi.', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// =======================================================
// === 🟢 ENDPOINT: CRUD MASTER ACTIVITIES ===
// =======================================================

// A. READ ALL Activities
app.get('/api/activities', auth, isFinanceAuditor, async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT id, activity_name, activity_code, is_daily FROM activities ORDER BY is_daily DESC, activity_name');
        res.status(200).json({ status: 'success', message: 'Daftar aktivitas berhasil diambil.', data: result.rows });
    } catch (err) {
        console.error('Error READ ACTIVITIES:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat mengambil daftar aktivitas.', error: err.message });
    } finally {
        if (client) client.release();
    }
});

// B. CREATE New Activity
app.post('/api/activities', auth, isFinanceAuditor, async (req, res) => {
    let client;
    try {
        const { activity_name, activity_code, is_daily = false } = req.body;
        if (!activity_name || !activity_code) {
            return res.status(400).json({ status: 'error', message: 'Nama dan Kode Aktivitas wajib diisi, bro!' });
        }
        client = await pool.connect();
        const insertQuery = 'INSERT INTO activities (activity_name, activity_code, is_daily) VALUES ($1, $2, $3) RETURNING id, activity_name, activity_code, is_daily';
        const result = await client.query(insertQuery, [activity_name, activity_code.toUpperCase(), is_daily]);
        res.status(201).json({ status: 'success', message: 'Aktivitas baru berhasil ditambahkan!', data: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ status: 'error', message: 'Nama atau Kode Aktivitas sudah ada, bro!' });
        }
        console.error('Error CREATE ACTIVITY:', err.stack);
        res.status(500).json({ status: 'error', message: 'Gagal saat menambahkan aktivitas.', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// =======================================================

// Mulai server
app.listen(port, () => {
    console.log(`\n[WaaAI] Server SISTUNIS running di http://localhost:${port}\n`);
});