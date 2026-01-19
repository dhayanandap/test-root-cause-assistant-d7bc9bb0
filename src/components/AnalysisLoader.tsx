import { Loader2, FileSearch, Brain, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnalysisLoaderProps {
  stage: 'parsing' | 'analyzing' | 'generating';
}

const STAGES = [
  { id: 'parsing', label: 'Parsing Report', icon: FileSearch },
  { id: 'analyzing', label: 'Analyzing Failures', icon: Brain },
  { id: 'generating', label: 'Generating Insights', icon: CheckCircle },
];

export function AnalysisLoader({ stage }: AnalysisLoaderProps) {
  const currentIndex = STAGES.findIndex(s => s.id === stage);
  
  return (
    <Card className="border-primary/20">
      <CardContent className="py-12">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative rounded-full bg-primary/10 p-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          
          <h3 className="text-xl font-semibold mb-2">Analyzing Your Report</h3>
          <p className="text-muted-foreground mb-8 max-w-md">
            Our AI is examining test failures, identifying patterns, and preparing actionable insights.
          </p>
          
          <div className="flex items-center gap-2">
            {STAGES.map((s, index) => {
              const Icon = s.icon;
              const isActive = index === currentIndex;
              const isComplete = index < currentIndex;
              
              return (
                <div key={s.id} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full transition-all",
                    isActive && "bg-primary text-primary-foreground",
                    isComplete && "bg-primary/20 text-primary",
                    !isActive && !isComplete && "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                  </div>
                  {index < STAGES.length - 1 && (
                    <div className={cn(
                      "w-8 h-0.5 mx-1",
                      isComplete ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
