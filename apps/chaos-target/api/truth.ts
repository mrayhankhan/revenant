import type { IncomingMessage, ServerResponse } from 'node:http';

import { truthFeed } from '../lib/layouts.js';

/**
 * The structured feed, published beside the rendered board exactly as the real
 * ATS platforms publish theirs — and, like theirs, unaffected by how the page
 * is laid out. Revenant grades every heal against this.
 */
export default function handler(_request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'no-store, max-age=0',
  });
  response.end(JSON.stringify(truthFeed()));
}
