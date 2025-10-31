// File: server.js (CODE FINAL)

const express = require('express');
const { Pool } = require('pg'); // Import driver PostgreSQL
const app = express();
const port = 3000;

// =======================================================
// === 🚨 GANTI DENGAN DATA DARI INVENTARIS (.inv) ENTE ===
// =======================================================
const pool = new Pool({
  user: process.env.DB_USER,        // Mengambil dari .env
  host: process.env.DB_HOST,        // Mengambil dari .env
  database: process.env.DB_NAME,      // Mengambil dari .env
  password: process.env.DB_PASS,      // Mengambil dari .env
  port: 5432,
});
// =======================================================

// Test Route: Mengambil waktu saat ini dari RDS
app.get('/', async (req, res) => {
  try {
    // Jalankan query ke database RDS
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release(); // Lepas koneksi

    const dbTime = result.rows[0].now;

    // Kirim response sukses ke browser
    res.send(`
      Weew, WaaAI SISTUNIS Berhasil Running di Port ${port}, Bro!
      <hr>
      ✅ KONEKSI RDS SUCCESS! Database Time: ${dbTime}
      <hr>
      Sekarang WaaAI ente siap menerima logic SQL yang lebih kompleks! Gas!
    `);
  } catch (err) {
    console.error('Error executing query', err.stack);
    // Kirim response error ke browser
    res.status(500).send(`
      🚨 ERROR KONEKSI RDS: ${err.message}
      <hr>
      Cek lagi DB_HOST, DB_USER, dan DB_PASSWORD ente di file server.js ini!
    `);
  }
});

app.listen(port, () => {
  console.log(`\n[WaaAI] Server SISTUNIS running di http://localhost:${port}\n`);
});
