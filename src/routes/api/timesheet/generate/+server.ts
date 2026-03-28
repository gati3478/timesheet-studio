import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHolidaysForYear } from '$lib/server/holidays';
import { computeTimesheet, TimesheetValidationError } from '$lib/server/timesheet';
import { fillTimesheetTemplate } from '$lib/server/docx';
import { buildOutputFilename } from '$lib/filename';
import { convertDocxBufferToDoc, DocConversionError } from '$lib/server/doc-conversion';
import { loadTemplateBuffer } from '$lib/server/template';
import { parsePayload } from '$lib/server/parse-payload';
import { isDocExportAvailable } from '$lib/server/capabilities';

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

export const POST: RequestHandler = async ({ request }) => {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_SIZE) {
    return json({ message: 'Request body too large.', details: [] }, { status: 413 });
  }

  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
      return json({ message: 'Request body too large.', details: [] }, { status: 413 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return json({ message: 'Request body must be valid JSON.', details: [] }, { status: 400 });
    }

    const input = parsePayload(payload);

    if (input.outputFormat === 'doc') {
      const docAvailable = await isDocExportAvailable();
      if (!docAvailable) {
        return json(
          {
            message: 'DOC export is not available. LibreOffice is not installed on this server.',
            details: ['Install LibreOffice (soffice) to enable DOC export, or use DOCX format.']
          },
          { status: 400 }
        );
      }
    }

    const [holidays, templateBuffer] = await Promise.all([
      getHolidaysForYear(input.year),
      loadTemplateBuffer()
    ]);
    const holidayDates = new Set(holidays.map((holiday) => holiday.date));

    const computed = computeTimesheet({
      year: input.year,
      month: input.month,
      vacationDates: input.vacationDates,
      holidayDates
    });
    const docxBuffer = await fillTimesheetTemplate({
      templateBuffer,
      companyCode: input.companyCode,
      employeeName: input.employeeName,
      employeeId: input.employeeId,
      computed
    });

    let outputBuffer = docxBuffer;
    if (input.outputFormat === 'doc') {
      outputBuffer = await convertDocxBufferToDoc(docxBuffer);
    }

    const filename = buildOutputFilename(
      input.employeeName,
      input.year,
      input.month,
      input.outputFormat
    );
    const mimeType =
      input.outputFormat === 'doc'
        ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const isAscii = /^[\x20-\x7E]*$/.test(filename);
    const contentDisposition = isAscii
      ? `attachment; filename="${filename}"`
      : `attachment; filename="timesheet.${input.outputFormat}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

    return new Response(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    if (error instanceof TimesheetValidationError) {
      return json({ message: error.message, details: error.details }, { status: 400 });
    }

    if (error instanceof DocConversionError) {
      console.error('DOC conversion failed:', error.message);
      return json(
        { message: 'DOC conversion failed. Please try DOCX format instead.', details: [] },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      console.error('Timesheet generation error:', error);
    }
    return json({ message: 'Unexpected generation error.', details: [] }, { status: 500 });
  }
};
