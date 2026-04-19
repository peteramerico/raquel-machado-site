require('dotenv').config()
const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const path = require('path')

const blogRoutes = require('./routes/blog')
const authRoutes = require('./routes/api/auth')
const postsRoutes = require('./routes/api/posts')
const uploadsRoutes = require('./routes/api/uploads')
const scheduler = require('./services/scheduler')

const app = express()
const PORT = process.env.PORT || 3001

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(cors({
  origin: process.env.ADMIN_URL || 'http://localhost:5174',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/blog', blogRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/uploads', uploadsRoutes)

app.get('/api/health', (req, res) => res.json({ ok: true }))

scheduler.start()

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`)
})
