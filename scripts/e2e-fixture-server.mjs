import http from 'node:http';

const port = Number(process.env.E2E_FIXTURE_PORT ?? 3210);
const host = '127.0.0.1';

function renderTitle(hostname, slug) {
  return `Fixture ${hostname} ${slug.replace(/-/g, ' ')}`;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  const hostname = (request.headers.host ?? 'localhost').split(':')[0];
  const slug = url.pathname === '/' ? 'home' : url.pathname.slice(1);
  const title = renderTitle(hostname, slug);

  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p data-hostname="${hostname}">${hostname}</p>
      <p data-slug="${slug}">${slug}</p>
    </main>
  </body>
</html>`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

server.listen(port, host, () => {
  console.info(`E2E fixture server listening on http://${host}:${port}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
