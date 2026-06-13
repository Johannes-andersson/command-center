import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Wrench, ExternalLink, Star, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const CATEGORIES = [
  'writing',
  'video',
  'image',
  'audio',
  'coding',
  'research',
  'agents',
  'productivity',
  'other',
]

export default function AITools() {
  const { user } = useAuth()
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('ai_tools').select('*').order('rating', { ascending: false, nullsFirst: false })
    setTools(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return tools.filter((t) => {
      if (activeCat !== 'all' && t.category !== activeCat) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.name?.toLowerCase().includes(q) ||
          t.use_case?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tools, search, activeCat])

  const save = async (data) => {
    const payload = {
      ...data,
      rating: data.rating ? Number(data.rating) : null,
    }
    if (editing?.id) {
      await supabase.from('ai_tools').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('ai_tools').insert({ ...payload, user_id: user.id })
    }
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Remove this tool?')) return
    await supabase.from('ai_tools').delete().eq('id', id)
    setTools(tools.filter((t) => t.id !== id))
  }

  return (
    <>
      <PageHeader
        title="AI tools"
        subtitle="Your stack — what you use, what it costs, what it's for"
        actions={
          <button onClick={() => { setEditing(null); setModalOpen(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add tool</span>
          </button>
        }
      />

      <div className="p-4 md:p-8">
        <div className="relative mb-3 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            placeholder="Search name, use case, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setActiveCat('all')} className={`text-xs px-2 py-1 rounded ${activeCat === 'all' ? 'bg-elevated text-white' : 'bg-surface text-muted hover:text-white'}`}>all</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={`text-xs px-2 py-1 rounded ${activeCat === c ? 'bg-accent text-white' : 'bg-surface text-muted hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-muted py-4">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={tools.length === 0 ? 'No tools yet' : 'No matches'}
            description={tools.length === 0 ? 'Track the AI tools you use, with cost and your honest rating.' : 'Try a different search or filter.'}
            action={tools.length === 0 ? (
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />Add first tool
              </button>
            ) : null}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((t) => (
              <div key={t.id} className="card p-4 group flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm">{t.name}</h3>
                    {t.category && (
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted">{t.category}</span>
                    )}
                  </div>
                  <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent transition-opacity" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {t.rating != null && (
                  <div className="flex items-center gap-0.5 mb-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= t.rating ? 'fill-accent text-accent' : 'text-border'}`} />
                    ))}
                  </div>
                )}

                {t.use_case && <p className="text-xs text-muted mb-2 line-clamp-2">{t.use_case}</p>}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border text-xs">
                  <span className="font-mono text-muted">{t.cost || '—'}</span>
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent inline-flex items-center gap-1">
                      visit <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => { setEditing(t); setModalOpen(true) }}
                  className="text-xs text-muted hover:text-white mt-2 text-left"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ToolModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={save}
        editing={editing}
      />
    </>
  )
}

function ToolModal({ open, onClose, onSave, editing }) {
  const [form, setForm] = useState({ name: '', category: 'writing', url: '', cost: '', use_case: '', rating: '', notes: '' })

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || '',
        category: editing.category || 'writing',
        url: editing.url || '',
        cost: editing.cost || '',
        use_case: editing.use_case || '',
        rating: editing.rating ?? '',
        notes: editing.notes || '',
      })
    } else {
      setForm({ name: '', category: 'writing', url: '', cost: '', use_case: '', rating: '', notes: '' })
    }
  }, [editing, open])

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit tool' : 'Add AI tool'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className="btn-primary">{editing ? 'Save' : 'Add tool'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label block mb-1.5">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Cost</label>
            <input className="input" placeholder="Free / $20mo / etc" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">URL</label>
          <input type="url" placeholder="https://…" className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div>
          <label className="label block mb-1.5">Use case</label>
          <textarea className="input min-h-16" placeholder="What do you use it for?" value={form.use_case} onChange={(e) => setForm({ ...form, use_case: e.target.value })} />
        </div>
        <div>
          <label className="label block mb-1.5">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setForm({ ...form, rating: n === form.rating ? '' : n })}
                aria-label={`${n} stars`}
              >
                <Star className={`w-5 h-5 ${n <= form.rating ? 'fill-accent text-accent' : 'text-border hover:text-muted'}`} />
              </button>
            ))}
            {form.rating && <button type="button" onClick={() => setForm({ ...form, rating: '' })} className="text-xs text-muted ml-2">clear</button>}
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Notes</label>
          <textarea className="input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </form>
    </Modal>
  )
}
