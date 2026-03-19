import { test, expect } from '@playwright/test';

test.describe('API endpoints', () => {
  test('GET /api/holidays?year=2026 returns 200 with entries', async ({ request }) => {
    const response = await request.get('/api/holidays?year=2026');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('year', 2026);
    expect(body).toHaveProperty('entries');
    expect(Array.isArray(body.entries)).toBe(true);
  });

  test('GET /api/holidays?year=abc returns 400', async ({ request }) => {
    const response = await request.get('/api/holidays?year=abc');
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');
  });

  test('GET /api/holidays?year=1999 returns 400 (out of range)', async ({ request }) => {
    const response = await request.get('/api/holidays?year=1999');
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');
  });

  test('POST /api/timesheet/generate with valid body returns DOCX', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        year: 2026,
        month: 1,
        companyCode: '405627530',
        employeeName: 'Test User',
        employeeId: '01005031116',
        vacationDates: [],
        outputFormat: 'docx'
      }
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(response.headers()['content-disposition']).toContain('filename=');

    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('POST /api/timesheet/generate with missing fields returns 400', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        year: 2026,
        month: 1
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('message');
  });
});
