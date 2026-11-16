// Respostas da API nunca podem ser guardadas por proxy/CDN/navegador: dependem do cookie e podem
// carregar conteúdo restrito (guia) ou senha temporária (Incremento 2).
function semCache() {
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.vary('Cookie');
    next();
  };
}

module.exports = { semCache };
