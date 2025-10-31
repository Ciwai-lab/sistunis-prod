// File: server.js
const express = require('express');
const app = express();
const port = 3000; // Nginx kita proxy ke sini!

// Ini cuma cek koneksi server, nanti diganti code WaaAI ente
app.get('/', (req, res) => {
    res.send('Weew, WaaAI SISTUNIS Berhasil Running di Port 3000, Bro!');
});

// Nanti tambahkan logic koneksi database RDS di sini...

app.listen(port, () => {
    console.log(`\n\n[WaaAI] Server SISTUNIS running di http://localhost:${port}\n\n`);
});

// Import package.json agar bisa npm install
// Buat folder node_modules