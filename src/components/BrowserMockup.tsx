interface BrowserMockupProps {
  children: React.ReactNode;
  title?: string;
}

export function BrowserMockup({ children, title = "app.clockwisemab.com" }: BrowserMockupProps) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-premium-2xl border border-border/50 bg-card">
      {/* Browser Chrome */}
      <div className="bg-muted/50 border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive/70" />
          <div className="w-3 h-3 rounded-full bg-warning/70" />
          <div className="w-3 h-3 rounded-full bg-success/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-background rounded-lg text-xs text-muted-foreground border border-border/50">
            <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{title}</span>
          </div>
        </div>
        <div className="w-14" />
      </div>
      
      {/* Content */}
      <div className="bg-card">
        {children}
      </div>
    </div>
  );
}