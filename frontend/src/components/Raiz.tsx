import { Outlet } from 'react-router-dom'
import ScrollToHash from '../lib/ScrollToHash'

// Elemento da rota raiz: comportamento global de navegação (rolar para #âncora / topo).
export default function Raiz() {
  return (
    <>
      <ScrollToHash />
      <Outlet />
    </>
  )
}
