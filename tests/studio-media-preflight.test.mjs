import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  STUDIO_IMAGE_ACCEPT,
  STUDIO_MEDIA_BUDGET,
  STUDIO_SUPPORTED_IMAGE_EXTENSIONS,
  createStudioMediaPreflightHandler,
  formatStudioMediaInspection,
  inspectStudioMediaFile,
  installStudioMediaPreflight,
} from "../studio/media-preflight.mjs";
import {
  MEDIA_BUDGET,
  SUPPORTED_IMAGE_EXTENSIONS,
} from "../lib/media-policy.ts";

async function decodeWithSharp(file) {
  const metadata = await sharp(Buffer.from(await file.arrayBuffer()), {
    animated: true,
    failOn: "error",
  }).metadata();
  return {
    height: metadata.pageHeight ?? metadata.autoOrient?.height ?? metadata.height,
    width: metadata.autoOrient?.width ?? metadata.width,
  };
}

function browserFile(bytes, name, type = "application/octet-stream") {
  return new File([bytes], name, { type });
}

test("keeps the Studio browser budget aligned with the authoritative media policy", () => {
  assert.deepEqual(STUDIO_MEDIA_BUDGET, MEDIA_BUDGET);
  assert.deepEqual(
    STUDIO_SUPPORTED_IMAGE_EXTENSIONS,
    [...SUPPORTED_IMAGE_EXTENSIONS],
  );
  assert.equal(STUDIO_IMAGE_ACCEPT, ".avif,.gif,.jpeg,.jpg,.png,.webp");
});

test("recognizes and decodes every supported still image format", async () => {
  const source = sharp({
    create: {
      width: 320,
      height: 180,
      channels: 3,
      background: "#486f78",
    },
  });
  const fixtures = [
    ["evidence.avif", await source.clone().avif().toBuffer()],
    ["evidence.gif", await source.clone().gif().toBuffer()],
    ["evidence.jpg", await source.clone().jpeg().toBuffer()],
    ["evidence.png", await source.clone().png().toBuffer()],
    ["evidence.webp", await source.clone().webp().toBuffer()],
  ];

  for (const [name, bytes] of fixtures) {
    const inspection = await inspectStudioMediaFile(browserFile(bytes, name), {
      decodeImage: decodeWithSharp,
    });
    assert.equal(inspection.width, 320, name);
    assert.equal(inspection.height, 180, name);
    assert.equal(inspection.pages, 1, name);
    assert.match(formatStudioMediaInspection(inspection), /320×180 px/u, name);
  }
});

test("rejects unsupported, spoofed, corrupt, oversized, and over-dimension images", async () => {
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "white" },
  }).png().toBuffer();
  await assert.rejects(
    inspectStudioMediaFile(browserFile(png, "evidence.svg"), {
      decodeImage: decodeWithSharp,
    }),
    /只允许 .*\.webp 图片.*\.svg/u,
  );
  await assert.rejects(
    inspectStudioMediaFile(browserFile(png, "evidence.jpg"), {
      decodeImage: decodeWithSharp,
    }),
    /扩展名 \.jpg 与实际格式 png 不一致/u,
  );
  await assert.rejects(
    inspectStudioMediaFile(
      browserFile(Buffer.concat([png.subarray(0, 24), Buffer.from("broken")]), "broken.png"),
      { decodeImage: decodeWithSharp },
    ),
    /结构不完整|无法解码/u,
  );
  await assert.rejects(
    inspectStudioMediaFile(
      browserFile(Buffer.alloc(STUDIO_MEDIA_BUDGET.maxBytes + 1), "large.webp"),
      { decodeImage: decodeWithSharp },
    ),
    /超过 3\.00 MiB 上限/u,
  );

  const wide = await sharp({
    create: {
      width: STUDIO_MEDIA_BUDGET.maxWidth + 1,
      height: 1,
      channels: 3,
      background: "white",
    },
  }).png().toBuffer();
  await assert.rejects(
    inspectStudioMediaFile(browserFile(wide, "wide.png"), {
      decodeImage: decodeWithSharp,
    }),
    /尺寸 2561×1 px 超过/u,
  );
});

