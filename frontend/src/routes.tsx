import { Navigate, type RouteObject } from 'react-router-dom'
import AreaRestrita from './components/AreaRestrita'
import Raiz from './components/Raiz'
import RequerPapel from './components/RequerPapel'
import RootLayout from './components/RootLayout'
import Entrar from './pages/Entrar'
import Familia from './pages/Familia'
import Home from './pages/Home'
import Links from './pages/Links'
import Privacidade from './pages/Privacidade'
import TrocarSenha from './pages/TrocarSenha'

export const routes: RouteObject[] = [
  {
    element: <Raiz />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: '/', element: <Home /> },
          {
            // Tudo que tem login: só aqui existe o AuthProvider (páginas públicas não consultam /api/auth/me)
            element: <AreaRestrita />,
            children: [
              { path: '/familia/entrar', element: <Entrar area="familia" /> },
              { path: '/conta/senha', element: <TrocarSenha /> },
              {
                element: <RequerPapel area="familia" />,
                children: [{ path: '/familia', element: <Familia /> }],
              },
            ],
          },
        ],
      },
      { path: '/links', element: <Links /> },
      { path: '/privacidade', element: <Privacidade /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
