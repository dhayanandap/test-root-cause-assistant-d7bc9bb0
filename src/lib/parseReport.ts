import { TestCase } from '@/types/analysis';

export function parseSparkExtentReport(htmlContent: string): TestCase[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const testCases: TestCase[] = [];
  
  // Parse test nodes from Spark Extent Report structure
  const testNodes = doc.querySelectorAll('.test-content, .test, [data-test]');
  
  testNodes.forEach((node, index) => {
    const nameEl = node.querySelector('.test-name, .name, h5, .card-title');
    const statusEl = node.querySelector('.status, .badge, [class*="status"]');
    const logNodes = node.querySelectorAll('.log, .step, pre, code');
    
    let status: 'pass' | 'fail' | 'skip' = 'pass';
    const statusText = statusEl?.textContent?.toLowerCase() || '';
    const nodeClasses = node.className.toLowerCase();
    
    if (statusText.includes('fail') || statusText.includes('error') || 
        nodeClasses.includes('fail') || nodeClasses.includes('error')) {
      status = 'fail';
    } else if (statusText.includes('skip') || nodeClasses.includes('skip')) {
      status = 'skip';
    }
    
    const logs: string[] = [];
    let errorMessage = '';
    let stackTrace = '';
    
    logNodes.forEach((log) => {
      const text = log.textContent?.trim() || '';
      if (text) {
        logs.push(text);
        if (status === 'fail') {
          if (text.includes('Exception') || text.includes('Error') || text.includes('at ')) {
            if (!stackTrace) {
              stackTrace = text;
            } else {
              stackTrace += '\n' + text;
            }
          }
          if (!errorMessage && (text.includes('AssertionError') || text.includes('expected') || text.includes('Error:'))) {
            errorMessage = text.split('\n')[0];
          }
        }
      }
    });
    
    // Extract duration
    const durationEl = node.querySelector('.duration, .time, [class*="time"]');
    const durationText = durationEl?.textContent || '0';
    const duration = parseFloat(durationText.replace(/[^0-9.]/g, '')) || 0;
    
    // Extract class name
    const classNameEl = node.querySelector('.class-name, .category, .test-class');
    const className = classNameEl?.textContent?.trim() || 'Unknown Class';
    
    testCases.push({
      id: `test-${index + 1}`,
      name: nameEl?.textContent?.trim() || `Test Case ${index + 1}`,
      className,
      status,
      duration,
      errorMessage: errorMessage || undefined,
      stackTrace: stackTrace || undefined,
      logs: logs.length > 0 ? logs : undefined,
      timestamp: new Date().toISOString(),
    });
  });
  
  // If no tests found with selectors, try to extract from raw content
  if (testCases.length === 0) {
    // Fallback: look for common patterns in the HTML
    const bodyText = doc.body?.textContent || '';
    const passMatch = bodyText.match(/pass[ed]*\s*[:\s]*(\d+)/i);
    const failMatch = bodyText.match(/fail[ed]*\s*[:\s]*(\d+)/i);
    const skipMatch = bodyText.match(/skip[ped]*\s*[:\s]*(\d+)/i);
    
    // Create summary test cases based on counts
    const passCount = passMatch ? parseInt(passMatch[1]) : 0;
    const failCount = failMatch ? parseInt(failMatch[1]) : 0;
    const skipCount = skipMatch ? parseInt(skipMatch[1]) : 0;
    
    for (let i = 0; i < passCount; i++) {
      testCases.push({
        id: `pass-${i + 1}`,
        name: `Passed Test ${i + 1}`,
        className: 'Parsed from summary',
        status: 'pass',
        duration: 0,
      });
    }
    
    for (let i = 0; i < failCount; i++) {
      testCases.push({
        id: `fail-${i + 1}`,
        name: `Failed Test ${i + 1}`,
        className: 'Parsed from summary',
        status: 'fail',
        duration: 0,
        errorMessage: 'Error details not available from summary',
      });
    }
    
    for (let i = 0; i < skipCount; i++) {
      testCases.push({
        id: `skip-${i + 1}`,
        name: `Skipped Test ${i + 1}`,
        className: 'Parsed from summary',
        status: 'skip',
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
  doc.querySelectorAll('script, style').forEach(el => el.remove());
  
  // Get text content with some structure preserved
  const body = doc.body;
  if (!body) return htmlContent;
  
  // Extract meaningful sections
  const sections: string[] = [];
  
  // Look for test-related sections
  const testContainers = body.querySelectorAll('.test, .test-content, .card, [class*="test"], table tbody tr');
  testContainers.forEach(container => {
    const text = container.textContent?.trim();
    if (text && text.length > 10) {
      sections.push(text);
    }
  });
  
  if (sections.length > 0) {
    return sections.join('\n\n---\n\n');
  }
  
  return body.textContent || htmlContent;
}
