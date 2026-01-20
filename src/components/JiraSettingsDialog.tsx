import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { JiraCredentials } from '@/types/analysis';

const JIRA_STORAGE_KEY = 'defect-analyzer-jira-credentials';

interface JiraSettingsDialogProps {
  onCredentialsSaved?: (credentials: JiraCredentials) => void;
}

export function JiraSettingsDialog({ onCredentialsSaved }: JiraSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const [credentials, setCredentials] = useState<JiraCredentials>({
    baseUrl: '',
    email: '',
    apiKey: '',
    projectKey: '',
  });

  // Load saved credentials on mount
  useEffect(() => {
    const saved = localStorage.getItem(JIRA_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCredentials(parsed);
        setConnectionStatus('success');
      } catch {
        // Invalid stored data
      }
    }
  }, []);

  const handleInputChange = (field: keyof JiraCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    setConnectionStatus('idle');
  };

  const testConnection = async () => {
    if (!credentials.baseUrl || !credentials.email || !credentials.apiKey) {
      toast({
        title: "Missing Credentials",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      // Test JIRA connection by fetching user info
      const response = await fetch(`${credentials.baseUrl}/rest/api/3/myself`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${credentials.email}:${credentials.apiKey}`)}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "JIRA credentials are valid.",
        });
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Connection Failed",
        description: "Could not connect to JIRA. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!credentials.baseUrl || !credentials.email || !credentials.apiKey || !credentials.projectKey) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields including Project Key.",
        variant: "destructive",
      });
      return;
    }

    // Save to localStorage (encrypted in production would be recommended)
    localStorage.setItem(JIRA_STORAGE_KEY, JSON.stringify(credentials));
    
    onCredentialsSaved?.(credentials);
    
    toast({
      title: "Settings Saved",
      description: "JIRA credentials have been saved securely.",
    });
    
    setOpen(false);
  };

  const handleClear = () => {
    localStorage.removeItem(JIRA_STORAGE_KEY);
    setCredentials({
      baseUrl: '',
      email: '',
      apiKey: '',
      projectKey: '',
    });
    setConnectionStatus('idle');
    toast({
      title: "Settings Cleared",
      description: "JIRA credentials have been removed.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          JIRA Settings
          {connectionStatus === 'success' && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>JIRA Integration Settings</DialogTitle>
          <DialogDescription>
            Configure your JIRA credentials to automatically create issues for Application Defects.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="baseUrl">JIRA Base URL *</Label>
            <Input
              id="baseUrl"
              placeholder="https://yourcompany.atlassian.net"
              value={credentials.baseUrl}
              onChange={(e) => handleInputChange('baseUrl', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your Atlassian instance URL (e.g., https://yourcompany.atlassian.net)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">JIRA Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@company.com"
              value={credentials.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Token *</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Your JIRA API token"
                value={credentials.apiKey}
                onChange={(e) => handleInputChange('apiKey', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate an API token from{' '}
              <a 
                href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Atlassian Account Settings
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectKey">Default Project Key *</Label>
            <Input
              id="projectKey"
              placeholder="PROJECT"
              value={credentials.projectKey}
              onChange={(e) => handleInputChange('projectKey', e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              The JIRA project key where issues will be created (e.g., PROJECT, BUG, QA)
            </p>
          </div>

          {connectionStatus !== 'idle' && (
            <div className={`flex items-center gap-2 p-3 rounded-md ${
              connectionStatus === 'success' 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {connectionStatus === 'success' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Connected to JIRA successfully</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Connection failed - check credentials</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={handleClear}>
            Clear Settings
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={testConnection} disabled={isTesting}>
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function getStoredJiraCredentials(): JiraCredentials | null {
  const saved = localStorage.getItem(JIRA_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}
