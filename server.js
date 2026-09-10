const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Rota de Redirecionamento Direto
app.get('/r/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT url FROM qrcodes WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            return res.redirect(302, result.rows[0].url);
        } else {
            return res.status(404).send('QR Code não encontrado ou expirado.');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro interno no servidor.');
    }
});

// Listar todos com segurança
app.get('/api/codes', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, url, created_at FROM qrcodes ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Erro na API /api/codes:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Criar ou Atualizar (Upsert) sem depender de coluna label física se ela não existir
app.post('/api/codes', async (req, res) => {
    const { id, url } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'ID e URL são obrigatórios.' });
    }

    try {
        const query = `
            INSERT INTO qrcodes (id, url) 
            VALUES ($1, $2) 
            ON CONFLICT (id) 
            DO UPDATE SET url = EXCLUDED.url 
            RETURNING *;
        `;
        const result = await pool.query(query, [id, url]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar QR Code
app.delete('/api/codes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM qrcodes WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR RODANDO NA PORTA ${PORT} COM SUCESSO!`));