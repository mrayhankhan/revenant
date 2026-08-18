import type { IncomingMessage, ServerResponse } from 'node:http';

import { renderBoard } from '../lib/layouts.js';
import { getLayout } from '../lib/state.js';

/** The board itself. The URL a collector is pointed at, and never changes. */
export default async function handler(
  _request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const layout = await getLayout();

  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    // Never cache. A flip has to be visible to the very next scrape, and a CDN
    // holding the old markup would make the heal look like it failed.
    'cache-control': 'no-store, max-age=0, must-revalidate',
  });
  response.end(renderBoard(layout));
}
