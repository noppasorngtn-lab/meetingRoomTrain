/** A non-2xx answer from the api, carrying its status so a page can tell 401 from 404 from 500. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly field?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = (body && typeof body.message === 'string' && body.message) || res.statusText;
    throw new ApiError(res.status, message, body && typeof body.field === 'string' ? body.field : undefined);
  }
  return (await res.json()) as T;
}

/** GET a JSON resource from the api, same origin, with the session cookie. */
export async function getJson<T>(path: string): Promise<T> {
  return readJson<T>(await fetch(path, { credentials: 'include', headers: { accept: 'application/json' } }));
}

/** POST a JSON body to the api, same origin, with the session cookie. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return readJson<T>(
    await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}
