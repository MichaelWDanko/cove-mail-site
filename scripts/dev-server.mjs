import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import worker from "../worker/index.js";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT ?? 4173);

function loadLocalEnvironment() {
  return {
    COVE_SITE_ENV: process.env.COVE_SITE_ENV ?? "sandbox",
    COVE_PADDLE_CLIENT_TOKEN:
      process.env.COVE_PADDLE_CLIENT_TOKEN ?? "test_local_preview_token",
  };
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function serveAsset(request) {
  const url = new URL(request.url);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const localPath = resolve(root, `.${requestedPath}`);
  if (!localPath.startsWith(`${root}/`)) return new Response("Not found.", { status: 404 });

  try {
    const file = await stat(localPath);
    if (!file.isFile()) return new Response("Not found.", { status: 404 });
    return new Response(createReadStream(localPath), {
      headers: { "Content-Type": contentTypes[extname(localPath)] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}

const server = createServer(async (incoming, outgoing) => {
  const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD";
  const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, {
    method: incoming.method,
    headers: incoming.headers,
    body: hasBody ? incoming : undefined,
    duplex: hasBody ? "half" : undefined,
  });
  const response = await worker.fetch(request, {
    ...loadLocalEnvironment(),
    ASSETS: { fetch: serveAsset },
  });

  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) {
    for await (const chunk of response.body) outgoing.write(chunk);
  }
  outgoing.end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Cove Mail site preview: http://127.0.0.1:${port}/`);
});
