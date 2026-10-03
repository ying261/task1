import { app } from './app'
import { PORT } from './config'

app.listen(PORT, () => {
  console.log(`Kudos API listening on http://localhost:${PORT}`)
})
