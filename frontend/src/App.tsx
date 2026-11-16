import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Links from './pages/Links'
import Privacidade from './pages/Privacidade'
import Familia from './pages/Familia'
import ScrollToHash from './lib/ScrollToHash'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/familia" element={<Familia />} />
        <Route path="/links" element={<Links />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
