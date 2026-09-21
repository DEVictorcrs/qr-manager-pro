const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');
const https = require('https'); // Adicionado para fazer o auto-ping
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    tls: true,
    tlsAllowInvalidCertificates: true
});

let dbInstance = null;

async function getCollection() {
    if (!dbInstance) {
        await client.connect();
        dbInstance = client.db('qr-manager');
    }
    return dbInstance.collection('qrcodes');
}

// Rota de Health Check para manter o servidor acordado
app.get('/health', (req, res) => {
    res.status(200).send('OK - Servidor ativo');
});

// Rota de Redirecionamento Direto
app.get('/r/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const collection = await getCollection();
        const doc = await collection.findOne({ id });
        if (doc) {
            return res.redirect(302, doc.url);
        } else {
            return res.status(404).send('QR Code não encontrado ou expirado.');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro interno no servidor.');
    }
});

// Listar todos ordenados do mais recente para o mais antigo
app.get('/api/codes', async (req, res) => {
    try {
        const collection = await getCollection();
        const codes = await collection.find({}).sort({ created_at: -1 }).toArray();
        res.json(codes);
    } catch (err) {
        console.error("Erro na API /api/codes:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Criar ou Atualizar (Upsert) incluindo o label
app.post('/api/codes', async (req, res) => {
    const { id, url, label } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'ID e URL são obrigatórios.' });
    }

    try {
        const collection = await getCollection();
        const filter = { id };
        const update = {
            $set: {
                id,
                url,
                label: label || id,
                created_at: new Date()
            }
        };
        const options = { upsert: true, returnDocument: 'after' };
        
        const result = await collection.findOneAndUpdate(filter, update, options);
        res.json({ success: true, data: result || { id, url, label } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar QR Code
app.delete('/api/codes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const collection = await getCollection();
        const result = await collection.deleteOne({ id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'QR Code não encontrado.' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SERVIDOR MONGODB RODANDO NA PORTA ${PORT} COM SUCESSO!`);

    // Mecanismo de Auto-Ping Interno (A cada 10 minutos)
    const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    
    setInterval(() => {
        https.get(`${APP_URL}/health`, (res) => {
            console.log(`Auto-ping enviado com sucesso. Status: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('Erro ao enviar auto-ping:', err.message);
        });
    }, 10 * 60 * 1000); // 10 minutos em milissegundos
});