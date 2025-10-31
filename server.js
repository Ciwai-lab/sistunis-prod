// File: server.js (UPDATED CODE - Tambah Endpoint API)

const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config(); // Pastikan ini tetap ada

const app = express();
const port = 3000;

// ... (Bagian Pool Konfigurasi tetap sama) ...
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: 5432,
});

// Endpoint 1: Root Path (Test Koneksi Database)
app.get('/', async (req, res) => {
    // ... (Code cek koneksi yang berhasil tadi, biarkan saja) ...
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        const dbTime = result.rows[0].now;
        res.send(`Weew, WaaAI SISTUNIS Berhasil Running... ✅ KONEKSI RDS SUCCESS! Database Time: ${dbTime}`);
    } catch (err) {
        res.status(500).send(`🚨 ERROR KONEKSI RDS: ${err.message}`);
    }
});

// =======================================================
// === 🟢 ENDPOINT BARU: AMBIL SEMUA DATA USER (CONTOH) ===
// =======================================================
app.get('/api/users', async (req, res) => {
    try {
        const client = await pool.connect();
        // PERHATIAN: GANTI 'nama_tabel_ente' JIKA SUDAH ADA TABEL LAIN!
        // Kalau belum ada, kita pakai SELECT NOW() dulu untuk pastikan jalan.
        const result = await client.query('SELECT NOW() AS current_time');
        client.release();

        // Mengirim data dalam format JSON (Standar API)
        res.json({
            status: "success",
            message: "Data berhasil diambil dari RDS!",
            data: result.rows
        });
    } catch (err) {
        console.error('Error fetching users:', err.stack);
        res.status(500).json({
            status: "error",
            message: "Gagal mengambil data dari database.",
            details: err.message
        });
    }
});
// =======================================================

app.listen(port, () => {
    console.log(`\n[WaaAI] Server SISTUNIS running di http://localhost:${port}\n`);
});