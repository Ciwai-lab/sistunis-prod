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
// === 🟢 ENDPOINT BARU: AMBIL SEMUA DATA USER (CONTOH) ===
// =======================================================
app.get('/api/users', async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // GANTI LOGIC INI! HANYA SELECT KARENA TABEL SUDAH DIBUAT!
        const result = await client.query(`
            SELECT id, username, email, created_at FROM users;
        `);

        res.json({
            status: 'success',
            message: 'Data berhasil diambil dari RDS!',
            data: result.rows
        });

    } catch (err) {
        console.error('Database query error', err);
        res.status(500).json({ status: 'error', message: 'Gagal query database', error: err.message });
    } finally {
        if (client) client.release();
    }
});

// =======================================================

app.listen(port, () => {
    console.log(`\n[WaaAI] Server SISTUNIS running di http://localhost:${port}\n`);
});