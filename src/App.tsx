import { useState } from 'react';
import Dashboard from './components/Dashboard';
import DiagnosticsPage from './components/DiagnosticsPage';
import HomePage from './components/HomePage';

type View = 'home' | 'dashboard' | 'diagnostics';

function App() {
  const [view, setView] = useState<View>('home');

  if (view === 'diagnostics') {
    return <DiagnosticsPage onBack={() => setView('dashboard')} onHome={() => setView('home')} />;
  }

  if (view === 'dashboard') {
    return <Dashboard onOpenDiagnostics={() => setView('diagnostics')} />;
  }

  return <HomePage onEnter={() => setView('dashboard')} />;
}

export default App;
