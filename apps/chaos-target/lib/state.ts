import type { Layout } from './layouts.js';

/**
 * Which layout is currently live.
 *
 * Vercel runs each request in its own serverless instance, so an in-memory flag
 * would flip on one instance and leave the next request still serving the old
 * layout — the demo would appear to work locally and then behave randomly in
 * front of a judge. State therefore lives in a Redis-compatible REST store
 * (Vercel KV / Upstash), which every instance reads.
 *
 * When those environment variables are absent — running `npm run dev` on a
 * laptop — it falls back to a module-level variable, which is correct there
 * because that really is a single long-lived process.
 */

const KEY = 'chaos:layout';

let inMemory: Layout = 'a';

function restConfig(): { url: string; token: string } | null {
  const url = process.env['KV_REST_API_URL'] ?? process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['KV_REST_API_TOKEN'] ?? process.env['UPSTASH_REDIS_REST_TOKEN'];
  return url && token ? { url, token } : null;
}

export function isPersistent(): boolean {
  return restConfig() !== null;
}

export async function getLayout(): Promise<Layout> {
  const config = restConfig();
  if (!config) return inMemory;

  try {
    const response = await fetch(`${config.url}/get/${KEY}`, {
      headers: { authorization: `Bearer ${config.token}` },
      cache: 'no-store',
    });
    if (!response.ok) return 'a';

    const body = (await response.json()) as { result?: string | null };
    return body.result === 'b' ? 'b' : 'a';
  } catch {
    // A store that cannot be read must not take the board down; layout A is the
    // state the collector was built against, so it is the safe default.
    return 'a';
  }
}

export async function setLayout(layout: Layout): Promise<Layout> {
  const config = restConfig();

  if (!config) {
    inMemory = layout;
    return inMemory;
  }

  await fetch(`${config.url}/set/${KEY}/${layout}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}` },
    cache: 'no-store',
  });

  return layout;
}

export async function flipLayout(): Promise<Layout> {
  const current = await getLayout();
  return setLayout(current === 'a' ? 'b' : 'a');
}
