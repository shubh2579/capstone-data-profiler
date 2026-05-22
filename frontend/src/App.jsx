import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout   from './components/Layout'
import Overview from './pages/Overview'
import Profile  from './pages/Profile'
import Clean    from './pages/Clean'
import SQL      from './pages/SQL'
import Anomaly  from './pages/Anomaly'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"        element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/clean"   element={<Clean />} />
          <Route path="/sql"     element={<SQL />} />
          <Route path="/anomaly" element={<Anomaly />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
