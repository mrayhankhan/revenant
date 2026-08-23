import type { IncomingMessage, ServerResponse } from 'node:http';

import { renderJob } from '../lib/layouts.js';
import { ROLES } from '../lib/roles.js';
import { getLayout } from '../lib/state.js';

/**
 * A single job page.
 *
 * The board links to these, and a scraper follows those links to read the full
 * description — so without them every row comes back as a dead page. The first
 * collector run against this target returned six rows and six 404s, one per
 * listing, for exactly that reason.
 *
 * Like the board, it renders in whichever layout is live, so a redesign changes
 * the detail page too.
 */
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const id = url.searchParams.get('id') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? '';

  const role = ROLES.find((candidate) => candidate.id === id);

  if (!role) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('No such role');
    return;
  }

  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store, max-age=0, must-revalidate',
  });
  response.end(renderJob(role, await getLayout()));
}
