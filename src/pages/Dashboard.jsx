import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { CheckSquare, KanbanSquare, Calendar as CalIcon, Flame, Plus, ArrowUpRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    openTodos: 0,
    dueToday: [],
    inProgress: 0,
    upcoming: [],
    postedThisWeek: 0,
    streak: 0,
  })
  const [quickTodo, setQuickTodo] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const [todos, due, kanban, upcoming, posted] = await Promise.all([
      supabase.from('todos').select('id', { count: 'exact', head: true }).eq('completed', false),
      supabase.from('todos').select('*').eq('completed', false).eq('due_date', today).order('priority', { ascending: false }),
      supabase.from('kanban_cards').select('id', { count: 'exact', head: true }).not('status', 'in', '("idea","posted")'),
      supabase.from('calendar_events').select('*').gte('event_date', today).order('event_date').limit(5),
      supabase.from('kanban_cards').select('id', { count: 'exact', head: true }).eq('status', 'posted').gte('updated_at', weekStart).lte('updated_at', weekEnd),
    ])

    setStats({
      openTodos: todos.count ?? 0,
      dueToday: due.data ?? [],
      inProgress: kanban.count ?? 0,
      upcoming: upcoming.data ?? [],
      postedThisWeek: posted.count ?? 0,
      streak: 0,
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const addQuickTodo = async (e) => {
    e.preventDefault()
    if (!quickTodo.trim()) return
    await supabase.from('todos').insert({
      title: quickTodo.trim(),
      user_id: user.id,
      due_date: format(new Date(), 'yyyy-MM-dd'),
      category: 'ai-brand',
      priority: 'medium',
    })
    setQuickTodo('')
    load()
  }

  const toggleTodo = async (id, completed) => {
    await supabase.from('todos').update({ completed: !completed }).eq('id', id)
    load()
  }

  const now = new Date()

  return (
    <>
      <PageHeader
        title={`${getGreeting()}, Johan`}
        subtitle={format(now, "EEEE, MMMM d · 'week' w")}
      />

      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {/* Stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Posted this week"
            value={stats.postedThisWeek}
            sub="/14 goal"
            icon={Flame}
            color="text-accent"
          />
          <StatCard
            label="In production"
            value={stats.inProgress}
            sub="kanban cards"
            icon={KanbanSquare}
            to="/kanban"
          />
          <StatCard
            label="Open todos"
            value={stats.openTodos}
            sub="across all"
            icon={CheckSquare}
            to="/todo"
          />
          <StatCard
            label="Upcoming events"
            value={stats.upcoming.length}
            sub="next 5"
            icon={CalIcon}
            to="/calendar"
          />
        </div>

        {/* Quick add */}
        <form onSubmit={addQuickTodo} className="flex gap-2">
          <input
            placeholder="Quick todo for today…"
            value={quickTodo}
            onChange={(e) => setQuickTodo(e.target.value)}
            className="input flex-1"
          />
          <button type="submit" className="btn-primary"><Plus className="w-4 h-4" />Add</button>
        </form>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Due today */}
          <section className="card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-medium text-sm">Due today</h2>
              <Link to="/todo" className="text-xs text-muted hover:text-white inline-flex items-center gap-1">
                All todos <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-2">
              {loading ? (
                <div className="p-3 text-sm text-muted">Loading…</div>
              ) : stats.dueToday.length === 0 ? (
                <div className="p-4 text-sm text-muted">Nothing due today. Pick something from your backlog or rest.</div>
              ) : (
                <ul className="space-y-1">
                  {stats.dueToday.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => toggleTodo(t.id, t.completed)}
                        className="w-full text-left flex items-start gap-3 px-3 py-2 rounded-md hover:bg-elevated transition-colors"
                      >
                        <span className={`mt-1 w-4 h-4 rounded border ${t.completed ? 'bg-accent border-accent' : 'border-border'} flex-shrink-0`} />
                        <div className="min-w-0">
                          <div className={`text-sm ${t.completed ? 'line-through text-muted' : ''}`}>{t.title}</div>
                          <div className="text-xs text-muted mt-0.5">
                            <span className="font-mono uppercase">{t.category}</span>
                            {t.priority === 'high' && <span className="ml-2 text-accent">high</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Upcoming events */}
          <section className="card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-medium text-sm">Coming up</h2>
              <Link to="/calendar" className="text-xs text-muted hover:text-white inline-flex items-center gap-1">
                Calendar <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-2">
              {loading ? (
                <div className="p-3 text-sm text-muted">Loading…</div>
              ) : stats.upcoming.length === 0 ? (
                <div className="p-4 text-sm text-muted">No upcoming events scheduled.</div>
              ) : (
                <ul className="space-y-1">
                  {stats.upcoming.map((e) => (
                    <li key={e.id} className="px-3 py-2 rounded-md hover:bg-elevated transition-colors">
                      <div className="flex items-baseline gap-3">
                        <div className="font-mono text-xs text-muted w-16 flex-shrink-0">
                          {isToday(parseISO(e.event_date)) ? 'TODAY' : format(parseISO(e.event_date), 'MMM dd')}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm truncate">{e.title}</div>
                          {e.platform && (
                            <div className="text-xs text-muted mt-0.5 uppercase font-mono">{e.platform}</div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-white', to }) {
  const body = (
    <div className="card p-4 hover:border-muted transition-colors h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="label">{label}</div>
        {Icon && <Icon className={`w-4 h-4 ${color === 'text-accent' ? 'text-accent' : 'text-muted'}`} />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl md:text-3xl font-semibold font-mono ${color}`}>{value}</span>
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}
