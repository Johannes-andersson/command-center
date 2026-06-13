import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Trash2, KanbanSquare, Pencil, GripVertical } from 'lucide-react'
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

// Custom collision detection: prefer pointer-within, fall back to rect intersection
function collisionDetectionStrategy(args) {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  return rectIntersection(args)
}

export default function Kanban() {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  // Separate mouse + touch sensors so desktop is instant and mobile still allows scrolling
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
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

  const cardsByColumn = useMemo(() => {
    const map = {}
    COLUMNS.forEach((c) => (map[c.id] = []))
    cards.forEach((c) => {
      if (map[c.status]) map[c.status].push(c)
    })
    return map
  }, [cards])

  const activeCard = useMemo(
    () => cards.find((c) => c.id === activeId),
    [cards, activeId]
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeCard = cards.find((c) => c.id === active.id)
    if (!activeCard) return

    // Target column id: either the column we hovered, or the column of the card we hovered
    const overId = over.id
    const targetStatus = COLUMNS.find((c) => c.id === overId)
      ? overId
      : cards.find((c) => c.id === overId)?.status

    if (!targetStatus || activeCard.status === targetStatus) return

    // Optimistic update
    setCards((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, status: targetStatus, updated_at: new Date().toISOString() }
          : c
      )
    )

    // Persist (fire and forget — UI already updated)
    supabase
      .from('kanban_cards')
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq('id', active.id)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to update card:', error)
          load() // reload to re-sync
        }
      })
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
    setCards((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('kanban_cards').delete().eq('id', id)
  }

  return (
    <>
      <PageHeader
        title="Content pipeline"
        subtitle="Drag cards between stages. Tap the pencil to edit."
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
            description="Add your first content idea. You can drag it across stages as it progresses."
            action={
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" />Add first card
              </button>
            }
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={(e) => setActiveId(e.active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
              {COLUMNS.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  cards={cardsByColumn[col.id]}
                  onEdit={(c) => { setEditing(c); setModalOpen(true) }}
                  onDelete={deleteCard}
                  activeId={activeId}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1)' }}>
              {activeCard ? <CardView card={activeCard} dragging /> : null}
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

function Column({ column, cards, onEdit, onDelete, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="w-80 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs uppercase tracking-wider text-muted font-medium">{column.label}</h3>
        <span className="text-xs font-mono text-muted">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-lg p-2 min-h-[200px] transition-colors duration-150 ${
          isOver
            ? 'bg-elevated border border-accent/60'
            : 'bg-surface border border-border'
        }`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {cards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                onEdit={onEdit}
                onDelete={onDelete}
                isActive={card.id === activeId}
              />
            ))}
            {cards.length === 0 && (
              <div className="text-xs text-muted/60 text-center py-6 select-none">
                Drop cards here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

function SortableCard({ card, onEdit, onDelete, isActive }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || isActive ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="touch-none"
    >
      <CardView
        card={card}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

function CardView({ card, onEdit, onDelete, dragging, dragHandleProps }) {
  const stop = (e) => { e.stopPropagation(); e.preventDefault() }

  return (
    <div
      className={`bg-elevated border rounded-lg p-3.5 relative ${
        dragging
          ? 'border-accent shadow-2xl rotate-1 scale-[1.02] cursor-grabbing'
          : 'border-border hover:border-muted'
      } transition-shadow`}
      style={{ willChange: dragging ? 'transform' : 'auto' }}
    >
      {/* Drag handle area — everything except buttons */}
      <div
        {...dragHandleProps}
        className="cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start gap-2 mb-2">
          <GripVertical className="w-4 h-4 text-muted/50 flex-shrink-0 mt-0.5" />
          <div className="text-sm font-medium leading-snug flex-1 pr-14">{card.title}</div>
        </div>

        {card.description && (
          <p className="text-xs text-muted line-clamp-2 mb-2 ml-6">{card.description}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap ml-6">
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

      {/* Edit / delete buttons — outside the drag area */}
      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5">
          {onEdit && (
            <button
              onPointerDown={stop}
              onMouseDown={stop}
              onTouchStart={stop}
              onClick={(e) => { stop(e); onEdit(card) }}
              className="text-muted hover:text-white p-1.5 rounded hover:bg-bg active:bg-bg"
              aria-label="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onPointerDown={stop}
              onMouseDown={stop}
              onTouchStart={stop}
              onClick={(e) => { stop(e); onDelete(card.id) }}
              className="text-muted hover:text-accent p-1.5 rounded hover:bg-bg active:bg-bg"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function CardModal({ open, onClose, onSave, editing }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    platform: 'tiktok',
    content_type: 'video',
    status: 'idea',
  })

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || '',
        description: editing.description || '',
        platform: editing.platform || 'tiktok',
        content_type: editing.content_type || 'video',
        status: editing.status || 'idea',
      })
    } else {
      setForm({ title: '', description: '', platform: 'tiktok', content_type: 'video', status: 'idea' })
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
