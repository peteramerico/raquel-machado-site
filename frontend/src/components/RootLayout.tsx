import { Outlet } from 'react-router-dom'
import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'

// Layout das páginas do site (header + conteúdo + rodapé). /links e /privacidade ficam de fora, como sempre.
export default function RootLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </>
  )
}
