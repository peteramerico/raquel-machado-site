const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const requireAuth = require('../../middleware/auth')

const uploadsDir = path.join(__dirname, '../../../uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/
    cb(null, allowed.test(file.mimetype))
  },
})

router.post('/image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo inválido' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

module.exports = router
