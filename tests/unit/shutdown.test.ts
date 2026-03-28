import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDev = vi.hoisted(() => ({ value: true }));

vi.mock('$app/environment', () => ({
  get dev() {
    return mockDev.value;
  }
}));

import '../helpers/mock-kit-json';

function makeEvent(ip = '127.0.0.1') {
  return { getClientAddress: () => ip } as unknown;
}

describe('POST /api/system/shutdown', () => {
  let POST: (event: unknown) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 404 in non-dev mode', async () => {
    mockDev.value = false;
    const mod = await import('../../src/routes/api/system/shutdown/+server');
    POST = mod.POST as unknown as typeof POST;

    const response = await POST(makeEvent());
    expect(response.status).toBe(404);
  });

  it('returns 403 for non-localhost client in dev mode', async () => {
    mockDev.value = true;
    const mod = await import('../../src/routes/api/system/shutdown/+server');
    POST = mod.POST as unknown as typeof POST;

    const response = await POST(makeEvent('192.168.1.50'));
    expect(response.status).toBe(403);
  });

  it('returns shutdown message in dev mode from localhost', async () => {
    mockDev.value = true;
    const mod = await import('../../src/routes/api/system/shutdown/+server');
    POST = mod.POST as unknown as typeof POST;

    // Mock process.kill to prevent actual SIGTERM
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    const response = await POST(makeEvent());
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Server shutdown initiated.');

    killSpy.mockRestore();
  });
});
