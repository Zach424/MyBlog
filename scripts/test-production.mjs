import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForServer(origin, processOutput) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.status < 500) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Next.js production server did not become ready.\n${processOutput()}`);
}

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const port = await reservePort();
const origin = `http://127.0.0.1:${port}`;
const output = [];
const server = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
  { cwd: projectRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);

for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => output.push(chunk));
}

try {
  await waitForServer(origin, () => output.join(""));
  const testFiles = process.argv.slice(2);
  const tests = spawn(process.execPath, ["--test", ...testFiles], {
    cwd: projectRoot,
    env: { ...process.env, TEST_BASE_URL: origin },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve) => tests.once("exit", resolve));
  if (exitCode !== 0) process.exitCode = Number(exitCode) || 1;
} finally {
  server.kill();
}
