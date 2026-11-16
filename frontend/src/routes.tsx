import { Navigate, type RouteObject } from 'react-router-dom'
import Raiz from './components/Raiz'
import RootLayout from './components/RootLayout'
import Familia from './pages/Familia'
import Home from './pages/Home'
import Links from './pages/Links'
import Privacidade from './pages/Privacidade'

export const routes: RouteObject[] = [
  {
    element: <Raiz />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/familia', element: <Familia /> },
        ],
      },
      { path: '/links', element: <Links /> },
      { path: '/privacidade', element: <Privacidade /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
