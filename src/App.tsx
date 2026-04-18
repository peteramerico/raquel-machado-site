import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Links from './pages/Links'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/links" element={<Links />} />
        <Route path="*" element={<Navigate to="/links" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
