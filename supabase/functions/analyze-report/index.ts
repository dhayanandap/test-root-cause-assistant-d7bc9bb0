import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestCase {
  id: string;
  name: string;
  className: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  logs?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testCases, rawContent } = await req.json();
    
    if (!testCases || !Array.isArray(testCases)) {
      return new Response(
        JSON.stringify({ error: 'Test cases array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const failedTests = testCases.filter((t: TestCase) => t.status === 'fail');
    const skippedTests = testCases.filter((t: TestCase) => t.status === 'skip');
    const passedTests = testCases.filter((t: TestCase) => t.status === 'pass');

    console.log(`Analyzing ${failedTests.length} failed tests out of ${testCases.length} total`);

    // Build analysis prompt
    const failureDetails = failedTests.map((t: TestCase) => `
Test: ${t.name}
Class: ${t.className}
Error: ${t.errorMessage || 'No error message'}
Stack Trace: ${t.stackTrace || 'No stack trace'}
Logs: ${t.logs?.join('\n') || 'No logs'}
`).join('\n---\n');

    const systemPrompt = `You are an expert test automation engineer and defect analyzer. Your task is to analyze test failures from Spark Extent Reports and identify root causes.

For each failure, you must:
1. Identify the most likely root cause
2. Classify the defect into one of these categories:
   - application_defect: Bug in the application under test
   - automation_script_defect: Issue with the test script itself
   - test_data_issue: Problem with test data or data dependencies
   - environment_issue: Environment instability, network issues, infrastructure problems
   - configuration_issue: Misconfiguration in test setup or environment
   - flaky_test: Intermittent failures due to timing, race conditions, etc.
3. Provide confidence level (high, medium, low)
4. List supporting evidence from the error messages and stack traces
5. Suggest a specific fix

You should also identify patterns across multiple failures and provide prioritized recommendations.

Respond ONLY with valid JSON matching this exact structure:
{
  "failures": [
    {
      "testId": "string",
      "rootCause": "string describing the root cause",
      "category": "one of the category values",
      "confidence": "high|medium|low",
      "evidence": ["array of evidence points"],
      "suggestedFix": "specific fix recommendation"
    }
  ],
  "patterns": [
    {
      "description": "pattern description",
      "occurrences": number,
      "affectedTests": ["test names"]
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "title": "short title",
      "description": "detailed description",
      "actionItems": ["specific action items"]
    }
  ]
}`;

    const userPrompt = failedTests.length > 0 
      ? `Analyze these ${failedTests.length} test failures:

${failureDetails}

${rawContent ? `Additional context from the report:\n${rawContent.substring(0, 5000)}` : ''}

Provide a comprehensive root cause analysis for each failure.`
      : `The test report shows ${passedTests.length} passed tests and ${skippedTests.length} skipped tests, with no failures. Provide recommendations for the skipped tests if any.

${rawContent ? `Context from the report:\n${rawContent.substring(0, 2000)}` : ''}`;

    console.log("Calling AI gateway for analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    console.log("AI response received, parsing...");

    let analysisResult;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      
      // Provide fallback analysis
      analysisResult = {
        failures: failedTests.map((t: TestCase) => ({
          testId: t.id,
          rootCause: t.errorMessage || "Unable to determine root cause automatically",
          category: "automation_script_defect",
          confidence: "low",
          evidence: [t.errorMessage || "No error message available"],
          suggestedFix: "Review the test implementation and logs manually"
        })),
        patterns: [],
        recommendations: [
          {
            priority: "high",
            title: "Manual Review Required",
            description: "AI analysis was unable to parse the failures completely. Manual review is recommended.",
            actionItems: ["Review each failure manually", "Check test logs for more context"]
          }
        ]
      };
    }

    // Calculate summary
    const totalDuration = testCases.reduce((sum: number, t: TestCase) => sum + (t.duration || 0), 0);
    const summary = {
      total: testCases.length,
      passed: passedTests.length,
      failed: failedTests.length,
      skipped: skippedTests.length,
      duration: totalDuration > 60 ? `${(totalDuration / 60).toFixed(1)}m` : `${totalDuration.toFixed(1)}s`,
      passRate: testCases.length > 0 ? (passedTests.length / testCases.length) * 100 : 0,
    };

    // Map failures back to test cases
    const mappedFailures = analysisResult.failures.map((f: any) => {
      const testCase = failedTests.find((t: TestCase) => t.id === f.testId) || failedTests[0];
      return {
        testCase,
        rootCause: f.rootCause,
        category: f.category,
        confidence: f.confidence,
        evidence: f.evidence || [],
        suggestedFix: f.suggestedFix,
      };
    });

    const result = {
      summary,
      failures: mappedFailures,
      patterns: analysisResult.patterns || [],
      recommendations: analysisResult.recommendations || [],
    };

    console.log("Analysis complete:", {
      failures: mappedFailures.length,
      patterns: result.patterns.length,
      recommendations: result.recommendations.length
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in analyze-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
