import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { NavBar } from './components/NavBar'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { Dashboard } from './pages/Dashboard'

export function App() {
  return (
    <AuthProvider>
      <NavBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin" element={<div>Admin</div>} />
      </Routes>
    </AuthProvider>
  )
}
