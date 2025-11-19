interface BrowserMockupProps {
  children: React.ReactNode;
  title?: string;
}

export function BrowserMockup({ children, title = "ClockWise" }: BrowserMockupProps) {
  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-border/50 bg-background">
      {/* Browser Chrome */}
      <div className="bg-muted/30 border-b border-border/50 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
          <div className="w-3 h-3 rounded-full bg-green-500/20" />
        </div>
        <div className="flex-1 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1 bg-background/50 rounded-md text-xs text-muted-foreground">
            <span className="w-3 h-3 text-muted-foreground/40">🔒</span>
            <span>{title}</span>
          </div>
        </div>
        <div className="w-16" /> {/* Spacer for symmetry */}
      </div>
      
      {/* Content */}
      <div className="bg-muted/10">
        {children}
      </div>
    </div>
  );
}
