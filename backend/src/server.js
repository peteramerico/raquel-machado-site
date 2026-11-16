require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3337;

app.listen(PORT, () => {
  console.log(`Backend da Raquel rodando na porta ${PORT}`);
});
