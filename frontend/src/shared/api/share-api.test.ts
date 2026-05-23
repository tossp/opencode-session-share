import { describe, expect, it, vi } from 'vitest';
import { fetchShareData, loadShareState, shareStateFromResult } from './share';
import type { RawShareItem } from '../domain/types';

const shareID = 'ses_test_001';
const items = [
  {
    type: 'session',
    data: { id: shareID, title: 'Test share' },
  },
] satisfies RawShareItem[];

describe('share API client', () => {
  it('loads share data without sending a password header before password entry', async () => {
    const fetcher = mockFetch(jsonResponse(200, items));

    const result = await fetchShareData(shareID, { fetcher });

    expect(result).toEqual({ ok: true, items });
    expect(fetcher).toHaveBeenCalledWith(`/api/share/${shareID}/data`, { headers: {} });
    expect(requestHeaders(fetcher)['X-Share-Password']).toBeUndefined();
  });

  it('sends the password header after password entry', async () => {
    const fetcher = mockFetch(jsonResponse(200, items));

    const result = await fetchShareData(shareID, { fetcher, password: 'secret-password' });

    expect(result).toEqual({ ok: true, items });
    expect(requestHeaders(fetcher)['X-Share-Password']).toBe('secret-password');
  });

  it('keeps the app in password prompt state when the backend requires a password', async () => {
    const fetcher = mockFetch(jsonResponse(401, { message: 'unauthorized' }));

    const state = await loadShareState(shareID, { fetcher });

    expect(state).toEqual({ status: 'password', message: '需要访问密码', isRetry: false });
  });

  it('keeps a wrong-password retry in password state with a Chinese error', async () => {
    const result = await fetchShareData(shareID, {
      fetcher: mockFetch(jsonResponse(401, { message: 'unauthorized' })),
      password: 'wrong-password',
    });

    expect(result).toEqual({
      ok: false,
      error: { code: 'password_required', message: '需要访问密码', status: 401 },
    });
    expect(shareStateFromResult(result, true)).toEqual({
      status: 'password',
      message: '密码错误，请重试',
      isRetry: true,
    });
  });

  it('maps 404 to a Chinese not-found state', async () => {
    const state = await loadShareState(shareID, {
      fetcher: mockFetch(jsonResponse(404, { message: 'missing' })),
    });

    expect(state).toEqual({ status: 'error', kind: 'not_found', message: '分享不存在' });
  });

  it('maps 500 to a generic Chinese load error', async () => {
    const state = await loadShareState(shareID, {
      fetcher: mockFetch(jsonResponse(500, { message: 'boom' })),
    });

    expect(state).toEqual({ status: 'error', kind: 'load_failed', message: '加载分享数据失败' });
  });

  it('maps invalid JSON payloads to a generic Chinese load error', async () => {
    const state = await loadShareState(shareID, {
      fetcher: mockFetch(jsonResponse(200, { invalid: true })),
    });

    expect(state).toEqual({ status: 'error', kind: 'load_failed', message: '加载分享数据失败' });
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockFetch(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

function requestHeaders(fetcher: typeof fetch): Record<string, string> {
  const mock = vi.mocked(fetcher);
  const init = mock.mock.calls[0]?.[1];

  if (init === undefined || init.headers === undefined || init.headers instanceof Headers || Array.isArray(init.headers)) {
    return {};
  }

  return init.headers;
}
