import express from 'express'
import cors from 'cors'
import { requestLogger } from './middleware/requestLogger'

export const app = express()

app.use(cors())
app.use(express.json())
app.use(requestLogger)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})
