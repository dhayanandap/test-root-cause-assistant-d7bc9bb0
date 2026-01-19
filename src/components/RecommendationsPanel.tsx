import { Lightbulb, ArrowRight, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Recommendation, Pattern } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  patterns: Pattern[];
}

const PRIORITY_STYLES = {
  high: {
    border: 'border-l-destructive',
    badge: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: AlertCircle,
  },
  medium: {
    border: 'border-l-yellow-500',
    badge: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    icon: Info,
  },
  low: {
    border: 'border-l-primary',
    badge: 'bg-primary/10 text-primary border-primary/30',
    icon: Lightbulb,
  },
};

export function RecommendationsPanel({ recommendations, patterns }: RecommendationsPanelProps) {
  return (
    <div className="space-y-6">
      {patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Detected Patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {patterns.map((pattern, index) => (
              <div key={index} className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{pattern.occurrences}x</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{pattern.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Affects: {pattern.affectedTests.slice(0, 3).join(', ')}
                    {pattern.affectedTests.length > 3 && ` +${pattern.affectedTests.length - 3} more`}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-primary" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recommendations.map((rec, index) => {
            const style = PRIORITY_STYLES[rec.priority];
            const Icon = style.icon;
            
            return (
              <Card key={index} className={cn('border-l-4', style.border)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <h4 className="font-semibold">{rec.title}</h4>
                    </div>
                    <Badge variant="outline" className={style.badge}>
                      {rec.priority} priority
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">{rec.description}</p>
                  
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Action Items
                    </h5>
                    <ul className="space-y-2">
                      {rec.actionItems.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
