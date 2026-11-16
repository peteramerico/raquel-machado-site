const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrar } = require('../src/migrar');

// Pool falso em memória: registra o que o runner executa.
function criarPoolFalso({ jaRegistradas = [], lockOk = 1 } = {}) {
  const estado = { registradas: [...jaRegistradas], executadas: [], lockLiberado: false, liberada: false };
  const conn = {
    async query(sql, params) {
      if (/GET_LOCK/.test(sql)) return [[{ ok: lockOk }]];
      if (/RELEASE_LOCK/.test(sql)) { estado.lockLiberado = true; return [[{}]]; }
      if (/CREATE TABLE IF NOT EXISTS schema_migracoes/.test(sql)) return [[]];
      if (/SELECT nome FROM schema_migracoes/.test(sql)) return [estado.registradas.map((nome) => ({ nome }))];
      if (/INSERT INTO schema_migracoes/.test(sql)) { estado.registradas.push(params[0]); return [{}]; }
      if (/FALHAR/.test(sql)) throw new Error('boom da migration');
      estado.executadas.push(sql.trim());
      return [[]];
    },
    release() { estado.liberada = true; },
  };
  return { estado, pool: { getConnection: async () => conn } };
}

function criarDir(arquivos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-'));
  for (const [nome, sql] of Object.entries(arquivos)) fs.writeFileSync(path.join(dir, nome), sql);
  return dir;
}

describe('migrar', () => {
  it('aplica em ordem de nome só as migrations ainda não registradas', async () => {
    const dir = criarDir({
      '002_b.sql': 'SELECT 2;',
      '001_a.sql': 'SELECT 1;',
      '003_c.sql': 'SELECT 3;',
    });
    const { pool, estado } = criarPoolFalso({ jaRegistradas: ['001_a.sql'] });
    const aplicadas = await migrar(pool, dir);
    expect(aplicadas).toEqual(['002_b.sql', '003_c.sql']);
    expect(estado.executadas).toEqual(['SELECT 2;', 'SELECT 3;']);
    expect(estado.registradas).toEqual(['001_a.sql', '002_b.sql', '003_c.sql']);
  });

  it('é idempotente: a segunda execução não reaplica nada', async () => {
    const dir = criarDir({ '001_a.sql': 'SELECT 1;' });
    const { pool, estado } = criarPoolFalso();
    expect(await migrar(pool, dir)).toEqual(['001_a.sql']);
    expect(await migrar(pool, dir)).toEqual([]);
    expect(estado.executadas).toEqual(['SELECT 1;']);
  });

  it('se uma migration falha, não a registra e propaga o erro (e libera lock e conexão)', async () => {
    const dir = criarDir({ '001_ok.sql': 'SELECT 1;', '002_ruim.sql': 'FALHAR;', '003_depois.sql': 'SELECT 3;' });
    const { pool, estado } = criarPoolFalso();
    await expect(migrar(pool, dir)).rejects.toThrow('boom da migration');
    expect(estado.registradas).toEqual(['001_ok.sql']);
    expect(estado.executadas).toEqual(['SELECT 1;']);
    expect(estado.lockLiberado).toBe(true);
    expect(estado.liberada).toBe(true);
  });

  it('ignora arquivos que não seguem NNN_nome.sql', async () => {
    const dir = criarDir({ '001_a.sql': 'SELECT 1;', 'LEIAME.md': 'x', 'rascunho.sql': 'SELECT 9;', '.gitkeep': '' });
    const { pool, estado } = criarPoolFalso();
    expect(await migrar(pool, dir)).toEqual(['001_a.sql']);
    expect(estado.executadas).toEqual(['SELECT 1;']);
  });

  it('falha alto se não conseguir o lock de migração', async () => {
    const dir = criarDir({ '001_a.sql': 'SELECT 1;' });
    const { pool, estado } = criarPoolFalso({ lockOk: 0 });
    await expect(migrar(pool, dir)).rejects.toThrow(/lock/i);
    expect(estado.executadas).toEqual([]);
    expect(estado.liberada).toBe(true);
  });
});
