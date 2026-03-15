import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function Dashboard() { return <h1>Dashboard</h1>; }
function TimelinePage() { return <h1>Timeline</h1>; }

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/topic/:slug" element={<TimelinePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
