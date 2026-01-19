import { Bug, Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5">
              <Bug className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Defect Analyzer</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Test Failure Analysis</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Powered by AI</span>
          </div>
        </div>
      </div>
    </header>
  );
}
