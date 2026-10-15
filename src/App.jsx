import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from './routes/RouteGuards'

import PublicLayout  from './layouts/PublicLayout'
import UserLayout    from './layouts/UserLayout'
import AdminLayout   from './layouts/AdminLayout'

import Home         from './pages/public/Home'
import About        from './pages/public/About'
import HowItWorks   from './pages/public/HowItWorks'
import PublicIpos   from './pages/public/PublicIpos'
import PublicIpoDetails from './pages/public/PublicIpoDetails'
import Login        from './pages/public/Login'
import Register     from './pages/public/Register'

import UserDashboard  from './pages/user/Dashboard'
import AvailableIpos  from './pages/user/AvailableIpos'
import Apply          from './pages/user/Apply'
import History        from './pages/user/History'
import ProfitLoss     from './pages/user/ProfitLoss'
import UserProfile    from './pages/user/Profile'
import IpoResult      from './pages/user/IpoResult'

import AdminDashboard from './pages/admin/Dashboard'
import IpoList        from './pages/admin/ipos/IpoList'
import CreateIpo      from './pages/admin/ipos/CreateIpo'
import IpoDetails     from './pages/admin/ipos/IpoDetails'
import ImportResults  from './pages/admin/ipos/ImportResults'
import AutomatedSettlement from './pages/admin/ipos/AutomatedSettlement'
import AdminUsers     from './pages/admin/Users'
import UserDetails    from './pages/admin/UserDetails'
import CreateUser     from './pages/admin/CreateUser'
import AdminReports   from './pages/admin/Reports'
import PendingApproval from './pages/public/PendingApproval'
import NotFound       from './pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* PUBLIC */}
          <Route element={<PublicLayout />}>
            <Route path="/"             element={<Home />} />
            <Route path="/about"        element={<About />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/ipos"         element={<PublicIpos />} />
            <Route path="/ipos/:ipoId"  element={<PublicIpoDetails />} />
            <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          </Route>

          {/* STANDALONE STATUS ROUTES */}
          <Route path="/pending-approval" element={<PendingApproval />} />

          {/* USER */}
          <Route path="/user" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"             element={<UserDashboard />} />
            <Route path="ipos"                  element={<AvailableIpos />} />
            <Route path="apply/:ipoId"          element={<Apply />} />
            <Route path="ipos/:participationId" element={<IpoResult />} />
            <Route path="history"               element={<History />} />
            <Route path="profit-loss"           element={<ProfitLoss />} />
            <Route path="profile"               element={<UserProfile />} />
          </Route>

          {/* ADMIN */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"             element={<AdminDashboard />} />
            <Route path="ipos"                  element={<IpoList />} />
            <Route path="ipos/create"           element={<CreateIpo />} />
            <Route path="ipos/:ipoId"           element={<IpoDetails />} />
            <Route path="ipos/:ipoId/results"   element={<ImportResults />} />
            <Route path="ipos/:ipoId/automated-settlement" element={<AutomatedSettlement />} />
            <Route path="ipos/automated-settlement"        element={<AutomatedSettlement />} />
            <Route path="users"                 element={<AdminUsers />} />
            <Route path="users/create"          element={<CreateUser />} />
            <Route path="users/:userId"         element={<UserDetails />} />
            <Route path="reports"               element={<AdminReports />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
