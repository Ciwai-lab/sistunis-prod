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
        const result = await client.query('SELECT * FROM users');
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
    let client;
    try {
        client = await pool.connect();

        // GANTI INI DENGAN COMMAND SQL UNTUK MEMBUAT TABEL!
        const result = await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users (username, email) VALUES ('ciwai_lab', 'ciwai@lab.com') ON CONFLICT (username) DO NOTHING;
            SELECT * FROM users;
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