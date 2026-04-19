const cron = require('node-cron')
const db = require('../db')

async function publishScheduled() {
  const [posts] = await db.query(
    "SELECT id FROM posts WHERE status = 'agendado' AND scheduled_at <= NOW()"
  )
  for (const post of posts) {
    await db.query(
      "UPDATE posts SET status = 'publicado', published_at = NOW() WHERE id = ?",
      [post.id]
    )
    console.log(`[scheduler] Post ${post.id} publicado`)
  }
}

function start() {
  // Roda a cada minuto
  cron.schedule('* * * * *', () => {
    publishScheduled().catch(err => console.error('[scheduler] erro:', err))
  })
  console.log('[scheduler] iniciado')
}

module.exports = { start }
