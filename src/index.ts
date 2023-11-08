import wretch, { Wretch, WretchError, WretchOptions } from 'wretch'
import QueryAddon, { QueryStringAddon } from 'wretch/addons/queryString'
import { retry, RetryOptions } from 'wretch/middlewares/retry'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'

export class RequestError extends Error {
  method?: string
  responseCode?: string
  jsonResponse?: Record<string, unknown>

  constructor(public url: string, message: string) {
    super()

    this.name = 'RequestError'
    this.message = `${url}: ${message}`

    Error.captureStackTrace(this, RequestError)
  }
}

export function createSafeWretch(url: string, options: WretchOptions = {}) {
  return wretch()
    .addon(QueryAddon)
    .catcher(StatusCodes.TOO_MANY_REQUESTS, onWretchError)
    .catcher(StatusCodes.INTERNAL_SERVER_ERROR, onWretchError)
    .catcher(StatusCodes.REQUEST_TIMEOUT, onWretchError)
    .catcher(StatusCodes.GATEWAY_TIMEOUT, onWretchError)
    .catcher(StatusCodes.BAD_REQUEST, onWretchError)
    .catcher(StatusCodes.NOT_FOUND, onWretchError)
    .catcher(StatusCodes.UNAUTHORIZED, onWretchError)
    .catcher(StatusCodes.FORBIDDEN, onWretchError)
    .catcher(StatusCodes.CONFLICT, onWretchError)
    .url(url)
    .options(options)
}

export type SafeWretch = ReturnType<typeof createSafeWretch>;

export function withRetry(
  wretch: SafeWretch,
  options: RetryOptions,
) {
  return wretch.middlewares([
    retry(options),
  ])
}

export type RetrySafeWretch = ReturnType<typeof withRetry>;

function onWretchError(
  error: WretchError,
  original: Wretch<QueryStringAddon>
): void {
  const _error = new RequestError(
    error.response.url,
    error.message || getReasonPhrase(error.status.toString())
  )

  let errorContent

  try {
    if (error.text) {
      errorContent = JSON.parse(error.text)
    }
  } catch (e) {
    errorContent = error.text
  }

  _error.jsonResponse = errorContent
  _error.responseCode = error.status.toString()
  // eslint-disable-next-line dot-notation
  _error.method = original._options?.method

  throw _error
}
