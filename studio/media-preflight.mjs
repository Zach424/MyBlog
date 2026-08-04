export const STUDIO_MEDIA_BUDGET = Object.freeze({
  maxBytes: 3 * 1024 * 1024,
  maxWidth: 2560,
  maxHeight: 2560,
  maxPixels: 8_000_000,
  maxAnimationPixels: 80_000_000,
});

export const STUDIO_SUPPORTED_IMAGE_EXTENSIONS = Object.freeze([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

export const STUDIO_IMAGE_ACCEPT = STUDIO_SUPPORTED_IMAGE_EXTENSIONS.join(",");

const FORMAT_BY_EXTENSION = Object.freeze({
  ".avif": "avif",
  ".gif": "gif",
  ".jpeg": "jpeg",
  ".jpg": "jpeg",
  ".png": "png",
  ".webp": "webp",
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const textDecoder = new TextDecoder("latin1");

function fileError(fileName, message, cause) {
  return new Error(
    `[studio-media] ${fileName}: ${message}`,
    cause ? { cause } : undefined,
  );
}

function extensionOf(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function textAt(bytes, offset, length) {
  return textDecoder.decode(bytes.subarray(offset, offset + length));
}

function startsWithBytes(bytes, expected) {
  return expected.every((value, index) => bytes[index] === value);
}

function assertAvailable(bytes, offset, length, fileName) {
  if (offset < 0 || length < 0 || offset + length > bytes.length) {
    throw fileError(fileName, "图片结构不完整，文件可能已损坏");
  }
}

function inspectPngFrames(bytes, view, fileName) {
  let offset = 8;
  let pages = 1;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const chunkEnd = offset + 12 + length;
    assertAvailable(bytes, offset, 12 + length, fileName);
    const type = textAt(bytes, offset + 4, 4);
    if (type === "acTL") {
      assertAvailable(bytes, offset + 8, 4, fileName);
      pages = view.getUint32(offset + 8);
      if (pages < 1) throw fileError(fileName, "APNG 动画帧数无效");
    }
    offset = chunkEnd;
    if (type === "IEND") break;
  }

  return pages;
}

function skipGifSubBlocks(bytes, offset, fileName) {
  while (offset < bytes.length) {
    const length = bytes[offset];
    offset += 1;
    if (length === 0) return offset;
    assertAvailable(bytes, offset, length, fileName);
    offset += length;
  }
  throw fileError(fileName, "GIF 数据块不完整，文件可能已损坏");
}

function inspectGifFrames(bytes, fileName) {
  assertAvailable(bytes, 0, 13, fileName);
  let offset = 13;
  const globalTable = (bytes[10] & 0x80) !== 0;
  if (globalTable) offset += 3 * 2 ** ((bytes[10] & 0x07) + 1);
  let pages = 0;

  while (offset < bytes.length) {
    const marker = bytes[offset];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      assertAvailable(bytes, offset, 2, fileName);
      offset = skipGifSubBlocks(bytes, offset + 2, fileName);
      continue;
    }
    if (marker === 0x2c) {
      assertAvailable(bytes, offset, 10, fileName);
      const packed = bytes[offset + 9];
      offset += 10;
      if ((packed & 0x80) !== 0) offset += 3 * 2 ** ((packed & 0x07) + 1);
      assertAvailable(bytes, offset, 1, fileName);
      offset = skipGifSubBlocks(bytes, offset + 1, fileName);
      pages += 1;
      continue;
    }
    throw fileError(fileName, "GIF 数据块无法识别，文件可能已损坏");
  }

  if (pages < 1) throw fileError(fileName, "GIF 不包含可解码画面");
  return pages;
}

function inspectWebpFrames(bytes, view, fileName) {
  let offset = 12;
  let pages = 0;
  let animationHeader = false;

  while (offset + 8 <= bytes.length) {
    const type = textAt(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    assertAvailable(bytes, offset + 8, length, fileName);
    if (type === "ANIM") animationHeader = true;
    if (type === "ANMF") pages += 1;
    offset += 8 + length + (length % 2);
  }

  if (animationHeader && pages < 1) {
    throw fileError(fileName, "WebP 动画声明缺少画面数据");
  }
  return Math.max(1, pages);
}

function inspectAvif(bytes, view, fileName) {
  assertAvailable(bytes, 0, 16, fileName);
  if (textAt(bytes, 4, 4) !== "ftyp") return undefined;

  const boxLength = view.getUint32(0);
  const end = Math.min(boxLength || bytes.length, bytes.length);
  const brands = [];
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    brands.push(textAt(bytes, offset, 4));
  }
  if (!brands.includes("avif") && !brands.includes("avis")) return undefined;
  if (brands.includes("avis")) {
    throw fileError(
      fileName,
      "动画 AVIF 暂不支持浏览器预检；请转为静态 AVIF/WebP，或使用 Obsidian 发布器",
    );
  }
  return { format: "avif", pages: 1 };
}

function inspectEncodedFormat(bytes, fileName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.length >= 24 && startsWithBytes(bytes, PNG_SIGNATURE)) {
    return { format: "png", pages: inspectPngFrames(bytes, view, fileName) };
  }
  if (bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(textAt(bytes, 0, 6))) {
    return { format: "gif", pages: inspectGifFrames(bytes, fileName) };
  }
  if (
    bytes.length >= 12 &&
    textAt(bytes, 0, 4) === "RIFF" &&
    textAt(bytes, 8, 4) === "WEBP"
  ) {
    return { format: "webp", pages: inspectWebpFrames(bytes, view, fileName) };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: "jpeg", pages: 1 };
  }

  const avif = inspectAvif(bytes, view, fileName);
  if (avif) return avif;
  throw fileError(fileName, "图片格式无法识别，文件可能损坏或并非真实图片");
}

async function decodeImageInBrowser(file) {
  if (typeof globalThis.createImageBitmap !== "function") {
    throw new Error("当前浏览器不支持本地图片解码");
  }
  const bitmap = await globalThis.createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

async function digestBytesInBrowser(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("当前浏览器不支持 SHA-256 媒体指纹");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function assertInspectionWithinBudget(inspection) {
  const { bytes, fileName, height, pages, width } = inspection;
  if (bytes > STUDIO_MEDIA_BUDGET.maxBytes) {
    throw fileError(
      fileName,
      `文件大小 ${formatMegabytes(bytes)} 超过 ${formatMegabytes(STUDIO_MEDIA_BUDGET.maxBytes)} 上限；请先压缩或转换为 AVIF/WebP`,
    );
  }
  if (width > STUDIO_MEDIA_BUDGET.maxWidth || height > STUDIO_MEDIA_BUDGET.maxHeight) {
    throw fileError(
      fileName,
      `尺寸 ${width}×${height} px 超过 ${STUDIO_MEDIA_BUDGET.maxWidth}×${STUDIO_MEDIA_BUDGET.maxHeight} px 上限`,
    );
  }
  const pixels = width * height;
  if (pixels > STUDIO_MEDIA_BUDGET.maxPixels) {
    throw fileError(
      fileName,
      `单帧 ${pixels.toLocaleString("en-US")} 像素超过 ${STUDIO_MEDIA_BUDGET.maxPixels.toLocaleString("en-US")} 上限`,
    );
  }
  if (pixels * pages > STUDIO_MEDIA_BUDGET.maxAnimationPixels) {
    throw fileError(
      fileName,
      `共 ${pages} 帧、${(pixels * pages).toLocaleString("en-US")} 像素，超过动图 ${STUDIO_MEDIA_BUDGET.maxAnimationPixels.toLocaleString("en-US")} 总像素上限`,
    );
  }
}

export async function inspectStudioMediaFile(
  file,
  {
    decodeImage = decodeImageInBrowser,
    digestBytes = digestBytesInBrowser,
  } = {},
) {
  const fileName = file?.name || "未命名文件";
  const extension = extensionOf(fileName);
  const expectedFormat = FORMAT_BY_EXTENSION[extension];
  if (!expectedFormat) {
    throw fileError(
      fileName,
      `只允许 ${STUDIO_SUPPORTED_IMAGE_EXTENSIONS.join(", ")} 图片，当前扩展名为 ${extension || "无"}`,
    );
  }
  if (!Number.isFinite(file?.size) || file.size < 1) {
    throw fileError(fileName, "文件为空或无法读取大小");
  }
  if (file.size > STUDIO_MEDIA_BUDGET.maxBytes) {
    throw fileError(
      fileName,
      `文件大小 ${formatMegabytes(file.size)} 超过 ${formatMegabytes(STUDIO_MEDIA_BUDGET.maxBytes)} 上限；请先压缩或转换为 AVIF/WebP`,
    );
  }

  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    throw fileError(fileName, "无法读取图片字节", error);
  }
  const encoded = inspectEncodedFormat(bytes, fileName);
  if (encoded.format !== expectedFormat) {
    throw fileError(
      fileName,
      `扩展名 ${extension} 与实际格式 ${encoded.format} 不一致`,
    );
  }

  let dimensions;
  try {
    dimensions = await decodeImage(file);
  } catch (error) {
    throw fileError(fileName, "图片无法解码，文件可能损坏或并非真实图片", error);
  }
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw fileError(fileName, "图片缺少可验证的宽高信息");
  }

  const inspection = {
    bytes: file.size,
    extension,
    fileName,
    format: encoded.format,
    height,
    pages: encoded.pages,
    sha256: await digestBytes(bytes),
    width,
  };
  assertInspectionWithinBudget(inspection);
  return inspection;
}

export function normalizeStudioMediaTargetFileName(fileName) {
  const withoutAccents = fileName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "");
  if ([...withoutAccents].some((character) => character.codePointAt(0) > 0x7f)) {
    throw fileError(fileName, "文件名包含无法稳定转换的非 ASCII 字符；请改用英文、数字、连字符或下划线");
  }

  const normalized = [...withoutAccents]
    .map((character) => /[\w.~\-]/u.test(character) ? character : "-")
    .join("")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  if (
    !normalized ||
    /^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/iu.test(normalized) ||
    normalized === "." ||
    normalized === ".."
  ) {
    throw fileError(fileName, "文件名无法生成安全的 Git 附件路径；请重命名后再选择");
  }
  return normalized;
}

