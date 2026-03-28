import { test, expect } from '@playwright/test';

const basePayload = {
  year: 2026,
  month: 3,
  companyCode: '123456789',
  employeeName: 'Test User',
  employeeId: '12345678901',
  vacationDates: [],
  outputFormat: 'docx'
};

test.describe('Vacation date validation', () => {
  test('vacation on a weekend date returns 400 with details', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, vacationDates: ['2026-03-07'] }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details.some((d: string) => /weekend/i.test(d))).toBe(true);
  });

  test('vacation on a known holiday returns 400 with details', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, year: 2026, month: 1, vacationDates: ['2026-01-01'] }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details.some((d: string) => /holiday/i.test(d))).toBe(true);
  });

  test('vacation outside selected month returns 400 with details', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, vacationDates: ['2026-04-01'] }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details.some((d: string) => /not in selected month/i.test(d))).toBe(true);
  });

  test('invalid date format returns 400 with details', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, vacationDates: ['not-a-date'] }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('message');
  });

  test('multiple invalid vacations lists all errors in details', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, vacationDates: ['2026-03-07', '2026-03-08', '2026-04-01'] }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThanOrEqual(3);
  });

  test('vacation on Feb 29 in non-leap year returns 400', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, year: 2026, month: 2, vacationDates: ['2026-02-29'] }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('message');
  });
});
