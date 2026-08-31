import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Blacklist from "@/pages/Blacklist";
import Stats from "@/pages/Stats";
import ConfigPage from "@/pages/Config";
import Logs from "@/pages/Logs";
import Cluster from "@/pages/Cluster";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/blacklist" element={<Blacklist />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/cluster" element={<Cluster />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  );
}
