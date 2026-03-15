import { useState } from 'react';
import Dashboard from './components/Dashboard';
import DiagnosticsPage from './components/DiagnosticsPage';
import HomePage from './components/HomePage';
import AdminLogin from './components/AdminLogin';

type View = 'home' | 'dashboard' | 'diagnostics' | 'admin-login';

function App() {
  const [view, setView] = useState<View>('home');
  const [adminAuthed, setAdminAuthed] = useState(false);

  if (view === 'admin-login') {
    return (
      <AdminLogin
        onAuthenticated={() => {
          setAdminAuthed(true);
          setView('diagnostics');
        }}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'diagnostics') {
    if (!adminAuthed) {
      return (
        <AdminLogin
          onAuthenticated={() => {
            setAdminAuthed(true);
            setView('diagnostics');
          }}
          onBack={() => setView('dashboard')}
        />
      );
    }
    return <DiagnosticsPage onBack={() => setView('dashboard')} onHome={() => setView('home')} />;
  }

  if (view === 'dashboard') {
    return <Dashboard onOpenDiagnostics={() => setView('diagnostics')} />;
  }

  return <HomePage onEnter={() => setView('dashboard')} />;
}

export default App;