test("counts animated GIF and WebP frames before enforcing total pixels", async () => {
  const rawFrames = Buffer.alloc(4 * 6 * 3, 48);
  rawFrames.fill(192, 4 * 3 * 3);
  const animatedGif = await sharp(rawFrames, {
    raw: { width: 4, height: 6, pageHeight: 3, channels: 3 },
  }).gif({ delay: [80, 120], loop: 0 }).toBuffer();
  const gifInspection = await inspectStudioMediaFile(
    browserFile(animatedGif, "motion.gif"),
    { decodeImage: decodeWithSharp },
  );
  assert.equal(gifInspection.pages, 2);
  assert.match(formatStudioMediaInspection(gifInspection), /2 帧/u);

  const animatedWebp = await sharp(rawFrames, {
    raw: { width: 4, height: 6, pageHeight: 3, channels: 3 },
  }).webp({ delay: [80, 120], loop: 0 }).toBuffer();
  const webpInspection = await inspectStudioMediaFile(
    browserFile(animatedWebp, "motion.webp"),
    { decodeImage: decodeWithSharp },
  );
  assert.equal(webpInspection.pages, 2);

  const manyFramesRaw = Buffer.alloc(2 * 26 * 3);
  for (let frame = 0; frame < 13; frame += 1) {
    manyFramesRaw.fill(frame * 17, frame * 2 * 2 * 3, (frame + 1) * 2 * 2 * 3);
  }
  const manyFrames = await sharp(manyFramesRaw, {
    raw: { width: 2, height: 26, pageHeight: 2, channels: 3 },
  }).gif({ delay: Array(13).fill(80), loop: 0 }).toBuffer();
  await assert.rejects(
    inspectStudioMediaFile(browserFile(manyFrames, "too-many.gif"), {
      decodeImage: async () => ({ width: 2560, height: 2560 }),
    }),
    /共 13 帧.*超过动图 80,000,000 总像素/u,
  );
});

test("fails closed for animated AVIF sequences the browser contract cannot count", async () => {
  const bytes = Buffer.alloc(24);
  bytes.writeUInt32BE(24, 0);
  bytes.write("ftyp", 4, "ascii");
  bytes.write("avis", 8, "ascii");
  bytes.writeUInt32BE(0, 12);
  bytes.write("avif", 16, "ascii");
  bytes.write("mif1", 20, "ascii");

  await assert.rejects(
    inspectStudioMediaFile(browserFile(bytes, "motion.avif"), {
      decodeImage: async () => ({ width: 32, height: 32 }),
    }),
    /动画 AVIF 暂不支持浏览器预检/u,
  );
});

test("blocks the original change event and replays only approved files", async () => {
  const reports = [];
  let inspectCalls = 0;
  let replayPromise;
  let handler;
  const input = {
    accept: "image/*",
    files: [browserFile(Buffer.from([1]), "evidence.webp")],
    tagName: "INPUT",
    type: "file",
    value: "selected",
    dispatchEvent(event) {
      replayPromise = handler({ target: input, type: event.type });
      return true;
    },
  };
  let prevented = 0;
  let stopped = 0;
  handler = createStudioMediaPreflightHandler({
    inspect: async () => {
      inspectCalls += 1;
      return {
        bytes: 1,
        extension: ".webp",
        fileName: "evidence.webp",
        format: "webp",
        height: 18,
        pages: 1,
        width: 32,
      };
    },
    report: (report) => reports.push(report),
  });

  assert.equal(await handler({
    preventDefault: () => { prevented += 1; },
    stopImmediatePropagation: () => { stopped += 1; },
    target: input,
  }), true);
  assert.equal(await replayPromise, false);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  assert.equal(inspectCalls, 1);
  assert.equal(input.accept, STUDIO_IMAGE_ACCEPT);
  assert.deepEqual(reports.map((report) => report.state), ["checking", "success"]);

  let rejectedDispatches = 0;
  const rejectedReports = [];
  const rejectedInput = {
    ...input,
    accept: "image/*",
    dispatchEvent() { rejectedDispatches += 1; },
    value: "selected",
  };
  const rejectedHandler = createStudioMediaPreflightHandler({
    inspect: async () => { throw new Error("尺寸超限"); },
    report: (report) => rejectedReports.push(report),
  });
  assert.equal(await rejectedHandler({
    preventDefault() {},
    stopImmediatePropagation() {},
    target: rejectedInput,
  }), false);
  assert.equal(rejectedDispatches, 0);
  assert.equal(rejectedInput.value, "");
  assert.deepEqual(rejectedReports.map((report) => report.state), ["checking", "error"]);
});

test("installs one observable capture boundary and removes it cleanly", () => {
  const listeners = [];
  const removed = [];
  const documentRef = { documentElement: { dataset: {} } };
  const windowRef = {
    addEventListener(type, handler, capture) {
      listeners.push({ capture, handler, type });
    },
    removeEventListener(type, handler, capture) {
      removed.push({ capture, handler, type });
    },
  };

  const uninstall = installStudioMediaPreflight({ documentRef, windowRef });
  assert.equal(documentRef.documentElement.dataset.mediaPreflight, "installed");
  assert.deepEqual(listeners.map(({ capture, type }) => ({ capture, type })), [
    { capture: true, type: "click" },
    { capture: true, type: "change" },
  ]);
  assert.equal(
    installStudioMediaPreflight({ documentRef, windowRef }),
    uninstall,
  );
  assert.equal(listeners.length, 2);

  uninstall();
  assert.equal("mediaPreflight" in documentRef.documentElement.dataset, false);
  assert.equal("__MYBLOG_MEDIA_PREFLIGHT_INSTALLED__" in windowRef, false);
  assert.deepEqual(removed, listeners);
});
