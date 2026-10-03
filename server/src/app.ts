import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requestLogger } from './middleware/requestLogger'
import { errorHandler } from './middleware/errorHandler'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { kudosRouter, adminKudosRouter } from './routes/kudos'

export const app = express()

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')

app.use(cors())
app.use(express.json())
app.use(cookieParser())
app.use(requestLogger)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/kudos', kudosRouter)
app.use('/api/admin/kudos', adminKudosRouter)

// Serve the built client (client/dist) when present.
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
}
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
  const index = path.join(clientDist, 'index.html')
  if (existsSync(index)) return res.sendFile(index)
  next()
})

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
})

app.use(errorHandler)
