const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defesa extra contra CSRF (além de SameSite=Lax + corpo JSON): em métodos que alteram estado, se a
// requisição traz `Origin`, o host dele precisa ser o mesmo `Host` da requisição. Funciona igual em dev
// (localhost:porta) e em produção (nginx repassa `Host $host`) sem configuração por ambiente.
function origem() {
  return (req, res, next) => {
    if (SEGUROS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    let host;
    try {
      host = new URL(origin).host;
    } catch {
      return res.status(403).json({ erro: 'Origem não permitida.' });
    }
    if (host !== req.get('host')) return res.status(403).json({ erro: 'Origem não permitida.' });
    next();
  };
}

module.exports = { origem };
