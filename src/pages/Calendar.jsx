import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const PLATFORMS = ['tiktok', 'youtube', 'substack', 'facebook', 'instagram', 'other']

const PLATFORM_COLORS = {
  tiktok: '#ef4444',
  youtube: '#dc2626',
  substack: '#f59e0b',
  facebook: '#3b82f6',
  instagram: '#a855f7',
  other: '#71717a',
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [cursor, setCursor] = useState(startOfMonth(new Date()))
  const [events, setEvents] = useState([])
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [createDate, setCreateDate] = useState(null)
  const [dayDetailDate, setDayDetailDate] = useState(null)

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd])

  const load = async () => {
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', format(gridStart, 'yyyy-MM-dd'))
      .lte('event_date', format(gridEnd, 'yyyy-MM-dd'))
      .order('event_date')
      .order('event_time', { nullsFirst: true })
    setEvents(data ?? [])
  }

  useEffect(() => { load() }, [cursor])

  const eventsForDay = (day) =>
    events.filter((e) => isSameDay(parseISO(e.event_date), day))

  const dayDetailEvents = useMemo(() => {
    if (!dayDetailDate) return []
    return eventsForDay(dayDetailDate)
  }, [dayDetailDate, events])

  const openDay = (day) => {
    const hasEvents = eventsForDay(day).length > 0
    if (hasEvents) {
      setDayDetailDate(day)
    } else {
      setEditing(null)
      setCreateDate(day)
      setEditModalOpen(true)
    }
  }

  const openEventDetail = (event) => {
    setDayDetailDate(parseISO(event.event_date))
  }

  const startEdit = (event) => {
    setEditing(event)
    setCreateDate(null)
    setEditModalOpen(true)
    setDayDetailDate(null)
  }

  const startCreate = (date) => {
    setEditing(null)
    setCreateDate(date || new Date())
    setEditModalOpen(true)
    setDayDetailDate(null)
  }

  const save = async (data) => {
    if (editing?.id) {
      await supabase.from('calendar_events').update(data).eq('id', editing.id)
    } else {
      await supabase.from('calendar_events').insert({ ...data, user_id: user.id })
    }
    setEditModalOpen(false)
    setEditing(null)
    setCreateDate(null)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this event?')) return
    await supabase.from('calendar_events').delete().eq('id', id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    // If we just deleted the last event for the open day, close detail
    if (dayDetailDate) {
      const remaining = events.filter((e) => e.id !== id && isSameDay(parseISO(e.event_date), dayDetailDate))
      if (remaining.length === 0) setDayDetailDate(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Your posting schedule and events"
        actions={
          <button onClick={() => startCreate(new Date())} className="btn-primary">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New event</span>
          </button>
        }
      />

      <div className="p-4 md:p-8">
        {/* Month switcher */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="btn-ghost" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold">{format(cursor, 'MMMM yyyy')}</h2>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="btn-ghost" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-[10px] md:text-xs text-muted uppercase tracking-wider text-center py-2 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {days.map((day) => {
            const dayEvents = eventsForDay(day)
            const inMonth = isSameMonth(day, cursor)
            const todayFlag = isToday(day)
            return (
              <button
                key={day.toISOString()}
                onClick={() => openDay(day)}
                className={`bg-surface min-h-[64px] md:min-h-[100px] p-1.5 text-left hover:bg-elevated transition-colors ${!inMonth && 'opacity-40'}`}
              >
                <div className={`text-xs font-mono mb-1 ${todayFlag ? 'text-accent font-bold' : ''}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className="text-[10px] md:text-xs px-1 py-0.5 rounded truncate"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[e.platform] || '#71717a'}25`,
                        color: PLATFORM_COLORS[e.platform] || '#a1a1aa',
                      }}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* All events list */}
        <div className="mt-6">
          <h3 className="label mb-2">All events this view</h3>
          {events.length === 0 ? (
            <div className="text-sm text-muted py-3">No events in this month.</div>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {events.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => openEventDetail(e)}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-elevated transition-colors text-left"
                  >
                    <span className="font-mono text-xs text-muted w-16 flex-shrink-0">
                      {format(parseISO(e.event_date), 'MMM dd')}
                    </span>
                    <span className="flex-1 text-sm truncate">{e.title}</span>
                    {e.event_time && (
                      <span className="text-xs text-muted font-mono hidden sm:inline">
                        {e.event_time.slice(0, 5)}
                      </span>
                    )}
                    {e.platform && (
                      <span
                        className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          backgroundColor: `${PLATFORM_COLORS[e.platform]}25`,
                          color: PLATFORM_COLORS[e.platform],
                        }}
                      >
                        {e.platform}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Day detail modal — read view with edit/delete actions */}
      <DayDetailModal
        open={!!dayDetailDate}
        date={dayDetailDate}
        events={dayDetailEvents}
        onClose={() => setDayDetailDate(null)}
        onEdit={startEdit}
        onDelete={remove}
        onAdd={() => startCreate(dayDetailDate)}
      />

      {/* Edit/create modal */}
      <EventModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditing(null); setCreateDate(null) }}
        onSave={save}
        editing={editing}
        defaultDate={createDate}
      />
    </>
  )
}

function DayDetailModal({ open, date, events, onClose, onEdit, onDelete, onAdd }) {
  if (!date) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={format(date, 'EEEE, MMMM d')}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Close</button>
          <button onClick={onAdd} className="btn-surface">
            <Plus className="w-4 h-4" />Add event
          </button>
        </>
      }
    >
      {events.length === 0 ? (
        <div className="text-sm text-muted py-4">No events on this day.</div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="border border-border rounded-lg p-3 bg-elevated">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm leading-snug">{e.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                    {e.event_time && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {e.event_time.slice(0, 5)}
                      </span>
                    )}
                    {e.platform && (
                      <span
                        className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${PLATFORM_COLORS[e.platform]}25`,
                          color: PLATFORM_COLORS[e.platform],
                        }}
                      >
                        {e.platform}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => onEdit(e)}
                    className="p-1.5 rounded text-muted hover:text-white hover:bg-bg"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(e.id)}
                    className="p-1.5 rounded text-muted hover:text-accent hover:bg-bg"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {e.description ? (
                <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">
                  {e.description}
                </p>
              ) : (
                <p className="text-xs text-muted/60 italic">No notes</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function EventModal({ open, onClose, onSave, editing, defaultDate }) {
  const [form, setForm] = useState({ title: '', description: '', event_date: '', event_time: '', platform: 'tiktok' })

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || '',
        description: editing.description || '',
        event_date: editing.event_date || '',
        event_time: editing.event_time || '',
        platform: editing.platform || 'tiktok',
      })
    } else {
      const d = defaultDate || new Date()
      setForm({ title: '', description: '', event_date: format(d, 'yyyy-MM-dd'), event_time: '', platform: 'tiktok' })
    }
  }, [editing, defaultDate, open])

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) return
    const payload = { ...form }
    if (!payload.event_time) delete payload.event_time
    onSave(payload)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit event' : 'New event'}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Date</label>
            <input type="date" className="input" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
          </div>
          <div>
            <label className="label block mb-1.5">Time (optional)</label>
            <input type="time" className="input" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Platform</label>
          <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label block mb-1.5">Notes</label>
          <textarea className="input min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </form>
    </Modal>
  )
}
