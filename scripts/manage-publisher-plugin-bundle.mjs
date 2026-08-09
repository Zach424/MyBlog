import { lstat, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  createPublisherPluginBundleDescriptor,
  isPublisherPluginBundleVerified,
  observePublisherPluginBundle,
  PUBLISHER_PLUGIN_BUNDLE_FILES,
} from "../lib/content/publisher-plugin-bundle.ts";

function fail(message) {
  console.error(`[plugin-bundle] ${message}`);
  process.exit(2);
}

async function readRegularFile(path) {
  try {
    const detail = await lstat(path);
    if (!detail.isFile() || detail.isSymbolicLink()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

function parseJson(bytes) {
  if (bytes === null) return undefined;
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
}

let args;
try {
  args = parseArgs({
    options: { write: { default: false, type: "boolean" } },
    strict: true,
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (args.positionals.length !== 0) fail("该命令不接受位置参数");

const root = resolve(process.cwd());
const pluginRoot = join(root, ".obsidian", "plugins", "myblog-publisher");
const fileEntries = await Promise.all(
  PUBLISHER_PLUGIN_BUNDLE_FILES.map(async (path) => [
    path,
    await readRegularFile(join(pluginRoot, path)),
  ]),
);
const files = Object.fromEntries(fileEntries);
if (Object.values(files).some((bytes) => bytes === null)) {
  fail("manifest.json、main.js 与 styles.css 必须都是普通文件");
}
const manifest = parseJson(files["manifest.json"]);
if (
  typeof manifest !== "object" ||
  manifest === null ||
  manifest.id !== "myblog-publisher" ||
  typeof manifest.version !== "string"
) {
  fail("manifest.json 插件身份不可用");
}

const descriptor = createPublisherPluginBundleDescriptor(
  manifest.version,
  files,
);
const descriptorPath = join(pluginRoot, "bundle.json");
if (args.values.write) {
  await writeFile(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
  console.log(
    `[plugin-bundle] WROTE · ${manifest.id}@${manifest.version} · ${descriptor.files.length}/${descriptor.files.length} SHA-256 files`,
  );
} else {
  const current = observePublisherPluginBundle(
    parseJson(await readRegularFile(descriptorPath)),
    files,
  );
  if (!isPublisherPluginBundleVerified(current, manifest.version)) {
    console.error(
      "[plugin-bundle] HOLD · bundle.json 缺失、无效或与磁盘插件文件不一致；运行 npm run plugin:bundle -- --write",
    );
    process.exitCode = 1;
  } else {
    console.log(
      `[plugin-bundle] VERIFIED · ${manifest.id}@${manifest.version} · ${current.files.length}/${current.files.length} SHA-256 files`,
    );
  }
}
