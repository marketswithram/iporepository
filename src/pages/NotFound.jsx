import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center animate-fade-in">
        <p className="text-8xl font-extrabold text-blue-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/"               className="btn btn-primary">Go to Home</Link>
          <Link to="/user/dashboard" className="btn btn-secondary">My Dashboard</Link>
        </div>
      </div>
    </div>
  )
}
