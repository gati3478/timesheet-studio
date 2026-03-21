import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

let hasLibreOffice = false;
try {
  execSync('soffice --version', { stdio: 'ignore' });
  hasLibreOffice = true;
} catch {
  // LibreOffice not available
}

const describeOrSkip = hasLibreOffice ? test.describe : test.describe.skip;

// LibreOffice uses a single-user profile lock — only run in one browser project
// to avoid concurrent soffice invocations causing lock contention failures.
test.skip(({ browserName }) => browserName !== 'chromium', 'DOC tests run in Chromium only');

const docPayload = {
  year: 2026,
  month: 3,
  companyCode: '405627530',
  employeeName: 'Test User',
  employeeId: '01005031116',
  vacationDates: [],
  outputFormat: 'doc'
};

describeOrSkip('DOC format output', () => {
  test('POST with outputFormat=doc returns correct MIME type', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', { data: docPayload });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/msword');
  });

  test('POST with outputFormat=doc returns .doc filename', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', { data: docPayload });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain('.doc');
  });

  test('POST with outputFormat=doc returns non-empty binary', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', { data: docPayload });
    expect(response.status()).toBe(200);
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('DOC file starts with valid MS compound document magic bytes', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', { data: docPayload });
    expect(response.status()).toBe(200);
    const body = await response.body();
    expect(body[0]).toBe(0xd0);
    expect(body[1]).toBe(0xcf);
    expect(body[2]).toBe(0x11);
    expect(body[3]).toBe(0xe0);
  });

  test('DOC filename for Georgian name uses RFC 5987 encoding', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...docPayload, employeeName: 'ტესტ მომხმარებელი' }
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain("filename*=UTF-8''");
  });
});
