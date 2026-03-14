import { useState } from 'react';
import Dashboard from './components/Dashboard';
import DiagnosticsPage from './components/DiagnosticsPage';

function App() {
  const [view, setView] = useState<'dashboard' | 'diagnostics'>('dashboard');

  if (view === 'diagnostics') {
    return <DiagnosticsPage onBack={() => setView('dashboard')} />;
  }

  return <Dashboard onOpenDiagnostics={() => setView('diagnostics')} />;
}

export default App;
