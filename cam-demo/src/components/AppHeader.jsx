import { Link, useLocation } from 'react-router-dom'

export default function AppHeader() {
  const { pathname } = useLocation()

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <span className="font-semibold text-slate-800 text-sm">CAM-Analyze</span>
        </div>
        <nav className="flex gap-1">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Run Simulation
          </Link>
          <Link
            to="/dashboard"
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              pathname === '/dashboard'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  )
}
