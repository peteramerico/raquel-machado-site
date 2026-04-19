const router = require('express').Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const db = require('../../db')

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Campos obrigatórios' })

  const [rows] = await db.query('SELECT * FROM admin_users WHERE email = ?', [email])
  const user = rows[0]
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' })

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.json({ name: user.name, email: user.email })
})

router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', (req, res) => {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ error: 'Não autenticado' })
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    res.json({ name: user.name, email: user.email })
  } catch {
    res.status(401).json({ error: 'Sessão expirada' })
  }
})

module.exports = router
