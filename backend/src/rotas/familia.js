const express = require('express');
const { sessao: mwSessao, exigirPapel } = require('../middleware/sessao');
const { guia } = require('../conteudo/guiaConsulta');

// Só se a chave `valor_consulta` faltar ou estiver corrompida no banco; o valor real é editado na área médica.
const VALOR_PADRAO = 400;

function rotasFamilia({ repo, config, sessao }) {
  const router = express.Router();

  // Exige sessão (já sem senha temporária pendente) e papel mínimo `familia` — médica e admin também entram.
  router.get('/guia', mwSessao({ repo, sessao, config }), exigirPapel('familia'), async (req, res, next) => {
    try {
      const valor = Number(await repo.lerConfig('valor_consulta'));
      res.json({ guia, valorConsulta: Number.isFinite(valor) && valor > 0 ? valor : VALOR_PADRAO });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { rotasFamilia };
