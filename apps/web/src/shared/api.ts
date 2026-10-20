/** A non-2xx answer from the api, carrying its status so a page can tell 401 from 404 from 500. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** GET a JSON resource from the api, same origin, with the session cookie. */
export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include', headers: { accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body && typeof body.message === 'string' && body.message) || res.statusText);
  }
  return (await res.json()) as T;
}
