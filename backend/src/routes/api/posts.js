const router = require('express').Router()
const slugify = require('slugify')
const db = require('../../db')
const requireAuth = require('../../middleware/auth')

router.use(requireAuth)

router.get('/', async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, title, slug, excerpt, cover_image, status, source, scheduled_at, published_at, created_at FROM posts ORDER BY created_at DESC'
  )
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM posts WHERE id = ?', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Post não encontrado' })
  res.json(rows[0])
})

router.post('/', async (req, res) => {
  const { title, excerpt, content_json, content_html, cover_image, status, source, ai_prompt } = req.body
  if (!title || !content_json || !content_html) return res.status(400).json({ error: 'Campos obrigatórios' })

  const slug = slugify(title, { lower: true, strict: true, locale: 'pt' })

  const [result] = await db.query(
    `INSERT INTO posts (title, slug, excerpt, content_json, content_html, cover_image, status, source, ai_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, excerpt || null, JSON.stringify(content_json), content_html,
     cover_image || null, status || 'rascunho', source || 'manual', ai_prompt || null]
  )

  res.status(201).json({ id: result.insertId, slug })
})

router.put('/:id', async (req, res) => {
  const { title, excerpt, content_json, content_html, cover_image, status, ai_prompt } = req.body
  const slug = title ? slugify(title, { lower: true, strict: true, locale: 'pt' }) : undefined

  const fields = []
  const values = []

  if (title) { fields.push('title = ?'); values.push(title) }
  if (slug) { fields.push('slug = ?'); values.push(slug) }
  if (excerpt !== undefined) { fields.push('excerpt = ?'); values.push(excerpt) }
  if (content_json) { fields.push('content_json = ?'); values.push(JSON.stringify(content_json)) }
  if (content_html) { fields.push('content_html = ?'); values.push(content_html) }
  if (cover_image !== undefined) { fields.push('cover_image = ?'); values.push(cover_image) }
  if (status) { fields.push('status = ?'); values.push(status) }
  if (ai_prompt !== undefined) { fields.push('ai_prompt = ?'); values.push(ai_prompt) }

  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' })

  values.push(req.params.id)
  await db.query(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, values)
  res.json({ ok: true, slug })
})

router.post('/:id/publish', async (req, res) => {
  await db.query(
    "UPDATE posts SET status = 'publicado', published_at = NOW(), scheduled_at = NULL WHERE id = ?",
    [req.params.id]
  )
  res.json({ ok: true })
})

router.post('/:id/schedule', async (req, res) => {
  const { scheduled_at } = req.body
  if (!scheduled_at) return res.status(400).json({ error: 'Data obrigatória' })

  await db.query(
    "UPDATE posts SET status = 'agendado', scheduled_at = ? WHERE id = ?",
    [new Date(scheduled_at), req.params.id]
  )
  res.json({ ok: true })
})

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM posts WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
