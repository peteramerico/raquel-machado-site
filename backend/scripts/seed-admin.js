// Uso: node scripts/seed-admin.js
// Roda na VPS após o banco estar de pé para criar os usuários admin

require('dotenv').config()
const bcrypt = require('bcrypt')
const readline = require('readline')
const db = require('../src/db')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(r => rl.question(q, r))

async function main() {
  const users = [
    { name: 'Peter Americo', email: 'peterpeny@gmail.com' },
    { name: 'Dra. Raquel Machado', email: 'raqueladgmachado@gmail.com' },
  ]

  for (const user of users) {
    console.log(`\nConfigurando: ${user.name} (${user.email})`)
    const password = await ask('  Senha: ')
    const hash = await bcrypt.hash(password, 12)

    await db.query(
      `INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)`,
      [user.name, user.email, hash]
    )
    console.log('  ✓ Usuário criado/atualizado')
  }

  console.log('\nSetup concluído.')
  rl.close()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
