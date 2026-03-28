import { test, expect } from '@playwright/test';

test.describe('API validation edge cases', () => {
  test('POST /api/timesheet/generate with whitespace-only employeeName returns 400', async ({
    request
  }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        year: 2026,
        month: 1,
        companyCode: '123456789',
        employeeName: '   ',
        employeeId: '12345678901',
        vacationDates: [],
        outputFormat: 'docx'
      }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('Employee name');
  });

  test('POST /api/timesheet/generate with invalid outputFormat returns 400', async ({
    request
  }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        year: 2026,
        month: 1,
        companyCode: '123456789',
        employeeName: 'Test User',
        employeeId: '12345678901',
        vacationDates: [],
        outputFormat: 'pdf'
      }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('Output format');
  });

  test('POST /api/timesheet/generate with out-of-range month returns 400', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        year: 2026,
        month: 13,
        companyCode: '123456789',
        employeeName: 'Test User',
        employeeId: '12345678901',
        vacationDates: [],
        outputFormat: 'docx'
      }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('Month');
  });

  test('POST /api/timesheet/generate with vacation dates returns DOCX', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        year: 2026,
        month: 3,
        companyCode: '123456789',
        employeeName: 'Test Vacation User',
        employeeId: '12345678901',
        vacationDates: ['2026-03-18', '2026-03-19', '2026-03-20'],
        outputFormat: 'docx'
      }
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('POST /api/timesheet/generate with non-array vacationDates returns 400', async ({
    request
  }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        year: 2026,
        month: 1,
        companyCode: '123456789',
        employeeName: 'Test User',
        employeeId: '12345678901',
        vacationDates: 'not-an-array',
        outputFormat: 'docx'
      }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('Vacation dates');
  });

  test('GET /api/holidays without year param uses current year', async ({ request }) => {
    const response = await request.get('/api/holidays');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.year).toBe(new Date().getFullYear());
    expect(Array.isArray(body.entries)).toBe(true);
  });

  test('GET /api/holidays?year=2101 returns 400 (above range)', async ({ request }) => {
    const response = await request.get('/api/holidays?year=2101');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('2000');
  });

  test('GET /api/holidays?year=2000 returns 200 (boundary)', async ({ request }) => {
    const response = await request.get('/api/holidays?year=2000');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.year).toBe(2000);
  });
});
