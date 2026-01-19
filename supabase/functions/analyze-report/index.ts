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
    
    if (!rawContent && (!testCases || !Array.isArray(testCases))) {
      return new Response(
        JSON.stringify({ error: 'Report content is required' }),
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

    const parsedTests = testCases || [];
    const failedFromParsing = parsedTests.filter((t: TestCase) => t.status === 'fail');
    const skippedFromParsing = parsedTests.filter((t: TestCase) => t.status === 'skip');
    const passedFromParsing = parsedTests.filter((t: TestCase) => t.status === 'pass');

    console.log(`Parsed: ${parsedTests.length} tests (${failedFromParsing.length} failed, ${passedFromParsing.length} passed, ${skippedFromParsing.length} skipped)`);

    // Build comprehensive analysis prompt
    const systemPrompt = `You are an expert test automation engineer specializing in analyzing Spark Extent Reports and test execution results. Your task is to ACCURATELY extract and analyze test results from the provided report content.

CRITICAL INSTRUCTIONS:
1. FIRST, carefully extract ALL test cases from the raw content. Look for:
   - Test names, method names, or scenario names
   - Status indicators (pass/fail/skip/error)
   - Error messages, exceptions, and stack traces
   - Execution times and timestamps

2. For each FAILED test, determine:
   - Root cause category (MUST be one of: application_defect, automation_script_defect, test_data_issue, environment_issue, configuration_issue, flaky_test)
   - Confidence level (high/medium/low)
   - Specific evidence from the report
   - Actionable fix recommendation

3. Identify patterns across failures

4. Provide prioritized recommendations

ACCURACY IS CRITICAL. Extract the EXACT test names and error messages from the report. Do not make up test names or errors.

Respond with ONLY valid JSON in this exact structure:
{
  "extractedTests": [
    {
      "id": "unique-id",
      "name": "exact test name from report",
      "className": "test class or suite name",
      "status": "pass|fail|skip",
      "errorMessage": "exact error message if failed",
      "stackTrace": "stack trace if available"
    }
  ],
  "failures": [
    {
      "testId": "matching id from extractedTests",
      "testName": "exact test name",
      "rootCause": "detailed analysis of why this test failed",
      "category": "one of the valid categories",
      "confidence": "high|medium|low",
      "evidence": ["specific evidence from the report"],
      "suggestedFix": "specific actionable fix"
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
      "actionItems": ["specific actions"]
    }
  ],
  "summary": {
    "total": number,
    "passed": number,
    "failed": number,
    "skipped": number
  }
}`;

    let userPrompt = `Analyze this Spark Extent Report and provide 100% accurate results:

`;

    // Include parsed test data if available
    if (parsedTests.length > 0) {
      userPrompt += `=== PRE-PARSED TEST DATA ===
${JSON.stringify(parsedTests, null, 2)}

`;
    }

    // Include raw content for AI to extract additional info
    if (rawContent) {
      // Limit content size but keep as much as possible
      const contentLimit = 25000;
      const trimmedContent = rawContent.length > contentLimit 
        ? rawContent.substring(0, contentLimit) + '\n...[content truncated]...'
        : rawContent;
      
      userPrompt += `=== RAW REPORT CONTENT ===
${trimmedContent}

`;
    }

    userPrompt += `
IMPORTANT: 
- Extract ALL test cases with their EXACT names and statuses
- For failed tests, analyze the root cause based on error messages and stack traces
- Be precise and accurate - do not invent or assume information not in the report
- If the report shows all tests passed, report that accurately`;

    console.log("Calling AI gateway for comprehensive analysis...");

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
        temperature: 0.1, // Lower temperature for more accurate/deterministic output
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
      // Also try to find JSON object directly
      const directJsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (directJsonMatch) {
        jsonStr = directJsonMatch[0];
      }
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content?.substring(0, 500));
      
      // Use parsed data as fallback
      analysisResult = {
        extractedTests: parsedTests,
        failures: failedFromParsing.map((t: TestCase) => ({
          testId: t.id,
          testName: t.name,
          rootCause: t.errorMessage || "Unable to determine root cause - manual review required",
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
            description: "AI analysis encountered parsing issues. Please review the report manually for complete accuracy.",
            actionItems: ["Review each failure manually", "Check test logs for more context"]
          }
        ],
        summary: {
          total: parsedTests.length,
          passed: passedFromParsing.length,
          failed: failedFromParsing.length,
          skipped: skippedFromParsing.length
        }
      };
    }

    // Use AI-extracted tests if available, otherwise use parsed tests
    const finalTests = analysisResult.extractedTests?.length > 0 
      ? analysisResult.extractedTests 
      : parsedTests;
    
    const finalPassed = finalTests.filter((t: any) => t.status === 'pass');
    const finalFailed = finalTests.filter((t: any) => t.status === 'fail');
    const finalSkipped = finalTests.filter((t: any) => t.status === 'skip');

    // Use AI summary if provided, otherwise calculate
    const summaryData = analysisResult.summary || {
      total: finalTests.length,
      passed: finalPassed.length,
      failed: finalFailed.length,
      skipped: finalSkipped.length
    };

    const totalDuration = finalTests.reduce((sum: number, t: any) => sum + (t.duration || 0), 0);
    
    const summary = {
      total: summaryData.total || finalTests.length,
      passed: summaryData.passed || finalPassed.length,
      failed: summaryData.failed || finalFailed.length,
      skipped: summaryData.skipped || finalSkipped.length,
      duration: totalDuration > 60 ? `${(totalDuration / 60).toFixed(1)}m` : `${totalDuration.toFixed(1)}s`,
      passRate: summaryData.total > 0 
        ? ((summaryData.passed || finalPassed.length) / summaryData.total) * 100 
        : 0,
    };

    // Map failures to include testCase objects
    const mappedFailures = (analysisResult.failures || []).map((f: any, idx: number) => {
      // Find matching test case
      const matchingTest = finalTests.find((t: any) => 
        t.id === f.testId || 
        t.name === f.testName ||
        t.name?.toLowerCase() === f.testName?.toLowerCase()
      );
      
      const testCase: TestCase = matchingTest || {
        id: f.testId || `failure-${idx}`,
        name: f.testName || 'Unknown Test',
        className: 'Unknown Class',
        status: 'fail' as const,
        duration: 0,
        errorMessage: f.evidence?.[0],
        stackTrace: f.evidence?.slice(1)?.join('\n')
      };
      
      return {
        testCase,
        rootCause: f.rootCause || 'Analysis pending',
        category: f.category || 'automation_script_defect',
        confidence: f.confidence || 'medium',
        evidence: f.evidence || [],
        suggestedFix: f.suggestedFix || 'Review test implementation',
      };
    });

    const result = {
      summary,
      failures: mappedFailures,
      patterns: analysisResult.patterns || [],
      recommendations: analysisResult.recommendations || [],
    };

    console.log("Analysis complete:", {
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      failuresAnalyzed: mappedFailures.length,
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
