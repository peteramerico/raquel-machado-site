const BASE = '/api'

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Erro desconhecido')
  }
  return res.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
  posts: {
    list: () => request('/posts'),
    get: (id: number) => request(`/posts/${id}`),
    create: (data: object) => request('/posts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: object) => request(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/posts/${id}`, { method: 'DELETE' }),
    publish: (id: number) => request(`/posts/${id}/publish`, { method: 'POST' }),
    schedule: (id: number, scheduled_at: string) =>
      request(`/posts/${id}/schedule`, { method: 'POST', body: JSON.stringify({ scheduled_at }) }),
  },
  uploads: {
    image: async (file: File) => {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body: form })
      if (!res.ok) throw new Error('Falha no upload')
      return res.json() as Promise<{ url: string }>
    },
  },
}
