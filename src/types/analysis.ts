export interface TestCase {
  id: string;
  name: string;
  className: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  logs?: string[];
  timestamp?: string;
}

export interface AnalysisResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: string;
    passRate: number;
  };
  failures: FailureAnalysis[];
  patterns: Pattern[];
  recommendations: Recommendation[];
}

export interface FailureAnalysis {
  testCase: TestCase;
  rootCause: string;
  category: DefectCategory;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  suggestedFix: string;
}

export type DefectCategory = 
  | 'application_defect'
  | 'automation_script_defect'
  | 'test_data_issue'
  | 'environment_issue'
  | 'configuration_issue'
  | 'flaky_test';

export interface Pattern {
  description: string;
  occurrences: number;
  affectedTests: string[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
}

export const CATEGORY_LABELS: Record<DefectCategory, string> = {
  application_defect: 'Application Defect',
  automation_script_defect: 'Automation Script Defect',
  test_data_issue: 'Test Data Issue',
  environment_issue: 'Environment Issue',
  configuration_issue: 'Configuration Issue',
  flaky_test: 'Flaky Test',
};

export const CATEGORY_COLORS: Record<DefectCategory, string> = {
  application_defect: 'destructive',
  automation_script_defect: 'secondary',
  test_data_issue: 'default',
  environment_issue: 'outline',
  configuration_issue: 'default',
  flaky_test: 'secondary',
};
