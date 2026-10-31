import { addEntry } from '@/inspector/store'
import { NetworkError, type ApiResponse } from './types'

export type RequestOptions = {
  body?: unknown
  headers?: Record<string, string>
  /** Shown next to the entry in the inspector, e.g. "Scenario 3". */
  label?: string
}

// A sleeping Render instance can take about a minute to answer.
const TIMEOUT_MS = 90_000

function headersToObject(headers: Headers) {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export async function request<T>(
  method: string,
  url: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...options.headers }
  let requestBody: string | undefined
  if (options.body !== undefined) {
    requestBody = JSON.stringify(options.body)
    requestHeaders['Content-Type'] = 'application/json'
  }

  const startedAt = Date.now()
  const t0 = performance.now()
  let response: Response
  let text: string
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    text = await response.text()
  } catch (error) {
    addEntry({
      label: options.label,
      method,
      url,
      startedAt,
      durationMs: Math.round(performance.now() - t0),
      status: null,
      requestHeaders,
      requestBody,
      responseHeaders: {},
      responseBody: error instanceof Error ? error.message : String(error),
    })
    throw new NetworkError(error)
  }

  addEntry({
    label: options.label,
    method,
    url,
    startedAt,
    durationMs: Math.round(performance.now() - t0),
    status: response.status,
    requestHeaders,
    requestBody,
    responseHeaders: headersToObject(response.headers),
    responseBody: text,
  })

  let json: unknown = undefined
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    // Non-JSON bodies, such as a proxy error page, fall through as an error below.
  }

  if (response.ok && json !== undefined) {
    return { ok: true, status: response.status, data: json as T, headers: response.headers }
  }
  const message =
    json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
      ? json.error
      : `Unexpected response (HTTP ${response.status})`
  return { ok: false, status: response.status, error: message, headers: response.headers }
}

/** Seconds from a Retry-After header, or null when it is missing. */
export function retryAfterSeconds(headers: Headers) {
  const value = Number(headers.get('Retry-After'))
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null
}
