import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Auth from './components/Auth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Kanban from './pages/Kanban'
import CalendarPage from './pages/Calendar'
import Todo from './pages/Todo'
import Sources from './pages/Sources'
import AITools from './pages/AITools'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted text-sm">Loading…</div>
      </div>
    )
  }

  if (!user) return <Auth />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="kanban" element={<Kanban />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="todo" element={<Todo />} />
        <Route path="sources" element={<Sources />} />
        <Route path="tools" element={<AITools />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
