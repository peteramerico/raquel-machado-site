import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import './styles/tokens.css'
import App from './App.tsx'

const raiz = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// Páginas pré-renderizadas vêm com o #root preenchido: o React assume o DOM existente.
// A shell (áreas com login e rotas desconhecidas) vem vazia: renderização normal no cliente.
if (raiz.hasChildNodes()) hydrateRoot(raiz, app)
else createRoot(raiz).render(app)
