import { rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildDirectory = resolve(projectRoot, "dist");

if (dirname(buildDirectory) !== projectRoot || basename(buildDirectory) !== "dist") {
  throw new Error(`Refusing to remove unexpected build directory: ${buildDirectory}`);
}

rmSync(buildDirectory, { recursive: true, force: true });
