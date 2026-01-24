import { useState } from "react";
import { Search, MessageCircle, Scale, History, User, ShoppingBag, Briefcase, FileText, BookOpen, FolderOpen, Crown, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ChatHistory } from "@/components/ChatHistory";

const navigationItems = [
  { title: "Search", url: "/search", icon: Search },
  { title: "Chat", url: "/", icon: MessageCircle },
  { title: "JTL", url: "/jtl", icon: Scale },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag },
  { title: "Find/Post Jobs", url: "/jobs", icon: Briefcase },
  { title: "Latest Cases Report", url: "/judge-notes", icon: FileText },
  { title: "Diary", url: "/diary", icon: BookOpen },
  { title: "Cases", url: "/cases", icon: FolderOpen },
  { title: "Connect with Lawyers", url: "/lawyers", icon: User },
  { title: "Upgrade", url: "/upgrade", icon: Crown },
];

export function JuristSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [showChatHistory, setShowChatHistory] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  const getNavClasses = (active: boolean) =>
    active
      ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium border-l-2 border-sidebar-primary"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  const handleNewChat = () => {
    // Navigate to fresh chat without any session params
    navigate('/', { replace: true });
    // Dispatch custom event to notify ChatInterface
    window.dispatchEvent(new CustomEvent('newChat'));
  };

  const handleNavigation = (url: string) => {
    navigate(url);
  };

  return (
    <Sidebar className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300`}>
      <SidebarContent className="bg-sidebar border-r border-sidebar-border">
        {/* Logo Section */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">JURIST</h1>
                <p className="text-sm text-sidebar-foreground/70">MIND</p>
              </div>
            )}
          </div>
        </div>

        {/* New Chat Button - Positioned Right Below Logo */}
        <div className="px-3 py-3 border-b border-sidebar-border">
          <Button
            onClick={handleNewChat}
            className={`w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-primary-foreground ${
              collapsed ? "px-2" : "px-4"
            }`}
            size={collapsed ? "icon" : "default"}
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">New Chat</span>}
          </Button>
        </div>

        {/* Navigation */}
        <SidebarGroup className="px-2 py-4">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <button
                      onClick={() => handleNavigation(item.url)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full text-left ${getNavClasses(
                        isActive(item.url)
                      )}`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Chat History Section */}
        {!collapsed && (
          <SidebarGroup className="px-2">
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Chat History</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChatHistory(!showChatHistory)}
                className="h-6 w-6 p-0"
              >
                <History className="w-4 h-4" />
              </Button>
            </SidebarGroupLabel>
            {showChatHistory && (
              <SidebarGroupContent>
                <ChatHistory 
                  onNewChat={handleNewChat}
                  compact={true}
                />
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        {/* User Profile Section */}
        {!collapsed && (
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <button
              onClick={() => handleNavigation('/profile')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="text-sm">Profile</span>
            </button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
