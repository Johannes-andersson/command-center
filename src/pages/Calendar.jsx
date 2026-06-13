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
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalIcon } from 'lucide-react'
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
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)

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
    setEvents(data ?? [])
  }

  useEffect(() => { load() }, [cursor])

  const eventsForDay = (day) =>
    events.filter((e) => isSameDay(parseISO(e.event_date), day))

  const save = async (data) => {
    if (editing?.id) {
      await supabase.from('calendar_events').update(data).eq('id', editing.id)
    } else {
      await supabase.from('calendar_events').insert({ ...data, user_id: user.id })
    }
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this event?')) return
    await supabase.from('calendar_events').delete().eq('id', id)
    load()
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Your posting schedule and events"
        actions={
          <button onClick={() => { setEditing(null); setSelectedDate(null); setModalOpen(true) }} className="btn-primary">
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
                onClick={() => { setSelectedDate(day); setEditing(null); setModalOpen(true) }}
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

        {/* Upcoming list */}
        <div className="mt-6">
          <h3 className="label mb-2">All events this view</h3>
          {events.length === 0 ? (
            <div className="text-sm text-muted py-3">No events in this month.</div>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-elevated">
                  <span className="font-mono text-xs text-muted w-16">{format(parseISO(e.event_date), 'MMM dd')}</span>
                  <span className="flex-1 text-sm truncate">{e.title}</span>
                  {e.platform && (
                    <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${PLATFORM_COLORS[e.platform]}25`, color: PLATFORM_COLORS[e.platform] }}>
                      {e.platform}
                    </span>
                  )}
                  <button onClick={() => { setEditing(e); setModalOpen(true) }} className="text-xs text-muted hover:text-white">Edit</button>
                  <button onClick={() => remove(e.id)} aria-label="Delete" className="text-muted hover:text-accent">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setSelectedDate(null) }}
        onSave={save}
        editing={editing}
        defaultDate={selectedDate}
      />
    </>
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
          <textarea className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </form>
    </Modal>
  )
}
