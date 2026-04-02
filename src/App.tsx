import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LabelProvider } from "@/contexts/LabelContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Timesheet from "./pages/Timesheet";
import Approvals from "./pages/Approvals";
import Users from "./pages/Users";
import Organizations from "./pages/Organizations";
import Programs from "./pages/Programs";
import Departments from "./pages/Departments";
import Verticals from "./pages/Verticals";
import Batches from "./pages/Batches";
import Terms from "./pages/Terms";
import Subjects from "./pages/Subjects";
import Reports from "./pages/Reports";
import BulkImport from "./pages/BulkImport";
import Pricing from "./pages/Pricing";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import CalendarPage from "./pages/Calendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="clockwise-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LabelProvider>
              <ImpersonationProvider>
                <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/pricing" element={<Pricing />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/timesheet" element={<ProtectedRoute><Timesheet /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
                <Route path="/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
                <Route path="/programs" element={<ProtectedRoute><Programs /></ProtectedRoute>} />
                <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
                <Route path="/verticals" element={<ProtectedRoute><Verticals /></ProtectedRoute>} />
                <Route path="/batches" element={<ProtectedRoute><Batches /></ProtectedRoute>} />
                <Route path="/terms" element={<ProtectedRoute><Terms /></ProtectedRoute>} />
                <Route path="/subjects" element={<ProtectedRoute><Subjects /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/bulk-import" element={<ProtectedRoute><BulkImport /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
                </Routes>
              </ImpersonationProvider>
            </LabelProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
