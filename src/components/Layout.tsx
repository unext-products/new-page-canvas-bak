import { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background relative flex">
        {/* Subtle Animated Background Gradient */}
        <div className="fixed inset-0 z-0 bg-gradient-mesh animate-gradient-shift bg-[length:200%_200%] opacity-30" />
        <div className="fixed inset-0 z-0 bg-background/98 backdrop-blur-sm" />
        
        <AppSidebar />
        
        <div className="relative z-10 flex-1 flex flex-col">
          <header className="sticky top-0 z-50 h-16 border-b border-border/40 bg-background/40 backdrop-blur-xl flex items-center px-4 gap-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <ThemeToggle />
          </header>
          
          <main className="flex-1 container py-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
