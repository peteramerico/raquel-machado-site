require('dotenv').config();
const { carregar } = require('./config');
const { obterPool } = require('./db');
const { criarRepositorio } = require('./repositorio');
const { criarApp } = require('./app');

const PORT = process.env.PORT || 3337;

// carregar() lança em produção se o JWT_SECRET for ausente/fraco: o container não sobe (falha alta).
const config = carregar();
const app = criarApp({ repo: criarRepositorio(obterPool()), config });

app.listen(PORT, () => {
  console.log(`Backend da Raquel rodando na porta ${PORT}`);
});
