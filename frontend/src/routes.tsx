import { Navigate, type RouteObject } from 'react-router-dom'
import AreaRestrita from './components/AreaRestrita'
import Raiz from './components/Raiz'
import RequerPapel from './components/RequerPapel'
import RootLayout from './components/RootLayout'
import AdminLayout from './pages/admin/AdminLayout'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import Entrar from './pages/Entrar'
import Familia from './pages/Familia'
import Home from './pages/Home'
import Links from './pages/Links'
import Palestra from './pages/Palestra'
import Palestras from './pages/Palestras'
import PainelFamilias from './pages/painel/PainelFamilias'
import PainelLayout from './pages/painel/PainelLayout'
import PainelValor from './pages/painel/PainelValor'
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
          { path: '/palestras', element: <Palestras /> },
          { path: '/palestras/:slug', element: <Palestra /> },
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
              { path: '/painel/entrar', element: <Entrar area="painel" /> },
              {
                element: <RequerPapel area="painel" />,
                children: [
                  {
                    element: <PainelLayout />,
                    children: [
                      { path: '/painel', element: <PainelFamilias /> },
                      { path: '/painel/valor', element: <PainelValor /> },
                    ],
                  },
                ],
              },
              { path: '/admin/entrar', element: <Entrar area="admin" /> },
              {
                element: <RequerPapel area="admin" />,
                children: [
                  {
                    element: <AdminLayout />,
                    children: [{ path: '/admin', element: <AdminUsuarios /> }],
                  },
                ],
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
