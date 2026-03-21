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

  it('returns 200 with DOC format and correct MIME type', async () => {
    const { convertDocxBufferToDoc } = await import('$lib/server/doc-conversion');
    const { buildOutputFilename } = await import('$lib/server/filename');
    vi.mocked(buildOutputFilename).mockReturnValue('test-timesheet.doc');

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
        outputFormat: 'doc'
      })
    });

    const response = await POST({ request });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/msword');
    expect(convertDocxBufferToDoc).toHaveBeenCalledOnce();
  });

  it('Content-Disposition uses RFC 5987 for non-ASCII filenames', async () => {
    const { buildOutputFilename } = await import('$lib/server/filename');
    vi.mocked(buildOutputFilename).mockReturnValue('გიორგი-mar-2026-timesheet.docx');

    const request = new Request('http://localhost/api/timesheet/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 3,
        companyCode: '405627530',
        employeeName: 'გიორგი',
        employeeId: '01005031116',
        vacationDates: [],
        outputFormat: 'docx'
      })
    });

    const response = await POST({ request });
    expect(response.status).toBe(200);
    const cd = response.headers.get('Content-Disposition')!;
    expect(cd).toContain('filename="timesheet.docx"');
    expect(cd).toContain("filename*=UTF-8''");
    expect(cd).toContain(encodeURIComponent('გიორგი-mar-2026-timesheet.docx'));
  });

  it('Content-Disposition uses simple format for ASCII filenames', async () => {
    const { buildOutputFilename } = await import('$lib/server/filename');
    vi.mocked(buildOutputFilename).mockReturnValue('test-user-mar-2026-timesheet.docx');

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
    const cd = response.headers.get('Content-Disposition')!;
    expect(cd).toBe('attachment; filename="test-user-mar-2026-timesheet.docx"');
    expect(cd).not.toContain('filename*=');
  });

  it('returns 500 when DocConversionError is thrown', async () => {
    const { convertDocxBufferToDoc } = await import('$lib/server/doc-conversion');
    const { DocConversionError } = await import('$lib/server/doc-conversion');
    vi.mocked(convertDocxBufferToDoc).mockRejectedValueOnce(
      new DocConversionError('soffice not found')
    );

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
        outputFormat: 'doc'
      })
    });

    const response = await POST({ request });
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.message).toBe('soffice not found');
  });

  it('returns 500 for unexpected errors during generation', async () => {
    const { loadTemplateBuffer } = await import('$lib/server/template');
    vi.mocked(loadTemplateBuffer).mockRejectedValueOnce(new Error('disk read failure'));

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
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.message).toBe('Unexpected generation error.');
  });
});
