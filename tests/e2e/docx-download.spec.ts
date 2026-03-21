import { test, expect } from '@playwright/test';
import JSZip from 'jszip';

const basePayload = {
  year: 2026,
  month: 1,
  companyCode: '405627530',
  employeeName: 'Test User',
  employeeId: '01005031116',
  vacationDates: [],
  outputFormat: 'docx'
};

test.describe('DOCX download', () => {
  test('DOCX filename matches expected format for ASCII name', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, employeeName: 'Test User', month: 1, year: 2026 }
    });

    expect(response.status()).toBe(200);
    const disposition = response.headers()['content-disposition'];
    expect(disposition).toContain('test-user-jan-2026-timesheet.docx');
  });

  test('Georgian name produces RFC 5987 encoded filename', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, employeeName: 'გიორგი პეტრიაშვილი', month: 3, year: 2026 }
    });

    expect(response.status()).toBe(200);
    const disposition = response.headers()['content-disposition'];
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain('filename="timesheet.docx"');
  });

  test('Generated DOCX is a valid ZIP with word/document.xml', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: basePayload
    });

    expect(response.status()).toBe(200);
    const buffer = await response.body();
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('word/document.xml')).not.toBeNull();
  });

  test('Generated DOCX contains employee name in document', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, employeeName: 'Test Download User' }
    });

    expect(response.status()).toBe(200);
    const buffer = await response.body();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')!.async('text');
    expect(docXml).toContain('Test Download User');
  });

  test('Generated DOCX contains vacation day codes', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: {
        ...basePayload,
        month: 3,
        year: 2026,
        vacationDates: ['2026-03-18', '2026-03-19']
      }
    });

    expect(response.status()).toBe(200);
    const buffer = await response.body();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')!.async('text');
    expect(docXml).toContain('შ');
  });

  test('Generated DOCX contains correct month date labels', async ({ request }) => {
    const response = await request.post('/api/timesheet/generate', {
      data: { ...basePayload, month: 1, year: 2026 }
    });

    expect(response.status()).toBe(200);
    const buffer = await response.body();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')!.async('text');
    expect(docXml).toContain('01.01.2026');
    expect(docXml).toContain('31.01.2026');
  });

  test('Generates valid DOCX for multiple months', async ({ request }) => {
    const months = [1, 2, 6, 12];

    for (const month of months) {
      const response = await request.post('/api/timesheet/generate', {
        data: { ...basePayload, month, year: 2026 }
      });

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      const body = await response.body();
      expect(body.length).toBeGreaterThan(0);
    }
  });
});
