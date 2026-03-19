import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/holidays', () => ({
  getHolidaysForYear: vi.fn().mockResolvedValue([])
}));

vi.mock('$lib/server/timesheet', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/server/timesheet')>(
    '../../src/lib/server/timesheet'
  );
  return {
    ...actual,
    computeTimesheet: vi.fn().mockReturnValue({
      dayCodes: [],
      workedDayCount: 0,
      vacationDayCount: 0,
      blockedDayCount: 0,
      weekdayHolidayCount: 0,
      firstHalfHours: 0,
      secondHalfHours: 0,
      totalHours: 0,
      vacationHours: 0
    })
  };
});

vi.mock('$lib/server/docx', () => ({
  fillTimesheetTemplate: vi.fn().mockResolvedValue(Buffer.from('fake-docx'))
}));

vi.mock('$lib/server/filename', () => ({
  buildOutputFilename: vi.fn().mockReturnValue('test-timesheet.docx')
}));

vi.mock('$lib/server/doc-conversion', () => ({
  DocConversionError: class DocConversionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DocConversionError';
    }
  },
  convertDocxBufferToDoc: vi.fn().mockResolvedValue(Buffer.from('fake-doc'))
}));

vi.mock('$lib/server/template', () => ({
  loadTemplateBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-template'))
}));

vi.mock('$lib/server/parse-payload', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/server/parse-payload')>(
    '../../src/lib/server/parse-payload'
  );
  return actual;
});

vi.mock('@sveltejs/kit', () => ({
  json: (data: unknown, init?: ResponseInit) => {
    return new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}));

describe('POST /api/timesheet/generate', () => {
  let POST: (args: { request: Request }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/routes/api/timesheet/generate/+server');
    POST = mod.POST as unknown as typeof POST;
  });

  it('returns 413 when Content-Length exceeds 1MB', async () => {
    const request = new Request('http://localhost/api/timesheet/generate', {
      method: 'POST',
      headers: { 'Content-Length': String(2 * 1024 * 1024) },
      body: '{}'
    });

    const response = await POST({ request });
    expect(response.status).toBe(413);

    const data = await response.json();
    expect(data.message).toBe('Request body too large.');
  });

  it('returns 500 for malformed JSON body', async () => {
    const request = new Request('http://localhost/api/timesheet/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json }'
    });

    const response = await POST({ request });
    expect(response.status).toBe(500);
  });

  it('returns 400 for validation errors in payload', async () => {
    const request = new Request('http://localhost/api/timesheet/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2026 })
    });

    const response = await POST({ request });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.message).toBeDefined();
  });

  it('returns 200 with valid payload', async () => {
    const request = new Request('http://localhost/api/timesheet/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 3,
        companyCode: '405627530',
        employeeName: 'Test User',
        employeeId: '01005031116',
        vacationDates: [],
        outputFormat: 'docx'
      })
    });

    const response = await POST({ request });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('timesheet');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
