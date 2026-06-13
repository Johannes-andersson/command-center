import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  KanbanSquare,
  Calendar,
  CheckSquare,
  Bookmark,
  Wrench,
  LogOut,
  Terminal,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const tabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/kanban', label: 'Kanban', icon: KanbanSquare },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/todo', label: 'Todo', icon: CheckSquare },
  { to: '/sources', label: 'Sources', icon: Bookmark },
  { to: '/tools', label: 'AI Tools', icon: Wrench },
]

export default function Layout() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-border bg-bg sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-border">
          <Terminal className="w-5 h-5 text-accent" />
          <span className="font-mono text-sm tracking-tight">
            command<span className="text-accent">/</span>center
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-elevated text-white'
                    : 'text-muted hover:text-white hover:bg-surface'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted truncate" title={user?.email}>
            {user?.email}
          </div>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted hover:text-white hover:bg-surface transition-colors">
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-bg sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-accent" />
          <span className="font-mono text-sm tracking-tight">
            command<span className="text-accent">/</span>center
          </span>
        </div>
        <button onClick={signOut} aria-label="Sign out" className="p-2 text-muted">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg border-t border-border z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
