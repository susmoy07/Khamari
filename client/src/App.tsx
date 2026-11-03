import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import WorkspaceApp from './pages/workspace/WorkspaceApp';
import type { Role } from './lib/types';

type RegisterRole = Exclude<Role, 'ADMIN'>;

function RootRouter() {
  const { user, loading } = useAuth();
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'login' | 'register';
    role: RegisterRole;
  }>({
    open: false,
    mode: 'login',
    role: 'FARMER',
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f4] text-emerald-700 dark:bg-[#0c1322] dark:text-emerald-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (user) {
    return <WorkspaceApp key={user.id} user={user} />;
  }

  return (
    <>
      <LandingPage
        onAuth={(mode, role = 'FARMER') => setAuthModal({ open: true, mode, role })}
      />
      {authModal.open && (
        <Login
          key={`${authModal.mode}-${authModal.role}`}
          initialMode={authModal.mode}
          initialRole={authModal.role}
          onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <RootRouter />
    </ThemeProvider>
  );
}
