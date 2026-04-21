import { Routes, Route, Navigate } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MobileShell } from '@/components/MobileShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AuthProvider } from '@/hooks/useAuth';
import Home from '@/pages/Home';
import Activity from '@/pages/Activity';
import Insights from '@/pages/Insights';
import Automate from '@/pages/Automate';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            element={
              <ProtectedRoute>
                <MobileShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/automate" element={<Automate />} />
            <Route path="/settings" element={<Settings />} />
            {/* Legacy paths → merged destinations */}
            <Route path="/transactions" element={<Navigate to="/activity" replace />} />
            <Route path="/dashboard" element={<Navigate to="/insights" replace />} />
            <Route path="/budgets" element={<Navigate to="/insights" replace />} />
            <Route path="/lending" element={<Navigate to="/activity?filter=lending" replace />} />
            <Route path="/recurring" element={<Navigate to="/automate" replace />} />
            <Route path="/import" element={<Navigate to="/automate?tab=import" replace />} />
            <Route path="/groups" element={<Navigate to="/settings#groups" replace />} />
            <Route path="/categories" element={<Navigate to="/settings#categories" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  );
}
