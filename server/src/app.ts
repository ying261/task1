import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { requestLogger } from './middleware/requestLogger'
import { errorHandler } from './middleware/errorHandler'
import { authRouter } from './routes/auth'

export const app = express()

app.use(cors())
app.use(express.json())
app.use(cookieParser())
app.use(requestLogger)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
})

app.use(errorHandler)