function readStudioEntrySlug(documentRef) {
  const controls = [...(documentRef?.querySelectorAll?.("input[data-stable-slug-state]") ?? [])];
  if (controls.length === 0) return undefined;
  if (controls.length !== 1) {
    throw new Error("[studio-media] 无法唯一识别当前条目的稳定 slug");
  }
  const slug = String(controls[0].value ?? "").trim();
  if (!slug) throw new Error("[studio-media] 请先填写稳定 slug，再选择图片");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
    throw new Error(`[studio-media] 稳定 slug ${slug} 格式无效`);
  }
  return slug;
}

function parseStudioMediaManifest(value) {
  if (
    !value ||
    value.version !== 1 ||
    value.root !== "public/uploads" ||
    !Array.isArray(value.entries)
  ) {
    throw new Error("[studio-media] 已发布媒体清单格式无效");
  }
  const manifest = new Map();
  for (const entry of value.entries) {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      !/^public\/uploads\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+$/u.test(entry.path) ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes < 1 ||
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(entry.sha256) ||
      manifest.has(entry.path)
    ) {
      throw new Error("[studio-media] 已发布媒体清单条目无效");
    }
    manifest.set(entry.path, entry);
  }
  return manifest;
}

export function createStudioMediaConflictChecker({
  confirmReplace = globalThis.confirm,
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
} = {}) {
  let manifestPromise;
  const getManifest = () => {
    if (!manifestPromise) {
      manifestPromise = (async () => {
        if (typeof fetchImpl !== "function") {
          throw new Error("[studio-media] 当前浏览器无法读取已发布媒体清单");
        }
        const response = await fetchImpl("/studio/media-manifest.json", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (!response?.ok) {
          throw new Error(`[studio-media] 已发布媒体清单请求失败（HTTP ${response?.status ?? "unknown"}）`);
        }
        return parseStudioMediaManifest(await response.json());
      })();
    }
    return manifestPromise;
  };

  return async function checkStudioMediaConflict(inspection) {
    const slug = readStudioEntrySlug(documentRef);
    if (!slug) return { state: "unscoped" };
    const fileName = normalizeStudioMediaTargetFileName(inspection.fileName);
    const targetPath = `public/uploads/${slug}/${fileName}`;
    const existing = (await getManifest()).get(targetPath);
    if (!existing) return { state: "new", targetPath };
    if (existing.bytes === inspection.bytes && existing.sha256 === inspection.sha256) {
      return { existing, state: "same", targetPath };
    }

    const confirmed = await confirmReplace?.([
      `附件 ${targetPath} 已经存在，而且内容不同。`,
      `已发布：${formatMegabytes(existing.bytes)} · ${existing.sha256.slice(0, 12)}`,
      `新文件：${formatMegabytes(inspection.bytes)} · ${inspection.sha256.slice(0, 12)}`,
      "继续会替换公开地址下的原图。确认替换吗？",
    ].join("\n"));
    if (!confirmed) {
      throw fileError(inspection.fileName, `已取消替换 ${targetPath}`);
    }
    return { existing, state: "replace-confirmed", targetPath };
  };
}

export function formatStudioMediaInspection(inspection) {
  const frames = inspection.pages > 1 ? ` · ${inspection.pages} 帧` : "";
  return `${inspection.format.toUpperCase()} · ${inspection.width}×${inspection.height} px${frames} · ${formatMegabytes(inspection.bytes)}`;
}

function isStudioImageInput(target) {
  return Boolean(
    target &&
    target.tagName === "INPUT" &&
    target.type === "file" &&
    (target.accept === "image/*" || target.accept === STUDIO_IMAGE_ACCEPT),
  );
}

export function createStudioMediaPreflightHandler({
  checkConflict = async () => ({ state: "unscoped" }),
  EventConstructor = globalThis.Event,
  inspect = inspectStudioMediaFile,
  report = () => {},
} = {}) {
  const approvedFiles = new WeakSet();

  return async function handleStudioMediaSelection(event) {
    const input = event.target;
    if (!isStudioImageInput(input)) return false;
    input.accept = STUDIO_IMAGE_ACCEPT;
    const file = input.files?.[0];
    if (!file) return false;
    if (approvedFiles.has(file)) {
      approvedFiles.delete(file);
      return false;
    }

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    report({ detail: file.name, state: "checking", title: "正在检查图片" });

    try {
      const inspection = await inspect(file);
      const conflict = await checkConflict(inspection);
      const optimizationNote = ["jpeg", "png"].includes(inspection.format)
        ? "Studio 会保留原格式；需要自动转 WebP 时请使用 Obsidian 发布器。"
        : "文件会按当前格式进入 Git 草稿。";
      const conflictNote = conflict.targetPath
        ? `目标 ${conflict.targetPath}。`
        : "当前是全局媒体库，未绑定条目附件目录。";
      const title = {
        new: "新增图片预检通过",
        "replace-confirmed": "已确认替换现有图片",
        same: "图片与已发布文件相同",
        unscoped: "图片预检通过",
      }[conflict.state] ?? "图片预检通过";
      report({
        detail: `${formatStudioMediaInspection(inspection)}。${conflictNote}${optimizationNote}`,
        state: "success",
        title,
      });
      approvedFiles.add(file);
      input.dispatchEvent(new EventConstructor("change", { bubbles: true }));
      return true;
    } catch (error) {
      input.value = "";
      report({
        detail: `${error instanceof Error ? error.message : String(error)}。请修正后重新选择。`,
        state: "error",
        title: "图片未进入草稿",
      });
      return false;
    }
  };
}

function createStatusReporter(documentRef) {
  return ({ detail, state, title }) => {
    let status = documentRef.getElementById("studio-media-preflight");
    if (!status) {
      status = documentRef.createElement("section");
      status.id = "studio-media-preflight";
      status.setAttribute("aria-atomic", "true");
      status.innerHTML = [
        '<p data-preflight-label>Media preflight / published inventory</p>',
        '<strong data-preflight-title></strong>',
        '<span data-preflight-detail></span>',
      ].join("");
      documentRef.body.append(status);
    }
    status.dataset.state = state;
    status.setAttribute("aria-live", state === "error" ? "assertive" : "polite");
    status.setAttribute("role", state === "error" ? "alert" : "status");
    status.querySelector("[data-preflight-title]").textContent = title;
    status.querySelector("[data-preflight-detail]").textContent = detail;
  };
}

export function installStudioMediaPreflight({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
} = {}) {
  if (!documentRef || !windowRef) return () => {};
  if (windowRef.__MYBLOG_MEDIA_PREFLIGHT_INSTALLED__) {
    return windowRef.__MYBLOG_MEDIA_PREFLIGHT_INSTALLED__;
  }

  const report = createStatusReporter(documentRef);
  const checkConflict = createStudioMediaConflictChecker({
    confirmReplace: windowRef.confirm?.bind(windowRef),
    documentRef,
    fetchImpl: windowRef.fetch?.bind(windowRef),
  });
  const handleChange = createStudioMediaPreflightHandler({ checkConflict, report });
  const handleClick = (event) => {
    if (isStudioImageInput(event.target)) event.target.accept = STUDIO_IMAGE_ACCEPT;
  };
  windowRef.addEventListener("click", handleClick, true);
  windowRef.addEventListener("change", handleChange, true);
  const rootDataset = documentRef.documentElement?.dataset;
  if (rootDataset) rootDataset.mediaPreflight = "installed";

  const uninstall = () => {
    windowRef.removeEventListener("click", handleClick, true);
    windowRef.removeEventListener("change", handleChange, true);
    if (rootDataset) delete rootDataset.mediaPreflight;
    delete windowRef.__MYBLOG_MEDIA_PREFLIGHT_INSTALLED__;
  };
  windowRef.__MYBLOG_MEDIA_PREFLIGHT_INSTALLED__ = uninstall;
  return uninstall;
}
