const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.FRONTEND_URL || 'https://raquelmachadoped.com.br', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Fases seguintes (login, área da família/médica/admin, configurações) entram aqui.

app.use('/api', (req, res) => res.status(404).json({ erro: 'Não encontrado.' }));

module.exports = app;
