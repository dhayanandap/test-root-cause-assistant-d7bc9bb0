import { ChevronDown, ChevronUp, AlertTriangle, Bug, Database, Server, Settings, Zap, Image } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FailureAnalysis, CATEGORY_LABELS, DefectCategory, TestCase } from '@/types/analysis';
import { CreateJiraIssueButton } from '@/components/CreateJiraIssueButton';
import { cn } from '@/lib/utils';

interface FailureCardProps {
  failure: FailureAnalysis;
  onJiraIssueCreated?: (issueKey: string) => void;
}

const CATEGORY_ICONS: Record<DefectCategory, React.ComponentType<{ className?: string }>> = {
  application_defect: Bug,
  automation_script_defect: Settings,
  test_data_issue: Database,
  environment_issue: Server,
  configuration_issue: Settings,
  flaky_test: Zap,
};

const CONFIDENCE_COLORS = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function FailureCard({ failure, onJiraIssueCreated }: FailureCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = CATEGORY_ICONS[failure.category] || Bug;
  const testCase: TestCase = failure.testCase || { 
    id: 'unknown', 
    name: 'Unknown Test', 
    className: 'Unknown Class',
    status: 'fail',
    duration: 0
  };
  
  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="rounded-lg bg-destructive/10 p-2 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold truncate">
                    {testCase.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {testCase.className}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{CATEGORY_LABELS[failure.category] || 'Unknown'}</span>
                </Badge>
                <Badge className={cn('capitalize', CONFIDENCE_COLORS[failure.confidence] || CONFIDENCE_COLORS.low)}>
                  {failure.confidence || 'low'}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="border-t bg-muted/30 space-y-4">
            {/* JIRA Integration for Application Defects */}
            {failure.category === 'application_defect' && (
              <div className="flex items-center justify-between py-2 px-3 bg-primary/5 rounded-md border border-primary/20">
                <span className="text-sm font-medium">Application Defect Detected</span>
                <CreateJiraIssueButton 
                  failure={failure} 
                  onIssueCreated={onJiraIssueCreated}
                />
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-semibold mb-2">Root Cause Analysis</h4>
              <p className="text-sm text-muted-foreground">{failure.rootCause}</p>
            </div>
            
            {/* Steps to Reproduce */}
            {testCase.stepsToReproduce && testCase.stepsToReproduce.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Steps to Reproduce</h4>
                <ol className="list-decimal list-inside space-y-1">
                  {testCase.stepsToReproduce.map((step, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            
            {testCase.errorMessage && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Error Message</h4>
                <pre className="text-xs bg-card p-3 rounded-md overflow-x-auto font-mono border">
                  {testCase.errorMessage}
                </pre>
              </div>
            )}
            
            {testCase.stackTrace && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Stack Trace</h4>
                <pre className="text-xs bg-card p-3 rounded-md overflow-x-auto font-mono border max-h-48 overflow-y-auto">
                  {testCase.stackTrace}
                </pre>
              </div>
            )}
            
            {/* Screenshots */}
            {testCase.screenshots && testCase.screenshots.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Screenshots ({testCase.screenshots.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {testCase.screenshots.map((screenshot, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={`data:${screenshot.mimeType};base64,${screenshot.base64Data}`}
                        alt={screenshot.name}
                        className="rounded-md border w-full h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          // Open in new tab
                          const win = window.open();
                          if (win) {
                            win.document.write(`<img src="data:${screenshot.mimeType};base64,${screenshot.base64Data}" />`);
                          }
                        }}
                      />
                      <span className="absolute bottom-1 left-1 text-xs bg-background/80 px-1 rounded">
                        {screenshot.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {failure.evidence.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Evidence</h4>
                <ul className="space-y-1">
                  {failure.evidence.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2 text-primary">Suggested Fix</h4>
              <p className="text-sm">{failure.suggestedFix}</p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
