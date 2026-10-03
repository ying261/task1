import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { requestLogger } from './middleware/requestLogger'
import { errorHandler } from './middleware/errorHandler'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { kudosRouter, adminKudosRouter } from './routes/kudos'

export const app = express()

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

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
})

app.use(errorHandler)
