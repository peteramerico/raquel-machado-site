import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import styles from './Dashboard.module.css'

type Post = {
  id: number; title: string; slug: string; status: string;
  source: string; published_at: string | null; scheduled_at: string | null; created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', agendado: 'Agendado', publicado: 'Publicado',
}
const STATUS_COLOR: Record<string, string> = {
  rascunho: '#9080a0', agendado: '#c9a77b', publicado: '#4caf82',
}

export default function Dashboard({ user, onLogout }: { user: { name: string }; onLogout: () => void }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try { setPosts(await api.posts.list()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: number, title: string) {
    if (!confirm(`Deletar "${title}"?`)) return
    await api.posts.delete(id)
    load()
  }

  async function handlePublish(id: number) {
    await api.posts.publish(id)
    load()
  }

  async function handleLogout() {
    await api.auth.logout()
    onLogout()
  }

  const byStatus = (s: string) => posts.filter(p => p.status === s)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <span className={styles.headerName}>Painel Admin</span>
          <span className={styles.headerUser}>{user.name}</span>
        </div>
        <div className={styles.headerActions}>
          <Link to="/posts/new" className={styles.btnNew}>+ Novo Post</Link>
          <button className={styles.btnLogout} onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.stats}>
          {['publicado', 'agendado', 'rascunho'].map(s => (
            <div key={s} className={styles.stat}>
              <span className={styles.statNum}>{byStatus(s).length}</span>
              <span className={styles.statLabel}>{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <p className={styles.loading}>Carregando...</p>
        ) : posts.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhum post ainda.</p>
            <Link to="/posts/new" className={styles.btnNew}>Criar primeiro post</Link>
          </div>
        ) : (
          <div className={styles.list}>
            {posts.map(post => (
              <div key={post.id} className={styles.item}>
                <div className={styles.itemMeta}>
                  <span className={styles.itemStatus} style={{ color: STATUS_COLOR[post.status] }}>
                    ● {STATUS_LABEL[post.status]}
                  </span>
                  {post.source === 'ia' && <span className={styles.itemAi}>IA</span>}
                  <span className={styles.itemDate}>
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString('pt-BR')
                      : post.scheduled_at
                      ? `Agendado: ${new Date(post.scheduled_at).toLocaleString('pt-BR')}`
                      : new Date(post.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <h3 className={styles.itemTitle}>{post.title}</h3>
                <div className={styles.itemActions}>
                  <Link to={`/posts/${post.id}`} className={styles.actionEdit}>Editar</Link>
                  {post.status !== 'publicado' && (
                    <button className={styles.actionPublish} onClick={() => handlePublish(post.id)}>
                      Publicar agora
                    </button>
                  )}
                  {post.status === 'publicado' && (
                    <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className={styles.actionView}>
                      Ver post →
                    </a>
                  )}
                  <button className={styles.actionDelete} onClick={() => handleDelete(post.id, post.title)}>
                    Deletar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
