const router = require('express').Router()
const db = require('../db')

router.get('/', async (req, res) => {
  const [posts] = await db.query(
    `SELECT id, title, slug, excerpt, cover_image, published_at
     FROM posts WHERE status = 'publicado'
     ORDER BY published_at DESC`
  )
  res.render('blog/index', { posts })
})

router.get('/:slug', async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM posts WHERE slug = ? AND status = 'publicado'",
    [req.params.slug]
  )
  const post = rows[0]
  if (!post) return res.status(404).render('blog/404')
  res.render('blog/post', { post })
})

module.exports = router
