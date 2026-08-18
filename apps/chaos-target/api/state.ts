import type { IncomingMessage, ServerResponse } from 'node:http';

import { ROLES } from '../lib/roles.js';
import { getLayout, isPersistent } from '../lib/state.js';

/** Which layout is live. `persistent` false means flips will not survive. */
export default async function handler(
  _request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(
    JSON.stringify({
      layout: await getLayout(),
      roles: ROLES.length,
      persistent: isPersistent(),
    }),
  );
}
