import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Trash2, KanbanSquare, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const COLUMNS = [
  { id: 'idea', label: 'Ideas' },
  { id: 'scripted', label: 'Scripted' },
  { id: 'filmed', label: 'Filmed / Designed' },
  { id: 'edited', label: 'Edited' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'posted', label: 'Posted' },
]

const PLATFORMS = ['tiktok', 'youtube', 'substack', 'facebook', 'instagram']
const CONTENT_TYPES = ['video', 'carousel', 'article', 'short']

export default function Kanban() {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('kanban_cards')
      .select('*')
      .order('position', { ascending: true })
    setCards(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const cardsByStatus = (status) => cards.filter((c) => c.status === status)
  const activeCard = cards.find((c) => c.id === activeId)

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeCard = cards.find((c) => c.id === active.id)
    if (!activeCard) return

    // Determine target column
    const overId = over.id
    const targetStatus = COLUMNS.find((c) => c.id === overId)
      ? overId
      : cards.find((c) => c.id === overId)?.status

    if (!targetStatus) return
    if (activeCard.status === targetStatus && active.id === over.id) return

    const updated = cards.map((c) =>
      c.id === active.id ? { ...c, status: targetStatus, updated_at: new Date().toISOString() } : c
    )
    setCards(updated)
    await supabase
      .from('kanban_cards')
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq('id', active.id)
  }

  const saveCard = async (data) => {
    if (editing?.id) {
      await supabase.from('kanban_cards').update(data).eq('id', editing.id)
    } else {
      await supabase.from('kanban_cards').insert({
        ...data,
        user_id: user.id,
        status: data.status || 'idea',
        position: cards.length,
      })
    }
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const deleteCard = async (id) => {
    if (!confirm('Delete this card?')) return
    await supabase.from('kanban_cards').delete().eq('id', id)
    load()
  }

  return (
    <>
      <PageHeader
        title="Content pipeline"
        subtitle="Drag cards between stages. Tap a card to edit."
        actions={
          <button onClick={() => { setEditing(null); setModalOpen(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New card</span>
          </button>
        }
      />

      <div className="p-4 md:p-6">
        {loading ? (
          <div className="text-sm text-muted p-4">Loading…</div>
        ) : cards.length === 0 ? (
          <EmptyState
            icon={KanbanSquare}
            title="No cards yet"
            description="Add your first content idea. You can move it across stages as it progresses."
            action={
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />Add first card
              </button>
            }
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(e) => setActiveId(e.active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
              {COLUMNS.map((col) => (
                <Column key={col.id} column={col} cards={cardsByStatus(col.id)} onEdit={(c) => { setEditing(c); setModalOpen(true) }} onDelete={deleteCard} />
              ))}
            </div>
            <DragOverlay>
              {activeCard && <Card card={activeCard} dragging />}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <CardModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={saveCard}
        editing={editing}
      />
    </>
  )
}

function Column({ column, cards, onEdit, onDelete }) {
  const { setNodeRef, isOver } = useSortable({ id: column.id, data: { type: 'column' } })
  return (
    <div ref={setNodeRef} className="w-72 flex-shrink-0 snap-start">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs uppercase tracking-wider text-muted font-medium">{column.label}</h3>
        <span className="text-xs font-mono text-muted">{cards.length}</span>
      </div>
      <div className={`bg-surface border rounded-lg p-2 min-h-[120px] transition-colors ${isOver ? 'border-accent' : 'border-border'}`}>
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {cards.map((card) => (
              <SortableCard key={card.id} card={card} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

function SortableCard({ card, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card card={card} onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

function Card({ card, onEdit, onDelete, dragging }) {
  const stop = (e) => { e.stopPropagation() }
  return (
    <div className={`bg-elevated border border-border rounded-md p-3 ${dragging ? 'shadow-2xl rotate-2' : 'hover:border-muted'} transition-colors cursor-grab active:cursor-grabbing relative group`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-medium leading-snug pr-12">{card.title}</div>
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 md:transition-opacity">
          {onEdit && (
            <button
              onPointerDown={stop}
              onClick={(e) => { stop(e); onEdit(card) }}
              className="text-muted hover:text-white p-1 rounded hover:bg-bg"
              aria-label="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onPointerDown={stop}
              onClick={(e) => { stop(e); onDelete(card.id) }}
              className="text-muted hover:text-accent p-1 rounded hover:bg-bg"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {card.description && (
        <p className="text-xs text-muted line-clamp-2 mb-2">{card.description}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {card.platform && (
          <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-bg text-muted border border-border">
            {card.platform}
          </span>
        )}
        {card.content_type && (
          <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-accent-dim/30 text-accent border border-accent-dim/40">
            {card.content_type}
          </span>
        )}
      </div>
    </div>
  )
}

function CardModal({ open, onClose, onSave, editing }) {
  const [form, setForm] = useState({ title: '', description: '', platform: 'tiktok', content_type: 'video', status: 'idea' })

  useEffect(() => {
    if (editing) setForm({ title: editing.title || '', description: editing.description || '', platform: editing.platform || 'tiktok', content_type: editing.content_type || 'video', status: editing.status || 'idea' })
    else setForm({ title: '', description: '', platform: 'tiktok', content_type: 'video', status: 'idea' })
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
      title={editing ? 'Edit card' : 'New content card'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className="btn-primary">{editing ? 'Save' : 'Create'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label block mb-1.5">Title</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
        </div>
        <div>
          <label className="label block mb-1.5">Description / hook</label>
          <textarea className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Type</label>
            <select className="input" value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}>
              {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Platform</label>
            <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Stage</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </form>
    </Modal>
  )
}
