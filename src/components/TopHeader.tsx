import { User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { NotificationCenter } from "@/components/NotificationCenter";

export function TopHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="h-12 bg-background/80 backdrop-blur-2xl border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between px-4 sticky top-0 z-30 flex-shrink-0">
      {/* Left — sidebar toggle */}
      <div className="flex items-center">
        <SidebarTrigger className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.05)] transition-all" />
      </div>

      {/* Right — notifications + avatar */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            {/* Bell */}
            <NotificationCenter />

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                  <Avatar className="w-8 h-8 ring-2 ring-primary/40 hover:ring-primary/70 transition-all cursor-pointer">
                    <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
                      {user.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-card/95 backdrop-blur-xl border-[rgba(255,255,255,0.09)] shadow-xl"
              >
                <DropdownMenuItem
                  onClick={() => navigate("/profile")}
                  className="text-foreground hover:bg-[rgba(255,255,255,0.06)] cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2 text-muted-foreground" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/profile")}
                  className="text-foreground hover:bg-[rgba(255,255,255,0.06)] cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.06)]" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-foreground hover:bg-[rgba(255,255,255,0.06)] cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2 text-muted-foreground" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button
            onClick={() => navigate("/auth")}
            className="bg-gradient-primary text-gold-foreground hover:shadow-gold-lg btn-lift text-sm font-semibold h-8 px-4"
          >
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
}
