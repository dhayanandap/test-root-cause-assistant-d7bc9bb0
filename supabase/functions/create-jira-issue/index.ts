import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Screenshot {
  name: string;
  base64Data: string;
  mimeType: string;
}

interface TestCase {
  id: string;
  name: string;
  className: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  stepsToReproduce?: string[];
  screenshots?: Screenshot[];
}

interface FailureAnalysis {
  testCase: TestCase;
  rootCause: string;
  category: string;
  confidence: string;
  evidence: string[];
  suggestedFix: string;
}

interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiKey: string;
  projectKey: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { credentials, failure, summary, description, priority } = await req.json();

    // Validate required fields
    if (!credentials || !credentials.baseUrl || !credentials.email || !credentials.apiKey || !credentials.projectKey) {
      return new Response(
        JSON.stringify({ error: 'JIRA credentials are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!failure || !summary) {
      return new Response(
        JSON.stringify({ error: 'Failure details and summary are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { baseUrl, email, apiKey, projectKey } = credentials as JiraCredentials;
    const authHeader = `Basic ${btoa(`${email}:${apiKey}`)}`;

    // Clean base URL (remove trailing slash)
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    console.log(`Creating JIRA issue in project ${projectKey}...`);

    // Map priority string to JIRA priority
    const priorityMapping: Record<string, string> = {
      'Highest': '1',
      'High': '2',
      'Medium': '3',
      'Low': '4',
      'Lowest': '5',
    };

    // Create the issue
    const issuePayload = {
      fields: {
        project: {
          key: projectKey,
        },
        summary: summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: description || 'No description provided',
                },
              ],
            },
          ],
        },
        issuetype: {
          name: 'Bug',
        },
        priority: {
          name: priority || 'Medium',
        },
        labels: ['automated-test-failure', 'defect-analyzer'],
      },
    };

    const createResponse = await fetch(`${cleanBaseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issuePayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('JIRA issue creation failed:', createResponse.status, errorText);
      
      let errorMessage = 'Failed to create JIRA issue';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors) {
          errorMessage = Object.values(errorJson.errors).join(', ');
        } else if (errorJson.errorMessages) {
          errorMessage = errorJson.errorMessages.join(', ');
        }
      } catch {
        errorMessage = errorText || 'Unknown error';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: createResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const issueData = await createResponse.json();
    const issueKey = issueData.key;
    const issueId = issueData.id;

    console.log(`JIRA issue created: ${issueKey}`);

    // Attach screenshots if available
    const screenshots = (failure as FailureAnalysis).testCase?.screenshots || [];
    const attachmentResults: string[] = [];

    for (const screenshot of screenshots) {
      try {
        // Decode base64 to binary
        const binaryData = Uint8Array.from(atob(screenshot.base64Data), c => c.charCodeAt(0));
        
        // Create form data for attachment
        const formData = new FormData();
        const blob = new Blob([binaryData], { type: screenshot.mimeType || 'image/png' });
        formData.append('file', blob, screenshot.name || 'screenshot.png');

        const attachResponse = await fetch(`${cleanBaseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'X-Atlassian-Token': 'no-check',
          },
          body: formData,
        });

        if (attachResponse.ok) {
          console.log(`Attached screenshot: ${screenshot.name}`);
          attachmentResults.push(screenshot.name);
        } else {
          console.error(`Failed to attach screenshot: ${screenshot.name}`, await attachResponse.text());
        }
      } catch (attachError) {
        console.error(`Error attaching screenshot:`, attachError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        issueKey: issueKey,
        issueId: issueId,
        issueUrl: `${cleanBaseUrl}/browse/${issueKey}`,
        attachments: attachmentResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-jira-issue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create JIRA issue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
