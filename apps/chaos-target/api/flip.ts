import type { IncomingMessage, ServerResponse } from 'node:http';

import { flipLayout, isPersistent } from '../lib/state.js';

/**
 * Redesign the board.
 *
 * Accepts GET as well as POST purely so the flip can be triggered from a browser
 * address bar mid-demo, without cutting to a terminal.
 */
export default async function handler(
  _request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const layout = await flipLayout();

  response.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify({ layout, persistent: isPersistent() }));
}
