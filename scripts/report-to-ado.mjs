// Reads Playwright's JSON reporter output, matches each test's "TC-#####:" title
// prefix to an ADO test case, and reports pass/fail back via the ADO REST API
// directly (this runs headless in CI, so no MCP server is available here).
import { readFile } from 'node:fs/promises';

const {
  ADO_ORG = 'iLink-Digital',
  ADO_PROJECT = 'Benefit Plans',
  ADO_PAT,
  GITHUB_SERVER_URL,
  GITHUB_REPOSITORY,
  GITHUB_RUN_ID,
  RESULTS_JSON_PATH = 'test-results/results.json',
} = process.env;

if (!ADO_PAT) {
  throw new Error('ADO_PAT environment variable is required (a raw Azure DevOps PAT, not base64-encoded).');
}

const authHeader = `Basic ${Buffer.from(`:${ADO_PAT}`).toString('base64')}`;
const apiBase = `https://dev.azure.com/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ADO_PROJECT)}/_apis`;
const runUrl =
  GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : null;

function collectSpecs(suite, out = []) {
  for (const spec of suite.specs ?? []) out.push(spec);
  for (const child of suite.suites ?? []) collectSpecs(child, out);
  return out;
}

function extractTestCaseId(title) {
  const match = /TC-(\d+)/.exec(title);
  return match ? Number(match[1]) : null;
}

async function adoFetch(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ADO API ${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`);
  }
  return response.json();
}

async function getTags(workItemId) {
  const workItem = await adoFetch(`/wit/workitems/${workItemId}?fields=System.Tags&api-version=7.1`);
  return (workItem.fields['System.Tags'] ?? '')
    .split(';')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function setTags(workItemId, tags) {
  await adoFetch(`/wit/workitems/${workItemId}?api-version=7.1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify([{ op: 'add', path: '/fields/System.Tags', value: tags.join('; ') }]),
  });
}

async function addComment(workItemId, text) {
  await adoFetch(`/wit/workitems/${workItemId}/comments?api-version=7.1-preview.3`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

async function reportResult(testCaseId, passed, durationMs) {
  const tags = await getTags(testCaseId);
  const withoutOutcomeTags = tags.filter((t) => t !== 'Automation-Verified' && t !== 'Automation-Failed');
  const nextTags = [...withoutOutcomeTags, passed ? 'Automation-Verified' : 'Automation-Failed'];
  await setTags(testCaseId, nextTags);

  const seconds = (durationMs / 1000).toFixed(1);
  const runLink = runUrl ? `\n\nRun: ${runUrl}` : '';
  await addComment(
    testCaseId,
    `CI run ${passed ? '✅ passed' : '❌ failed'} (${seconds}s).${runLink}`
  );

  console.log(`TC-${testCaseId}: ${passed ? 'PASSED' : 'FAILED'} -> tagged & commented`);
}

async function main() {
  const raw = await readFile(RESULTS_JSON_PATH, 'utf-8');
  const report = JSON.parse(raw);
  const specs = report.suites?.flatMap((suite) => collectSpecs(suite)) ?? [];

  let reported = 0;
  for (const spec of specs) {
    const testCaseId = extractTestCaseId(spec.title);
    if (!testCaseId) continue;

    const test = spec.tests?.[0];
    const lastResult = test?.results?.[test.results.length - 1];
    if (!lastResult) continue;

    const passed = lastResult.status === 'passed';
    await reportResult(testCaseId, passed, lastResult.duration ?? 0);
    reported += 1;
  }

  console.log(`Reported ${reported} test case result(s) to ADO.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
