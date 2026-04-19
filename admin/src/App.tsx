import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PostEditor from './pages/PostEditor'

type User = { name: string; email: string } | null

export default function App() {
  const [user, setUser] = useState<User>(undefined as unknown as User)

  useEffect(() => {
    api.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) return null // carregando sessão

  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />
        } />
        <Route path="/" element={
          user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />
        } />
        <Route path="/posts/new" element={
          user ? <PostEditor user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />
        } />
        <Route path="/posts/:id" element={
          user ? <PostEditor user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
