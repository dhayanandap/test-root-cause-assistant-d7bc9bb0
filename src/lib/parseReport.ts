import { TestCase, Screenshot } from '@/types/analysis';

export function parseSparkExtentReport(htmlContent: string): TestCase[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const testCases: TestCase[] = [];
  
  // Spark Extent Report specific selectors
  const selectors = [
    // Standard Extent Report selectors
    '.test',
    '.test-content',
    '.card.test-card',
    'li.test',
    'div[class*="test"]',
    // Table-based reports
    'table tbody tr',
    '.table-responsive tbody tr',
    // Node/category based
    '.node',
    '.category-content .test-detail',
    // Test items
    '.test-item',
    '.test-row',
  ];
  
  let testNodes: NodeListOf<Element> | Element[] = [];
  
  for (const selector of selectors) {
    const nodes = doc.querySelectorAll(selector);
    if (nodes.length > 0) {
      testNodes = nodes;
      break;
    }
  }
  
  // If still empty, try to find any element with status indicators
  if (testNodes.length === 0) {
    const allElements = doc.querySelectorAll('[class*="pass"], [class*="fail"], [class*="skip"], [class*="error"]');
    testNodes = Array.from(allElements);
  }
  
  testNodes.forEach((node, index) => {
    // Extract test name
    const nameSelectors = ['.test-name', '.name', 'td:first-child', 'h5', '.card-title', '.test-title', 'a'];
    let name = '';
    for (const sel of nameSelectors) {
      const el = node.querySelector(sel);
      if (el?.textContent?.trim()) {
        name = el.textContent.trim();
        break;
      }
    }
    if (!name) {
      name = node.textContent?.trim().split('\n')[0]?.substring(0, 100) || `Test ${index + 1}`;
    }
    
    // Extract status
    let status: 'pass' | 'fail' | 'skip' = 'pass';
    const nodeText = node.textContent?.toLowerCase() || '';
    const nodeClass = node.className?.toLowerCase() || '';
    const nodeHtml = node.innerHTML?.toLowerCase() || '';
    
    // Check for status indicators
    if (nodeClass.includes('fail') || nodeClass.includes('error') || 
        nodeHtml.includes('fail') || nodeHtml.includes('error') ||
        nodeText.includes('failed') || nodeText.includes('exception')) {
      status = 'fail';
    } else if (nodeClass.includes('skip') || nodeHtml.includes('skip') || nodeText.includes('skipped')) {
      status = 'skip';
    } else if (nodeClass.includes('pass') || nodeHtml.includes('pass') || 
               nodeHtml.includes('✓') || nodeHtml.includes('success')) {
      status = 'pass';
    }
    
    // Also check for status badge/icon elements
    const statusEl = node.querySelector('.status, .badge, [class*="status"], .test-status');
    if (statusEl) {
      const statusText = statusEl.textContent?.toLowerCase() || '';
      const statusClass = statusEl.className?.toLowerCase() || '';
      if (statusText.includes('fail') || statusClass.includes('fail') || statusClass.includes('danger')) {
        status = 'fail';
      } else if (statusText.includes('skip') || statusClass.includes('skip') || statusClass.includes('warning')) {
        status = 'skip';
      }
    }
    
    // Extract error message and stack trace
    let errorMessage = '';
    let stackTrace = '';
    const logs: string[] = [];
    
    const errorSelectors = ['.exception', '.error', '.stacktrace', '.stack-trace', 'pre', 'code', '.log', '.step-details'];
    errorSelectors.forEach(sel => {
      const els = node.querySelectorAll(sel);
      els.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text) {
          logs.push(text);
          if (text.includes('Exception') || text.includes('Error') || text.includes('at ')) {
            if (!stackTrace) {
              stackTrace = text;
            }
          }
          if (!errorMessage && (text.includes('Assert') || text.includes('Expected') || text.includes('Error:'))) {
            errorMessage = text.split('\n')[0];
          }
        }
      });
    });
    
    // Extract steps to reproduce from test steps/logs
    const stepsToReproduce: string[] = [];
    const stepSelectors = ['.step', '.test-step', '.log-step', '.step-name', '.step-details', '.node-step', 'li.step'];
    stepSelectors.forEach(sel => {
      const stepEls = node.querySelectorAll(sel);
      stepEls.forEach(el => {
        const stepText = el.textContent?.trim();
        if (stepText && stepText.length > 5 && stepText.length < 500) {
          stepsToReproduce.push(stepText);
        }
      });
    });
    
    // Also try to extract steps from structured logs
    if (stepsToReproduce.length === 0) {
      const logEls = node.querySelectorAll('.log, .test-log, [class*="step"]');
      logEls.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 5 && text.length < 300 && !text.includes('Exception')) {
          stepsToReproduce.push(text);
        }
      });
    }
    
    // Extract screenshots (base64 encoded images)
    const screenshots: Screenshot[] = [];
    const imgSelectors = ['img[src^="data:image"]', 'img.screenshot', '.screenshot img', '.test-img img', '.media img'];
    imgSelectors.forEach(sel => {
      const imgEls = node.querySelectorAll(sel);
      imgEls.forEach((img, imgIdx) => {
        const src = (img as HTMLImageElement).src;
        if (src?.startsWith('data:image')) {
          const match = src.match(/data:([^;]+);base64,(.+)/);
          if (match) {
            screenshots.push({
              name: `screenshot-${testCases.length + 1}-${imgIdx + 1}.png`,
              mimeType: match[1],
              base64Data: match[2],
            });
          }
        }
      });
    });
    
    // Also look for screenshot links/attachments
    const screenshotLinks = node.querySelectorAll('a[href*="screenshot"], a[href*="image"], .screenshot-link');
    screenshotLinks.forEach((link, linkIdx) => {
      const href = (link as HTMLAnchorElement).href;
      if (href && (href.includes('.png') || href.includes('.jpg') || href.includes('.jpeg'))) {
        // Note: We can't fetch external URLs here, but we note them
        logs.push(`Screenshot available: ${href}`);
      }
    });
    
    // Extract class name
    const classSelectors = ['.class-name', '.category', '.test-class', '.package'];
    let className = '';
    for (const sel of classSelectors) {
      const el = node.querySelector(sel);
      if (el?.textContent?.trim()) {
        className = el.textContent.trim();
        break;
      }
    }
    if (!className) {
      className = 'Test Suite';
    }
    
    // Extract duration
    const durationEl = node.querySelector('.duration, .time, [class*="time"], .test-time');
    const durationText = durationEl?.textContent || '0';
    const duration = parseFloat(durationText.replace(/[^0-9.]/g, '')) || 0;
    
    // Only add if we have a meaningful name (not just whitespace)
    if (name && name.length > 2) {
      testCases.push({
        id: `test-${index + 1}`,
        name,
        className,
        status,
        duration,
        errorMessage: errorMessage || undefined,
        stackTrace: stackTrace || undefined,
        logs: logs.length > 0 ? logs : undefined,
        stepsToReproduce: stepsToReproduce.length > 0 ? stepsToReproduce : undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // If no tests found with DOM parsing, try regex extraction
  if (testCases.length === 0) {
    const bodyText = doc.body?.textContent || htmlContent;
    
    // Look for pass/fail counts
    const passMatch = bodyText.match(/pass(?:ed)?\s*[:\s]*(\d+)/i);
    const failMatch = bodyText.match(/fail(?:ed|ure)?\s*[:\s]*(\d+)/i);
    const skipMatch = bodyText.match(/skip(?:ped)?\s*[:\s]*(\d+)/i);
    
    const passCount = passMatch ? parseInt(passMatch[1]) : 0;
    const failCount = failMatch ? parseInt(failMatch[1]) : 0;
    const skipCount = skipMatch ? parseInt(skipMatch[1]) : 0;
    
    // Extract individual test names if possible
    const testNameMatches = htmlContent.match(/test[_\s-]?name["']?\s*[>:]\s*([^<\n]+)/gi) || [];
    
    for (let i = 0; i < Math.max(passCount + failCount + skipCount, testNameMatches.length, 1); i++) {
      let status: 'pass' | 'fail' | 'skip' = 'pass';
      if (i < failCount) status = 'fail';
      else if (i < failCount + skipCount) status = 'skip';
      
      testCases.push({
        id: `extracted-${i + 1}`,
        name: testNameMatches[i]?.replace(/test[_\s-]?name["']?\s*[>:]\s*/i, '').trim() || `Test Case ${i + 1}`,
        className: 'Extracted from report',
        status,
        duration: 0,
      });
    }
  }
  
  return testCases;
}

export function extractRawContent(htmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Remove script and style elements
  doc.querySelectorAll('script, style, link').forEach(el => el.remove());
  
  // Get the main content areas
  const contentAreas: string[] = [];
  
  // Try to get structured content first
  const mainSelectors = [
    '.test-content',
    '.report-content', 
    '.container',
    '.card',
    'table',
    'main',
    'body'
  ];
  
  for (const selector of mainSelectors) {
    const elements = doc.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 50) {
          contentAreas.push(text);
        }
      });
      if (contentAreas.length > 0) break;
    }
  }
  
  // Also preserve the HTML structure for AI analysis (limited)
  const htmlSnippet = doc.body?.innerHTML?.substring(0, 15000) || '';
  
  return `
=== EXTRACTED TEXT CONTENT ===
${contentAreas.slice(0, 10).join('\n\n---\n\n')}

=== HTML STRUCTURE (for reference) ===
${htmlSnippet}
`;
}
