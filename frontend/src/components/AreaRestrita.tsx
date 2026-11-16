import { Outlet } from 'react-router-dom'
import AuthProvider from './AuthProvider'

// Layout das rotas com login: só aqui o AuthProvider existe (e só aqui /api/auth/me é consultado).
export default function AreaRestrita() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
