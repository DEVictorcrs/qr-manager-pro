const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// Inicializa o banco de dados SQLite local (arquivo database.sqlite)
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Erro ao abrir o SQLite:', err.message);
    } else {
        console.log('Conectado ao banco SQLite local com sucesso!');
        // Cria a tabela qrcodes se ela não existir
        db.run(`
            CREATE TABLE IF NOT EXISTS qrcodes (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
});

// Rota de Redirecionamento Direto
app.get('/r/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT url FROM qrcodes WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Erro interno no servidor.');
        }
        if (row) {
            return res.redirect(302, row.url);
        } else {
            return res.status(404).send('QR Code não encontrado ou expirado.');
        }
    });
});

// Listar todos
app.get('/api/codes', (req, res) => {
    db.all('SELECT * FROM qrcodes ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error("Erro na API /api/codes:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Criar ou Atualizar (Upsert)
app.post('/api/codes', (req, res) => {
    const { id, url } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'ID e URL são obrigatórios.' });
    }

    const query = `
        INSERT INTO qrcodes (id, url) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET url = excluded.url
    `;
    
    db.run(query, [id, url], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        db.get('SELECT * FROM qrcodes WHERE id = ?', [id], (err, row) => {
            res.json({ success: true, data: row });
        });
    });
});

// Deletar QR Code
app.delete('/api/codes/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM qrcodes WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR RODANDO NA PORTA ${PORT} COM SUCESSO!`));