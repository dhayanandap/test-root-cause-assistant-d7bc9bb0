import { CheckCircle, XCircle, SkipForward, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AnalysisResult } from '@/types/analysis';

interface AnalysisSummaryProps {
  result: AnalysisResult;
}

export function AnalysisSummary({ result }: AnalysisSummaryProps) {
  const { summary } = result;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{summary.total}</div>
          <p className="text-xs text-muted-foreground mt-1">Test cases analyzed</p>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Passed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">{summary.passed}</div>
          <Progress value={(summary.passed / summary.total) * 100} className="mt-2 h-1" />
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-destructive">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-destructive">{summary.failed}</div>
          <Progress value={(summary.failed / summary.total) * 100} className="mt-2 h-1 [&>div]:bg-destructive" />
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-yellow-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <SkipForward className="h-4 w-4 text-yellow-500" />
            Skipped
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-yellow-600">{summary.skipped}</div>
          <Progress value={(summary.skipped / summary.total) * 100} className="mt-2 h-1 [&>div]:bg-yellow-500" />
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Pass Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{summary.passRate.toFixed(1)}%</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {summary.duration}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
