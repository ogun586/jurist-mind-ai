
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { JuristSidebar } from "@/components/JuristSidebar";
import { TopHeader } from "@/components/TopHeader";
import { ChatAuth } from "@/components/ChatAuth";
import { Onboarding } from "@/components/Onboarding";
import { supabase } from "@/integrations/supabase/client";
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
import SharedChatView from "./pages/SharedChatView";

const queryClient = new QueryClient();

// ─── Route Guards ──────────────────────────────────────────────────────────

// Auth route: redirect if already logged in
function AuthRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && profile?.onboarding_completed) return <Navigate to="/" replace />;
  if (user && !profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <ChatAuth />;
}

// Onboarding route: only if logged in, not yet completed
function OnboardingRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.onboarding_completed) return <Navigate to="/" replace />;
  return <Onboarding />;
}

// Protected route: full app with sidebar — requires auth + onboarding done
function ProtectedLayout() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile !== null && !profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;

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

// Loading screen
function LoadingScreen() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-2 text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}

// OAuth redirect handler
function OAuthHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (prof?.onboarding_completed) {
            navigate('/', { replace: true });
          } else {
            navigate('/onboarding', { replace: true });
          }
        }
      }
    );
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <OAuthHandler />
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
