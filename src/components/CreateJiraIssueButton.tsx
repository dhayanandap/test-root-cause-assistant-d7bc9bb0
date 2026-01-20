import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Loader2, Bug, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FailureAnalysis, JiraCredentials, CATEGORY_JIRA_PRIORITY } from '@/types/analysis';
import { getStoredJiraCredentials } from './JiraSettingsDialog';
import { supabase } from '@/integrations/supabase/client';

interface CreateJiraIssueButtonProps {
  failure: FailureAnalysis;
  onIssueCreated?: (issueKey: string) => void;
}

export function CreateJiraIssueButton({ failure, onIssueCreated }: CreateJiraIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdIssue, setCreatedIssue] = useState<{ key: string; url: string } | null>(null);
  const { toast } = useToast();

  const defaultPriority = CATEGORY_JIRA_PRIORITY[failure.category] || 'Medium';
  
  const [formData, setFormData] = useState({
    summary: `Test Failure: ${failure.testCase.name}`,
    priority: defaultPriority,
    description: generateDescription(failure),
  });

  const credentials = getStoredJiraCredentials();

  const handleOpen = () => {
    if (!credentials) {
      toast({
        title: "JIRA Not Configured",
        description: "Please configure JIRA credentials in settings first.",
        variant: "destructive",
      });
      return;
    }
    setOpen(true);
  };

  const handleCreate = async () => {
    if (!credentials) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-jira-issue', {
        body: {
          credentials,
          failure,
          summary: formData.summary,
          description: formData.description,
          priority: formData.priority,
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setCreatedIssue({
        key: data.issueKey,
        url: data.issueUrl,
      });

      onIssueCreated?.(data.issueKey);

      toast({
        title: "JIRA Issue Created",
        description: `Issue ${data.issueKey} has been created successfully.`,
      });
    } catch (error) {
      console.error('Failed to create JIRA issue:', error);
      toast({
        title: "Failed to Create Issue",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Only show for application defects
  if (failure.category !== 'application_defect') {
    return null;
  }

  // Show created issue link if already created
  if (failure.jiraIssueKey || createdIssue) {
    const issueKey = failure.jiraIssueKey || createdIssue?.key;
    const issueUrl = createdIssue?.url || `${credentials?.baseUrl}/browse/${issueKey}`;
    
    return (
      <a
        href={issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <CheckCircle className="h-4 w-4" />
        {issueKey}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleOpen}
        disabled={!credentials}
      >
        <Bug className="h-4 w-4" />
        Create JIRA Issue
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create JIRA Issue</DialogTitle>
            <DialogDescription>
              Create a bug issue in JIRA for this application defect.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Input
                id="summary"
                value={formData.summary}
                onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Highest">Highest</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Lowest">Lowest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            {failure.testCase.screenshots && failure.testCase.screenshots.length > 0 && (
              <div className="text-sm text-muted-foreground">
                📎 {failure.testCase.screenshots.length} screenshot(s) will be attached
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Issue'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function generateDescription(failure: FailureAnalysis): string {
  const { testCase, rootCause, evidence, suggestedFix } = failure;
  
  let description = `h2. Summary
${rootCause}

h2. Test Details
* *Test Name:* ${testCase.name}
* *Test Class:* ${testCase.className}
* *Status:* Failed

`;

  if (testCase.stepsToReproduce && testCase.stepsToReproduce.length > 0) {
    description += `h2. Steps to Reproduce
`;
    testCase.stepsToReproduce.forEach((step, index) => {
      description += `${index + 1}. ${step}\n`;
    });
    description += '\n';
  }

  if (testCase.errorMessage) {
    description += `h2. Error Message
{code}
${testCase.errorMessage}
{code}

`;
  }

  if (testCase.stackTrace) {
    description += `h2. Stack Trace
{code}
${testCase.stackTrace}
{code}

`;
  }

  if (evidence && evidence.length > 0) {
    description += `h2. Evidence
`;
    evidence.forEach(e => {
      description += `* ${e}\n`;
    });
    description += '\n';
  }

  description += `h2. Suggested Fix
${suggestedFix}

h2. Analysis Metadata
* *Category:* Application Defect
* *Confidence:* ${failure.confidence}
* *Generated by:* Defect Analyzer Agent
`;

  return description;
}
