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
            'SELECT id, name, email, password_hash FROM users WHERE email = $1',
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
                name: user.name
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
app.listen(port, () => {
    console.log(`\n[WaaAI] Server SISTUNIS running di http://localhost:${port}\n`);
});