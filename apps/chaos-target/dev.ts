/**
 * Local server for the chaos target.
 *
 *   npm run dev -w @revenant/chaos-target
 *
 * Routes exactly as `vercel.json` does in production, and shares the same
 * layout and state modules, so what you see locally is what deploys. Without KV
 * credentials the layout lives in memory, which is correct here because this
 * really is one long-lived process.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import board from './api/index.js';
import flip from './api/flip.js';
import state from './api/state.js';
import truth from './api/truth.js';
import { isPersistent } from './lib/state.js';

const PORT = Number(process.env['PORT'] ?? 4180);

type Handler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;

const ROUTES: Record<string, Handler> = {
  '/': board,
  '/index.html': board,
  '/chaos/flip': flip,
  '/chaos/state': state,
  '/chaos/truth': truth,
};

createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const handler = ROUTES[path];

  if (!handler) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }

  void handler(request, response);
}).listen(PORT, () => {
  console.log(`chaos target   http://localhost:${PORT}`);
  console.log(`flip           http://localhost:${PORT}/chaos/flip`);
  console.log(`ground truth   http://localhost:${PORT}/chaos/truth`);
  console.log(
    isPersistent()
      ? 'state          KV (flips survive across instances)'
      : 'state          in memory (fine locally, not on Vercel)',
  );
});
