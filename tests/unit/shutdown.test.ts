import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDev = vi.hoisted(() => ({ value: true }));

vi.mock('$app/environment', () => ({
  get dev() {
    return mockDev.value;
  }
}));

vi.mock('@sveltejs/kit', () => ({
  json: (data: unknown, init?: ResponseInit) => {
    return new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}));

describe('POST /api/system/shutdown', () => {
  let POST: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 404 in non-dev mode', async () => {
    mockDev.value = false;
    const mod = await import('../../src/routes/api/system/shutdown/+server');
    POST = mod.POST as unknown as typeof POST;

    const response = await POST();
    expect(response.status).toBe(404);
  });

  it('returns shutdown message in dev mode', async () => {
    mockDev.value = true;
    const mod = await import('../../src/routes/api/system/shutdown/+server');
    POST = mod.POST as unknown as typeof POST;

    // Mock process.kill to prevent actual SIGTERM
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    const response = await POST();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Server shutdown initiated.');

    killSpy.mockRestore();
  });
});
