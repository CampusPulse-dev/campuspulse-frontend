import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
/** WebKit's setOffline navigation fails before SW dispatch (Playwright #42775).
 * Drop actual upstream sockets instead, so the worker handles genuine network failures. */
export async function offlineProxy(upstream: string) {
  let blocked = false;
  const target = new URL(upstream);
  const server = createServer((req, res) => {
    if (blocked) {
      req.socket.destroy();
      return;
    }
    // Pin host and port to the upstream so an absolute request URL can't redirect the proxy.
    const forwarded = request(
      {
        hostname: target.hostname,
        port: target.port,
        path: req.url ?? '/',
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    forwarded.on('error', () => res.destroy());
    req.pipe(forwarded);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    block: () => {
      blocked = true;
      server.closeAllConnections();
    },
    unblock: () => {
      blocked = false;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
