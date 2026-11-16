const express = require('express');
const { sessao: mwSessao, exigirPapel } = require('../middleware/sessao');
const { guia } = require('../conteudo/guiaConsulta');
const { lerValorConsulta } = require('../valor');

function rotasFamilia({ repo, config, sessao }) {
  const router = express.Router();

  // Exige sessão (já sem senha temporária pendente) e papel mínimo `familia` — médica e admin também entram.
  router.get('/guia', mwSessao({ repo, sessao, config }), exigirPapel('familia'), async (req, res, next) => {
    try {
      res.json({ guia, valorConsulta: await lerValorConsulta(repo) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { rotasFamilia };
