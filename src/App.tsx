import { lazy, Suspense } from "react";
import { isConfigured } from "@/lib/supabase";
const More = lazy(() => import("@/pages/More"));
const Tools = lazy(() => import("@/pages/Tools"));
import { Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileShell } from "@/components/MobileShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/useAuth";
const Home = lazy(() => import("@/pages/Home"));
const Activity = lazy(() => import("@/pages/Activity"));
const Insights = lazy(() => import("@/pages/Insights"));
const Budgets = lazy(() => import("@/pages/Budgets"));
const Settings = lazy(() => import("@/pages/Settings"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));

export default function App() {
  if (!isConfigured)
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-semibold">Connect Spendwise</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The app needs its Supabase connection before you can sign in. Follow
          the setup instructions in README.md, then restart the server.
        </p>
      </main>
    );
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        <Suspense
          fallback={
            <p role="status" className="p-8 text-sm text-muted-foreground">
              Loading…
            </p>
          }
        >
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
              <Route path="/transactions" element={<Activity />} />
              <Route path="/more" element={<More />} />
              {["/groups", "/categories", "/recurring", "/import"].map(
                (path) => (
                  <Route key={path} path={path} element={<Tools />} />
                ),
              )}
              <Route path="/insights" element={<Insights />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/settings" element={<Settings />} />
              {/* Legacy paths → merged destinations */}
              <Route
                path="/dashboard"
                element={<Navigate to="/insights" replace />}
              />
              <Route
                path="/lending"
                element={<Navigate to="/activity?filter=lending" replace />}
              />
              <Route
                path="/automate"
                element={<Navigate to="/recurring" replace />}
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
    </AuthProvider>
  );
}
