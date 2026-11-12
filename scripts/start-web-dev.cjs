const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const browserPort = Number(process.env.WEB_PORT || 8082);
const expoPort = Number(process.env.EXPO_WEB_PORT || 8083);
const envFile = path.join(projectRoot, ".env");
const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const configuredUrl = process.env.EXPO_PUBLIC_API_URL || envText.match(/^EXPO_PUBLIC_API_URL=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");

if (!configuredUrl) {
  throw new Error("EXPO_PUBLIC_API_URL must be set in the environment or .env");
}

const backend = new URL(configuredUrl);
const expo = spawn(path.join(projectRoot, "node_modules", ".bin", "expo"), ["start", "--web", "--port", String(expoPort)], {
  cwd: projectRoot,
  env: { ...process.env, EXPO_PUBLIC_WEB_API_PROXY: "true" },
  stdio: "inherit",
});

const server = http.createServer((request, response) => {
  const isApi = request.url === "/api" || request.url?.startsWith("/api/") || request.url?.startsWith("/socket.io/");
  const target = isApi ? backend : new URL(`http://127.0.0.1:${expoPort}`);
  const client = target.protocol === "https:" ? https : http;
  const headers = { ...request.headers, host: target.host };

  if (isApi) {
    delete headers.origin;
    delete headers.referer;
  }

  const upstream = client.request(new URL(request.url || "/", target), {
    method: request.method,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
    response.end(`Proxy request failed: ${error.message}`);
  });
  request.pipe(upstream);
});

server.on("upgrade", (request, socket, head) => {
  const isSocket = request.url?.startsWith("/socket.io/");
  const targetPort = isSocket ? Number(backend.port || (backend.protocol === "https:" ? 443 : 80)) : expoPort;
  const targetHost = isSocket ? backend.hostname : "127.0.0.1";
  const connect = isSocket && backend.protocol === "https:"
    ? () => tls.connect(targetPort, targetHost, { servername: targetHost }, forward)
    : () => net.connect(targetPort, targetHost, forward);
  let upstream;

  function forward() {
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`);
    for (const [name, value] of Object.entries(request.headers)) {
      if (isSocket && (name === "origin" || name === "referer")) continue;
      upstream.write(`${name}: ${name === "host" && isSocket ? backend.host : value}\r\n`);
    }
    upstream.write("\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  }

  upstream = connect();
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(browserPort, () => {
  console.log(`Web app: http://localhost:${browserPort}`);
});

server.on("error", (error) => {
  expo.kill("SIGINT");
  console.error(`Unable to start web app on port ${browserPort}: ${error.message}`);
  process.exitCode = 1;
});

function shutdown() {
  expo.kill("SIGINT");
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
expo.on("exit", () => server.close());
