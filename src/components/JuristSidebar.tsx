import { useState } from "react";
import {
  Search,
  MessageSquare,
  LayoutGrid,
  Briefcase,
  BarChart2,
  CalendarDays,
  FolderOpen,
  Gem,
  Settings,
  HelpCircle,
  Plus,
  Clock,
  Scale,
  MessagesSquare,
  ScanSearch,
  Crown,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChatHistory } from "@/components/ChatHistory";
import { useAuth } from "@/contexts/AuthContext";

const navigationItems = [
  { title: "Search",               url: "/search",      icon: Search },
  { title: "Chat",                 url: "/",            icon: MessageSquare },
  { title: "JTL",                  url: "/jtl",         icon: Scale },
  { title: "JuristLens",           url: "/juristlens",  icon: ScanSearch },
  { title: "Marketplace",          url: "/marketplace", icon: LayoutGrid },
  { title: "Find/Post Jobs",       url: "/jobs",        icon: Briefcase },
  { title: "Latest Cases Report",  url: "/judge-notes", icon: BarChart2 },
  { title: "Diary",                url: "/diary",       icon: CalendarDays },
  { title: "Cases",                url: "/cases",       icon: FolderOpen },
  { title: "Connect with Lawyers", url: "/lawyers",     icon: Gem },
  { title: "All Chats",            url: "/recent",     icon: MessagesSquare },
];

const bottomItems = [
  { title: "Upgrade",  url: "/upgrade",  icon: Crown },
  { title: "Settings", url: "/profile",  icon: Settings },
  { title: "Support",  url: "/terms",    icon: HelpCircle },
];

export function JuristSidebar() {
  const { state } = useSidebar();
  const location  = useLocation();
  const navigate  = useNavigate();
  const { profile } = useAuth();
  const currentPath = location.pathname;
  const collapsed   = state === "collapsed";
  const [showHistory, setShowHistory] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/" || currentPath.startsWith("/chat");
    return currentPath.startsWith(path);
  };

  const handleNewChat = () => {
    navigate("/", { replace: true });
    window.dispatchEvent(new CustomEvent("newChat"));
  };

  return (
    <Sidebar className={`${collapsed ? "w-16" : "w-60"} transition-all duration-300 border-r border-sidebar-border`}>
      <SidebarContent className="flex flex-col h-full bg-sidebar overflow-hidden">

        {/* ── Logo ── */}
        <div className={`flex-shrink-0 ${collapsed ? "px-3 py-5" : "px-5 py-5"}`}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
              <Scale className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <div>
              <h1 className="text-[17px] font-bold text-foreground tracking-tight leading-none">
                Jurist Mind
              </h1>
              <p className="text-[10px] font-medium text-muted-foreground tracking-[0.18em] mt-0.5 uppercase">
                Digital Barrister
              </p>
            </div>
          )}
        </div>

        {/* ── New Chat Button ── */}
        <div className={`flex-shrink-0 ${collapsed ? "px-2 pb-3" : "px-4 pb-3"}`}>
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center gap-2.5 rounded-xl border border-primary/50 text-primary font-semibold text-sm transition-all hover:bg-primary/8 hover:border-primary hover:shadow-[0_0_12px_rgba(201,168,76,0.18)] ${
              collapsed ? "justify-center p-2.5" : "px-4 py-2.5"
            }`}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* ── Nav Items ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-0.5 scrollbar-hide">
          <SidebarMenu className="space-y-0.5">
            {navigationItems.map((item) => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <button
                      onClick={() => navigate(item.url)}
                      className={`flex items-center gap-3 w-full text-left rounded-lg transition-all duration-150 relative ${
                        collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"
                      } ${
                        active
                          ? "text-primary bg-primary/8"
                          : "text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.04)]"
                      }`}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                      )}
                      <item.icon
                        className={`flex-shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"} ${active ? "text-primary" : ""}`}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      {!collapsed && (
                        <span className={`text-[13.5px] font-medium ${active ? "text-foreground" : ""}`}>
                          {item.title}
                        </span>
                      )}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
            {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={() => navigate('/admin')}
                    className={`flex items-center gap-3 w-full text-left rounded-lg transition-all duration-150 relative ${
                      collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"
                    } ${
                      isActive('/admin')
                        ? "text-primary bg-primary/8"
                        : "text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.04)]"
                    }`}
                  >
                    <Shield
                      className={`flex-shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"} ${isActive('/admin') ? "text-primary" : ""}`}
                      strokeWidth={isActive('/admin') ? 2.2 : 1.8}
                    />
                    {!collapsed && <span className="text-[13.5px] font-medium">Admin Panel</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </div>

        {/* ── History ── */}
        {!collapsed && (
          <div className="flex-shrink-0 px-2 pt-2 pb-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="w-3 h-3" />
              <span>History</span>
              {showHistory ? (
                <ChevronDown className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronRight className="w-3 h-3 ml-auto" />
              )}
            </button>
            {showHistory && (
              <div className="mt-1 max-h-40 overflow-y-auto">
                <ChatHistory onNewChat={handleNewChat} compact={true} />
              </div>
            )}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="mx-4 h-px bg-[rgba(255,255,255,0.06)] flex-shrink-0" />

        {/* ── Bottom Items ── */}
        <div className={`flex-shrink-0 pb-4 pt-2 px-2 space-y-0.5`}>
          {bottomItems.map((item) => {
            const active = isActive(item.url) && item.url !== "/terms";
            return (
              <button
                key={item.title}
                onClick={() => navigate(item.url)}
                className={`flex items-center gap-3 w-full text-left rounded-lg transition-all duration-150 ${
                  collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"
                } ${
                  item.title === "Upgrade"
                    ? "text-primary hover:bg-primary/8 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                <item.icon
                  className={`flex-shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"}`}
                  strokeWidth={item.title === "Upgrade" ? 2.2 : 1.8}
                />
                {!collapsed && (
                  <span className="text-[13.5px] font-medium">{item.title}</span>
                )}
              </button>
            );
          })}
        </div>

      </SidebarContent>
    </Sidebar>
  );
}
