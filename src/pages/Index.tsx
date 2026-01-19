import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { AnalysisSummary } from '@/components/AnalysisSummary';
import { FailureCard } from '@/components/FailureCard';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { AnalysisLoader } from '@/components/AnalysisLoader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseSparkExtentReport, extractRawContent } from '@/lib/parseReport';
import { AnalysisResult } from '@/types/analysis';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, FileText, AlertTriangle, Lightbulb } from 'lucide-react';

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<'parsing' | 'analyzing' | 'generating'>('parsing');
  const [fileName, setFileName] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (content: string, name: string) => {
    setIsLoading(true);
    setResult(null);
    setFileName(name);
    
    try {
      // Stage 1: Parsing
      setStage('parsing');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const testCases = parseSparkExtentReport(content);
      const rawContent = extractRawContent(content);
      
      if (testCases.length === 0) {
        toast({
          title: "No test cases found",
          description: "The report structure wasn't recognized. Sending raw content for AI analysis.",
          variant: "default",
        });
      }
      
      // Stage 2: Analyzing with AI
      setStage('analyzing');
      
      const { data, error } = await supabase.functions.invoke('analyze-report', {
        body: { testCases, rawContent },
      });
      
      if (error) {
        throw new Error(error.message || 'Analysis failed');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Stage 3: Generating insights
      setStage('generating');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setResult(data);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${data.summary.failed} failures out of ${data.summary.total} tests.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleReset = useCallback(() => {
    setResult(null);
    setFileName(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {!result && !isLoading && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">Analyze Test Failures</h2>
              <p className="text-muted-foreground text-lg">
                Upload your Spark Extent Report and let AI identify root causes, 
                classify defects, and provide actionable recommendations.
              </p>
            </div>
            <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
          </div>
        )}
        
        {isLoading && (
          <div className="max-w-2xl mx-auto">
            <AnalysisLoader stage={stage} />
          </div>
        )}
        
        {result && !isLoading && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Analysis Results</h2>
                {fileName && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <FileText className="h-4 w-4" />
                    {fileName}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                New Analysis
              </Button>
            </div>
            
            <AnalysisSummary result={result} />
            
            <Tabs defaultValue="failures" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="failures" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Failures ({result.failures.length})
                </TabsTrigger>
                <TabsTrigger value="recommendations" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Insights
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="failures" className="space-y-4">
                {result.failures.length > 0 ? (
                  result.failures
                    .filter((failure) => failure && failure.testCase)
                    .map((failure, index) => (
                      <FailureCard key={failure.testCase?.id || `failure-${index}`} failure={failure} />
                    ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="rounded-full bg-green-100 dark:bg-green-900 p-4 w-fit mx-auto mb-4">
                      <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Failures Detected</h3>
                    <p>All tests passed successfully. Great job!</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="recommendations">
                <RecommendationsPanel 
                  recommendations={result.recommendations}
                  patterns={result.patterns}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
      
      <footer className="border-t mt-16 py-6 text-center text-sm text-muted-foreground">
        <p>Defect Analyzer Agent • AI-Powered Test Failure Analysis</p>
      </footer>
    </div>
  );
};

export default Index;
