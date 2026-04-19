import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link as TiptapLink from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import Placeholder from '@tiptap/extension-placeholder'
import { api } from '../api'
import styles from './PostEditor.module.css'

export default function PostEditor({ user, onLogout }: { user: { name: string }; onLogout: () => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [status, setStatus] = useState('rascunho')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      TiptapLink.configure({ openOnClick: false }),
      Youtube.configure({ width: 720, height: 405 }),
      Placeholder.configure({ placeholder: 'Escreva o conteúdo do post aqui...' }),
    ],
  })

  useEffect(() => {
    if (!isNew && editor) {
      api.posts.get(Number(id)).then(post => {
        setTitle(post.title)
        setExcerpt(post.excerpt || '')
        setCoverImage(post.cover_image || '')
        setStatus(post.status)
        setScheduledAt(post.scheduled_at ? post.scheduled_at.slice(0, 16) : '')
        editor.commands.setContent(post.content_json)
      })
    }
  }, [id, editor])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    const { url } = await api.uploads.image(file)
    editor.chain().focus().setImage({ src: url }).run()
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const { url } = await api.uploads.image(file)
    setCoverImage(url)
  }

  function addYoutube() {
    const url = prompt('URL do YouTube ou Instagram:')
    if (url && editor) editor.chain().focus().setYoutubeVideo({ src: url }).run()
  }

  async function save(publish?: boolean, schedule?: boolean) {
    if (!editor || !title) return
    setSaving(true)
    setMessage('')
    try {
      const data = {
        title, excerpt, cover_image: coverImage,
        content_json: editor.getJSON(),
        content_html: editor.getHTML(),
        status: publish ? 'publicado' : schedule ? 'agendado' : 'rascunho',
        source: 'manual',
      }

      if (isNew) {
        const { id: newId } = await api.posts.create(data)
        if (publish) await api.posts.publish(newId)
        if (schedule && scheduledAt) await api.posts.schedule(newId, new Date(scheduledAt).toISOString())
        navigate(`/posts/${newId}`)
      } else {
        await api.posts.update(Number(id), data)
        if (publish) await api.posts.publish(Number(id))
        if (schedule && scheduledAt) await api.posts.schedule(Number(id), new Date(scheduledAt).toISOString())
      }
      setMessage(publish ? 'Publicado!' : schedule ? 'Agendado!' : 'Rascunho salvo.')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await api.auth.logout()
    onLogout()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/" className={styles.back}>← Dashboard</Link>
          <span className={styles.headerTitle}>{isNew ? 'Novo Post' : 'Editar Post'}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.headerUser}>{user.name}</span>
          <button className={styles.btnLogout} onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.editorWrap}>
          <input
            className={styles.titleInput}
            placeholder="Título do post"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <div className={styles.toolbar}>
            <button onClick={() => editor?.chain().focus().toggleBold().run()} className={editor?.isActive('bold') ? styles.active : ''}>B</button>
            <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={editor?.isActive('italic') ? styles.active : ''}><em>I</em></button>
            <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={editor?.isActive('heading', { level: 2 }) ? styles.active : ''}>H2</button>
            <button onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={editor?.isActive('heading', { level: 3 }) ? styles.active : ''}>H3</button>
            <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={editor?.isActive('bulletList') ? styles.active : ''}>• Lista</button>
            <button onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={editor?.isActive('blockquote') ? styles.active : ''}>" Citação</button>
            <label className={styles.toolbarUpload}>
              📷 Imagem
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
            <button onClick={addYoutube}>▶ Vídeo</button>
          </div>

          <EditorContent editor={editor} className={styles.editor} />
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.sideSection}>
            <label className={styles.sideLabel}>Resumo (excerpt)</label>
            <textarea
              className={styles.sideTextarea}
              rows={3}
              placeholder="Breve descrição para listagem e SEO"
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
            />
          </div>

          <div className={styles.sideSection}>
            <label className={styles.sideLabel}>Imagem de capa</label>
            {coverImage && <img src={coverImage} alt="capa" className={styles.coverPreview} />}
            <label className={styles.uploadBtn}>
              {coverImage ? 'Trocar imagem' : 'Enviar imagem'}
              <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <div className={styles.sideSection}>
            <label className={styles.sideLabel}>Agendar publicação</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          </div>

          {message && <p className={styles.message}>{message}</p>}

          <div className={styles.actions}>
            <button className={styles.btnDraft} onClick={() => save()} disabled={saving}>
              Salvar rascunho
            </button>
            {scheduledAt && (
              <button className={styles.btnSchedule} onClick={() => save(false, true)} disabled={saving}>
                Agendar
              </button>
            )}
            <button className={styles.btnPublish} onClick={() => save(true)} disabled={saving}>
              {saving ? 'Salvando...' : 'Publicar agora'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
