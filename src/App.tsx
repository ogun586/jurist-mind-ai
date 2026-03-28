
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { JuristSidebar } from "@/components/JuristSidebar";
import { TopHeader } from "@/components/TopHeader";
import { ChatAuth } from "@/components/ChatAuth";
import { Onboarding } from "@/components/Onboarding";
import Index from "./pages/Index";
import Search from "./pages/Search";
import Cases from "./pages/Cases";
import Diary from "./pages/Diary";
import Jobs from "./pages/Jobs";
import Marketplace from "./pages/Marketplace";
import LawyersDirectory from "./pages/LawyersDirectory";
import { LawyerProfilePage } from "@/components/lawyers";
import JudgeNotes from "./pages/JudgeNotes";
import JTL from "./pages/JTL";
import JuristLens from "./pages/JuristLens";
import History from "./pages/History";
import Upgrade from "./pages/Upgrade";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Profile from "./pages/Profile";
import Recent from "./pages/Recent";
import SharedChatView from "./pages/SharedChatView";

const queryClient = new QueryClient();

// ─── Loading Screen ────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0c',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(201,168,76,0.15)',
          borderTop: '3px solid #c9a84c',
          borderRadius: '50%',
          animation: 'goldSpin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes goldSpin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#6b6b80', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
        Loading Jurist Mind…
      </p>
    </div>
  );
}

// ─── Route Guards ──────────────────────────────────────────────────────────

function AuthRoute() {
  const { user, profile, loading, profileLoading } = useAuth();
  if (loading || profileLoading) return <LoadingScreen />;
  if (user && profile?.onboarding_completed) return <Navigate to="/" replace />;
  if (user && !profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <ChatAuth />;
}

function OnboardingRoute() {
  const { user, profile, loading, profileLoading } = useAuth();
  if (loading || profileLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.onboarding_completed) return <Navigate to="/" replace />;
  return <Onboarding />;
}

function ProtectedLayout() {
  const { user, profile, loading, profileLoading } = useAuth();
  if (loading || profileLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <JuristSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopHeader />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/chat/:sessionId" element={<Index />} />
              <Route path="/search" element={<Search />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/diary" element={<Diary />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/lawyers" element={<LawyersDirectory />} />
              <Route path="/lawyers/:slug" element={<LawyerProfilePage />} />
              <Route path="/judge-notes" element={<JudgeNotes />} />
              <Route path="/jtl" element={<JTL />} />
              <Route path="/juristlens" element={<JuristLens />} />
              <Route path="/history" element={<History />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/share/:token" element={<SharedChatView />} />
            <Route path="/onboarding" element={<OnboardingRoute />} />

            {/* All protected routes via layout */}
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
