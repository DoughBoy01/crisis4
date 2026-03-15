import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Dashboard from './components/Dashboard';
import DiagnosticsPage from './components/DiagnosticsPage';
import HomePage from './components/HomePage';
import AdminLogin from './components/AdminLogin';

type View = 'home' | 'dashboard' | 'diagnostics' | 'admin-login';

function App() {
  const [view, setView] = useState<View>('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const role = data.session?.user?.app_metadata?.role;
      setIsAdmin(role === 'admin');
      setSessionChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const role = session?.user?.app_metadata?.role;
      setIsAdmin(role === 'admin');
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!sessionChecked) return null;

  if (view === 'admin-login') {
    return (
      <AdminLogin
        onAuthenticated={() => {
          setIsAdmin(true);
          setView('dashboard');
        }}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'diagnostics') {
    if (!isAdmin) {
      return (
        <AdminLogin
          onAuthenticated={() => {
            setIsAdmin(true);
            setView('diagnostics');
          }}
          onBack={() => setView('dashboard')}
        />
      );
    }
    return <DiagnosticsPage onBack={() => setView('dashboard')} onHome={() => setView('home')} />;
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        onOpenDiagnostics={isAdmin ? () => setView('diagnostics') : undefined}
        onAdminLogin={!isAdmin ? () => setView('admin-login') : undefined}
        onAdminSignOut={isAdmin ? async () => {
          await supabase.auth.signOut();
          setIsAdmin(false);
        } : undefined}
        isAdmin={isAdmin}
      />
    );
  }

  return <HomePage onEnter={() => setView('dashboard')} />;
}

export default App;
