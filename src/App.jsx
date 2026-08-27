import { Navigate, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Panorama from './pages/Panorama.jsx'
import Pipeline from './pages/Pipeline.jsx'
import Lab from './pages/Lab.jsx'
import Compare from './pages/Compare.jsx'
import Diagnosis from './pages/Diagnosis.jsx'
import Agent from './pages/Agent.jsx'
import HardwareCalculatorPage from './pages/HardwareCalculatorPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/panorama" element={<Panorama />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/hardware" element={<HardwareCalculatorPage />} />
        <Route path="/diagnosis" element={<Diagnosis />} />
        <Route path="/detective" element={<Navigate to="/diagnosis" replace />} />
        <Route path="/agent" element={<Agent />} />
      </Route>
    </Routes>
  )
}
