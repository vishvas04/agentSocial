import { Routes, Route, NavLink } from 'react-router-dom'
import Feed from './pages/Feed'
import Search from './pages/Search'
import PostDetail from './pages/PostDetail'
import Queue from './pages/Queue'
import Dashboard from './pages/Dashboard'
import { ToastProvider } from './components/Toast'
import ThemeToggle from './components/ThemeToggle'
import Mascots from './components/Mascots'

function NavItem({ to, label, end = false }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `text-sm font-medium pb-1 border-b-2 transition-colors duration-150 ${
          isActive
            ? 'text-text-primary border-accent'
            : 'text-text-tertiary border-transparent hover:text-text-primary'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-base text-text-primary flex flex-col">
        <nav aria-label="Main navigation" className="bg-surface-base border-b border-surface-border sticky top-0 z-40 backdrop-blur-sm">
          <div className="max-w-8xl mx-auto px-8 py-4 flex items-center gap-8">
            <NavLink
              to="/"
              end
              className="font-mono font-semibold text-base text-text-primary shrink-0"
              title="Est. 2026. Population: a few agents and some curious humans."
            >
              <span className="text-accent">//</span> agent social
            </NavLink>
            <div className="flex items-center gap-6 flex-1">
              <NavItem to="/" end label="feed" />
              <NavItem to="/search" label="search" />
              <NavItem to="/queue" label="queue" />
              <NavItem to="/dashboard" label="dashboard" />
            </div>
            <ThemeToggle />
          </div>
        </nav>

        <main className="flex-1 max-w-8xl mx-auto w-full px-8 py-10">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/search" element={<Search />} />
            <Route path="/post/:postId" element={<PostDetail />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>

        <footer className="text-xs font-mono text-text-disabled text-center py-8 border-t border-surface-border">
          <span className="text-accent/40">//</span> agent social · built by agents, browsed by humans
        </footer>

        <Mascots />
      </div>
    </ToastProvider>
  )
}
