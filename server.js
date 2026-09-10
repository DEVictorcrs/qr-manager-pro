const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// Caminho do arquivo JSON que servirá como banco de dados local
const dbFile = path.join(__dirname, 'database.json');

// Função auxiliar para ler o banco
function readDb() {
    if (!fs.existsSync(dbFile)) {
        fs.writeFileSync(dbFile, JSON.stringify([], null, 2));
    }
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Função auxiliar para escrever no banco
function writeDb(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// Inicializa o arquivo ao subir o servidor
readDb();

// Rota de Redirecionamento Direto
app.get('/r/:id', (req, res) => {
    const { id } = req.params;
    const codes = readDb();
    const found = codes.find(c => c.id === id);
    
    if (found) {
        return res.redirect(302, found.url);
    } else {
        return res.status(404).send('QR Code não encontrado ou expirado.');
    }
});

// Listar todos
app.get('/api/codes', (req, res) => {
    const codes = readDb();
    // Ordena do mais recente para o mais antigo com base na data de criação
    codes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(codes);
});

// Criar ou Atualizar (Upsert)
app.post('/api/codes', (req, res) => {
    const { id, url } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'ID e URL são obrigatórios.' });
    }

    const codes = readDb();
    const existingIndex = codes.findIndex(c => c.id === id);
    
    let record;
    if (existingIndex >= 0) {
        // Atualiza
        codes[existingIndex].url = url;
        record = codes[existingIndex];
    } else {
        // Cria novo
        record = {
            id,
            url,
            created_at: new Date().toISOString()
        };
        codes.push(record);
    }

    writeDb(codes);
    res.json({ success: true, data: record });
});

// Deletar QR Code
app.delete('/api/codes/:id', (req, res) => {
    const { id } = req.params;
    let codes = readDb();
    const initialLength = codes.length;
    
    codes = codes.filter(c => c.id !== id);
    
    if (codes.length === initialLength) {
        return res.status(404).json({ error: 'QR Code não encontrado.' });
    }

    writeDb(codes);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR JSON RODANDO NA PORTA ${PORT} COM SUCESSO!`));