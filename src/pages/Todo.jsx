import { useEffect, useMemo, useState } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { Plus, Trash2, CheckSquare, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const CATEGORIES = [
  { id: 'ai-brand', label: 'AI brand' },
  { id: 'client', label: 'Client work' },
  { id: 'personal', label: 'Personal' },
]

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

export default function Todo() {
  const { user } = useAuth()
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [category, setCategory] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('todos').select('*').order('created_at', { ascending: false })
    setTodos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = [...todos]
    if (filter === 'open') list = list.filter((t) => !t.completed)
    if (filter === 'done') list = list.filter((t) => t.completed)
    if (category !== 'all') list = list.filter((t) => t.category === category)
    list.sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority] ?? 1
      const pb = PRIORITY_RANK[b.priority] ?? 1
      return pa - pb
    })
    return list
  }, [todos, filter, category])

  const toggle = async (todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    setTodos(todos.map((t) => t.id === todo.id ? { ...t, completed: !t.completed } : t))
  }

  const save = async (data) => {
    if (editing?.id) {
      await supabase.from('todos').update(data).eq('id', editing.id)
    } else {
      await supabase.from('todos').insert({ ...data, user_id: user.id })
    }
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this todo?')) return
    await supabase.from('todos').delete().eq('id', id)
    setTodos(todos.filter((t) => t.id !== id))
  }

  return (
    <>
      <PageHeader
        title="Todos"
        subtitle="Tasks across all your work streams"
        actions={
          <button onClick={() => { setEditing(null); setModalOpen(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New todo</span>
          </button>
        }
      />

      <div className="p-4 md:p-8 max-w-3xl">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted" />
          <div className="flex bg-surface border border-border rounded-md p-0.5 text-xs">
            {['open', 'done', 'all'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded ${filter === f ? 'bg-elevated text-white' : 'text-muted hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex bg-surface border border-border rounded-md p-0.5 text-xs">
            <button onClick={() => setCategory('all')} className={`px-2.5 py-1 rounded ${category === 'all' ? 'bg-elevated text-white' : 'text-muted hover:text-white'}`}>all</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={`px-2.5 py-1 rounded ${category === c.id ? 'bg-elevated text-white' : 'text-muted hover:text-white'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted py-4">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nothing here"
            description={filter === 'open' ? "All done. Add a new todo or take a break." : 'No items match these filters.'}
          />
        ) : (
          <ul className="space-y-1">
            {filtered.map((t) => {
              const overdue = t.due_date && !t.completed && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
              return (
                <li key={t.id} className="group flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-surface transition-colors">
                  <button
                    onClick={() => toggle(t)}
                    className={`mt-0.5 w-4 h-4 rounded border ${t.completed ? 'bg-accent border-accent' : 'border-border hover:border-muted'} flex-shrink-0 transition-colors`}
                    aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                  />
                  <button
                    onClick={() => { setEditing(t); setModalOpen(true) }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={`text-sm ${t.completed ? 'line-through text-muted' : ''}`}>{t.title}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      {t.category && <span className="text-muted uppercase font-mono">{t.category}</span>}
                      {t.priority === 'high' && <span className="text-accent">high</span>}
                      {t.due_date && (
                        <span className={`font-mono ${overdue ? 'text-accent' : 'text-muted'}`}>
                          {isToday(parseISO(t.due_date)) ? 'today' : format(parseISO(t.due_date), 'MMM dd')}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    aria-label="Delete"
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent p-1 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <TodoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={save}
        editing={editing}
      />
    </>
  )
}

function TodoModal({ open, onClose, onSave, editing }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'ai-brand', priority: 'medium', due_date: '' })

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || '',
        description: editing.description || '',
        category: editing.category || 'ai-brand',
        priority: editing.priority || 'medium',
        due_date: editing.due_date || '',
      })
    } else {
      setForm({ title: '', description: '', category: 'ai-brand', priority: 'medium', due_date: '' })
    }
  }, [editing, open])

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const payload = { ...form }
    if (!payload.due_date) delete payload.due_date
    onSave(payload)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit todo' : 'New todo'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className="btn-primary">{editing ? 'Save' : 'Create'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label block mb-1.5">What needs doing?</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
        </div>
        <div>
          <label className="label block mb-1.5">Notes (optional)</label>
          <textarea className="input min-h-16" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Priority</label>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Due date (optional)</label>
          <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
      </form>
    </Modal>
  )
}
