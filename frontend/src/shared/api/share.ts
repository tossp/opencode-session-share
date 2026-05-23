import type { RawShareItem } from '../domain/types';

export type ShareLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'password'; message: string; isRetry: boolean }
  | { status: 'error'; kind: 'not_found' | 'load_failed'; message: string }
  | { status: 'ready'; items: RawShareItem[] };

export type ShareAPIErrorCode = 'password_required' | 'not_found' | 'load_failed' | 'invalid_json';

export interface ShareAPIError {
  code: ShareAPIErrorCode;
  message: string;
  status?: number;
}

export type ShareAPIResult =
  | { ok: true; items: RawShareItem[] }
  | { ok: false; error: ShareAPIError };

export interface FetchShareDataOptions {
  fetcher?: typeof fetch;
  password?: string;
}

const passwordRequiredMessage = '需要访问密码';
const passwordRetryMessage = '密码错误，请重试';
const notFoundMessage = '分享不存在';
const loadFailedMessage = '加载分享数据失败';

export async function fetchShareData(
  shareID: string,
  options: FetchShareDataOptions = {},
): Promise<ShareAPIResult> {
  const fetcher = options.fetcher ?? fetch;
  const headers = sharePasswordHeaders(options.password);

  let response: Response;
  try {
    response = await fetcher(`/api/share/${encodeURIComponent(shareID)}/data`, { headers });
  } catch {
    return apiError('load_failed', loadFailedMessage);
  }

  if (!response.ok) {
    return responseError(response.status);
  }

  try {
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return apiError('invalid_json', loadFailedMessage);
    }

    return { ok: true, items: payload as RawShareItem[] };
  } catch {
    return apiError('invalid_json', loadFailedMessage);
  }
}

export function shareStateFromResult(result: ShareAPIResult, attemptedPassword: boolean): ShareLoadState {
  if (result.ok) {
    return { status: 'ready', items: result.items };
  }

  switch (result.error.code) {
    case 'password_required':
      return {
        status: 'password',
        message: attemptedPassword ? passwordRetryMessage : passwordRequiredMessage,
        isRetry: attemptedPassword,
      };
    case 'not_found':
      return { status: 'error', kind: 'not_found', message: notFoundMessage };
    case 'invalid_json':
    case 'load_failed':
      return { status: 'error', kind: 'load_failed', message: loadFailedMessage };
  }
}

export async function loadShareState(
  shareID: string,
  options: FetchShareDataOptions = {},
): Promise<ShareLoadState> {
  const result = await fetchShareData(shareID, options);

  return shareStateFromResult(result, hasPassword(options.password));
}

function sharePasswordHeaders(password: string | undefined): HeadersInit {
  if (!hasPassword(password)) {
    return {};
  }

  return { 'X-Share-Password': password };
}

function hasPassword(password: string | undefined): password is string {
  return password !== undefined && password.length > 0;
}

function responseError(status: number): ShareAPIResult {
  if (status === 401) {
    return apiError('password_required', passwordRequiredMessage, status);
  }

  if (status === 404) {
    return apiError('not_found', notFoundMessage, status);
  }

  return apiError('load_failed', loadFailedMessage, status);
}

function apiError(code: ShareAPIErrorCode, message: string, status?: number): ShareAPIResult {
  return { ok: false, error: { code, message, status } };
}
