// File: middleware/auth.js

const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Ambil token dari header
    // Token biasanya dikirim sebagai: Authorization: Bearer <token>
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ msg: 'Akses ditolak. Token tidak ditemukan.' });
    }

    // Pisahkan 'Bearer' dari token
    const token = authHeader.replace('Bearer ', '');

    // 2. Verifikasi Token
    try {
        // Memverifikasi token dengan Secret Key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Menambahkan data user dari token ke objek request (req.user)
        // Agar bisa diakses oleh endpoint selanjutnya
        req.user = decoded.user;

        // Lanjutkan ke fungsi (endpoint) berikutnya
        next();

    } catch (e) {
        // Jika token tidak valid (expired, diubah, dll.)
        res.status(401).json({ msg: 'Token tidak valid. Silakan login ulang.' });
    }
};