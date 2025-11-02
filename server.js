// File: server.js (UPDATED CODE - Tambah Endpoint API)

const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');

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

// API: ambil semua users
app.get('/api/users', async (req, res) => {
    try {
        const client = await pool.connect();
        // ambil kolom yang memang ada di DB
        const result = await client.query('SELECT id, name, email, created_at FROM users ORDER BY id ASC LIMIT 100');
        client.release();

        res.json({
            status: "success",
            message: "Data berhasil diambil dari RDS!",
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
        // Ambil data dari body request (harus ada express.json())
        const { name, email, password } = req.body;

        // 🚨 VALIDASI DASAR: Pastikan data terkirim
        if (!name || !email || !password) {
            return res.status(400).json({ status: 'error', message: 'name, email, dan password wajib diisi, bro!' });
        }

        client = await pool.connect();

        // ⚠️ CATATAN: Karena kita belum pakai bcrypt, kita simpan password polos dulu
        const result = await client.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
            [name, email] // Data yang akan di-insert
        );

        res.status(201).json({
            status: 'success',
            message: 'Registrasi berhasil! User baru sudah masuk database!',
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Database INSERT error', err);

        // Handle error jika username/email sudah ada (UNIQUE constraint)
        if (err.code === '23505') {
            return res.status(409).json({ status: 'error', message: 'Username atau email sudah terdaftar, bro!' });
        }

        res.status(500).json({ status: 'error', message: 'Gagal saat registrasi', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// ================================================
// ===========================================
// === 🟢 ENDPOINT BARU: LOGIN USER (POST) ===
// ===========================================
app.post('/api/users/login', async (req, res) => {
    let client;
    try {
        // Ambil email dan password dari body
        const { email, password } = req.body;

        // 🚨 VALIDASI DASAR
        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email dan password wajib diisi, bro!' });
        }

        client = await pool.connect();

        // 1. Cari user berdasarkan email
        const userResult = await client.query(
            'SELECT id, name, email FROM users WHERE email = $1',
            [email]
        );

        const user = userResult.rows[0];

        // 2. Cek apakah user ada
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Email atau password salah, bro!' });
        }

        // 3. ⚠️ VERIFIKASI PASSWORD SEDERHANA (Hanya untuk testing)
        // Kita asumsikan password yang dikirim di body HARUS cocok
        // dengan password di database. Karena belum ada kolom 'password',
        // kita lewati verifikasi ini. Nantinya, WAJIB bandingkan dengan kolom 'password'
        // dan library bcrypt.

        // Jika berhasil (asumsi password benar untuk sementara):
        res.status(200).json({
            status: 'success',
            message: 'Login berhasil! Selamat datang!',
            // Kirim data user (tanpa password)
            data: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (err) {
        console.error('Database LOGIN error', err);
        res.status(500).json({ status: 'error', message: 'Gagal saat login', error: err.message });
    } finally {
        if (client) client.release();
    }
});
// ===========================================
app.listen(port, () => {
    console.log(`\n[WaaAI] Server SISTUNIS running di http://localhost:${port}\n`);
});