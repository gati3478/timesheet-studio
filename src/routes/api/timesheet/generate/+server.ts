import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHolidaysForYear } from '$lib/server/holidays';
import { computeTimesheet, TimesheetValidationError } from '$lib/server/timesheet';
import { fillTimesheetTemplate } from '$lib/server/docx';
import { buildOutputFilename } from '$lib/server/filename';
import { convertDocxBufferToDoc, DocConversionError } from '$lib/server/doc-conversion';
import { loadTemplateBuffer } from '$lib/server/template';
import type { TimesheetGenerateRequest } from '$lib/server/types';

function isValidOutputFormat(value: unknown): value is 'docx' | 'doc' {
  return value === 'docx' || value === 'doc';
}

function parsePayload(payload: unknown): TimesheetGenerateRequest {
  if (!payload || typeof payload !== 'object') {
    throw new TimesheetValidationError('Request payload must be a JSON object.', []);
  }

  const body = payload as Partial<TimesheetGenerateRequest>;

  if (!body.employeeName || typeof body.employeeName !== 'string') {
    throw new TimesheetValidationError('Employee name is required.', []);
  }

  if (!body.employeeId || typeof body.employeeId !== 'string') {
    throw new TimesheetValidationError('Employee id is required.', []);
  }

  if (!body.companyCode || typeof body.companyCode !== 'string') {
    throw new TimesheetValidationError('Company code is required.', []);
  }

  if (!Array.isArray(body.vacationDates)) {
    throw new TimesheetValidationError('Vacation dates must be an array.', []);
  }

  if (!isValidOutputFormat(body.outputFormat)) {
    throw new TimesheetValidationError('Output format must be either docx or doc.', []);
  }

  const companyCode = body.companyCode.trim();
  const employeeName = body.employeeName.trim();
  const employeeId = body.employeeId.trim();

  if (companyCode.length === 0) {
    throw new TimesheetValidationError('Company code is required.', []);
  }

  if (employeeName.length === 0) {
    throw new TimesheetValidationError('Employee name is required.', []);
  }

  if (employeeId.length === 0) {
    throw new TimesheetValidationError('Employee id is required.', []);
  }

  return {
    year: Number(body.year),
    month: Number(body.month),
    companyCode,
    employeeName,
    employeeId,
    vacationDates: body.vacationDates,
    outputFormat: body.outputFormat
  };
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const payload = await request.json();
    const input = parsePayload(payload);

    const holidays = await getHolidaysForYear(input.year, { includeStateOnly: false });
    const holidayDates = new Set(holidays.map((holiday) => holiday.date));

    const computed = computeTimesheet({
      year: input.year,
      month: input.month,
      vacationDates: input.vacationDates,
      holidayDates
    });

    const templateBuffer = await loadTemplateBuffer();
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

    const filename = buildOutputFilename(input.year, input.month, input.outputFormat);
    const mimeType =
      input.outputFormat === 'doc'
        ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return new Response(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename=\"${filename}\"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    if (error instanceof TimesheetValidationError) {
      return json({ message: error.message, details: error.details }, { status: 400 });
    }

    if (error instanceof DocConversionError) {
      return json({ message: error.message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Unexpected generation error.';
    return json({ message }, { status: 500 });
  }
};
