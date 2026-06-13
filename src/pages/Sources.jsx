import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Bookmark, ExternalLink, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

export default function Sources() {
  const { user } = useAuth()
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('sources').select('*').order('created_at', { ascending: false })
    setSources(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const allTags = useMemo(() => {
    const s = new Set()
    sources.forEach((src) => (src.tags || []).forEach((t) => s.add(t)))
    return [...s].sort()
  }, [sources])

  const filtered = useMemo(() => {
    return sources.filter((s) => {
      if (activeTag && !(s.tags || []).includes(activeTag)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.title?.toLowerCase().includes(q) ||
          s.url?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q) ||
          (s.tags || []).some((t) => t.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [sources, search, activeTag])

  const save = async (data) => {
    const payload = {
      ...data,
      tags: data.tags
        ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    }
    if (editing?.id) {
      await supabase.from('sources').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('sources').insert({ ...payload, user_id: user.id })
    }
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this source?')) return
    await supabase.from('sources').delete().eq('id', id)
    setSources(sources.filter((s) => s.id !== id))
  }

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle="Research, inspiration, and reference links"
        actions={
          <button onClick={() => { setEditing(null); setModalOpen(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New source</span>
          </button>
        }
      />

      <div className="p-4 md:p-8">
        {/* Search */}
        <div className="relative mb-3 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            placeholder="Search title, url, notes, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setActiveTag(null)}
              className={`text-xs px-2 py-1 rounded ${activeTag === null ? 'bg-elevated text-white' : 'bg-surface text-muted hover:text-white'}`}
            >
              all
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t === activeTag ? null : t)}
                className={`text-xs px-2 py-1 rounded ${activeTag === t ? 'bg-accent text-white' : 'bg-surface text-muted hover:text-white'}`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted py-4">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title={sources.length === 0 ? 'No sources yet' : 'No matches'}
            description={sources.length === 0 ? 'Save articles, tools, threads, anything you want to come back to.' : 'Try a different search or clear the tag filter.'}
            action={sources.length === 0 ? (
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />Add first source
              </button>
            ) : null}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <div key={s.id} className="card p-4 group flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-medium text-sm leading-snug">{s.title}</h3>
                  <button onClick={() => remove(s.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent transition-opacity" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted hover:text-accent inline-flex items-center gap-1 truncate mb-2"
                  >
                    {safeHostname(s.url)}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}
                {s.notes && <p className="text-xs text-muted line-clamp-3 flex-1 mb-2">{s.notes}</p>}
                {s.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {s.tags.map((t) => (
                      <span key={t} className="text-[10px] text-muted font-mono">#{t}</span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setEditing(s); setModalOpen(true) }}
                  className="text-xs text-muted hover:text-white mt-2 text-left"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SourceModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={save}
        editing={editing}
      />
    </>
  )
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function SourceModal({ open, onClose, onSave, editing }) {
  const [form, setForm] = useState({ title: '', url: '', notes: '', tags: '' })

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || '',
        url: editing.url || '',
        notes: editing.notes || '',
        tags: (editing.tags || []).join(', '),
      })
    } else {
      setForm({ title: '', url: '', notes: '', tags: '' })
    }
  }, [editing, open])

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit source' : 'New source'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className="btn-primary">{editing ? 'Save' : 'Save source'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label block mb-1.5">Title</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
        </div>
        <div>
          <label className="label block mb-1.5">URL</label>
          <input type="url" placeholder="https://…" className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div>
          <label className="label block mb-1.5">Notes</label>
          <textarea className="input min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div>
          <label className="label block mb-1.5">Tags (comma-separated)</label>
          <input className="input" placeholder="ai, video, hook-ideas" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </div>
      </form>
    </Modal>
  )
}
