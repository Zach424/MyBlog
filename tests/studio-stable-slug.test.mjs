import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STABLE_SLUG_WIDGET_NAME,
  createStableSlugControl,
  createStableSlugPreview,
  getStableSlugIdentity,
  getStableSlugLifecycle,
  registerStableSlugWidget,
  validateStableSlugValue,
} from "../studio/stable-slug-widget.mjs";

function immutableEntry(values) {
  return { get: (key) => values[key] };
}

function element(type, props, ...children) {
  return { children, props, type };
}

function createControlInstance(props) {
  const specification = createStableSlugControl({
    createClass: (value) => value,
    h: element,
  });
  return Object.assign(Object.create(specification), { props });
}

test("derives editable and locked lifecycle from Decap entry identity", () => {
  assert.equal(getStableSlugLifecycle({ newRecord: true }), "editable");
  assert.equal(
    getStableSlugLifecycle({ newRecord: true, path: "content/posts/copied.md" }),
    "editable",
  );
  assert.equal(getStableSlugLifecycle({ newRecord: false }), "locked");
  assert.equal(
    getStableSlugLifecycle({ path: "content/posts/existing.md" }),
    "locked",
  );
  assert.equal(getStableSlugLifecycle({}), "editable");
  assert.equal(
    getStableSlugLifecycle(immutableEntry({ newRecord: false })),
    "locked",
  );
});

test("uses the canonical entry slug before the path filename", () => {
  assert.equal(
    getStableSlugIdentity({ slug: "canonical", path: "content/posts/fallback.md" }),
    "canonical",
  );
  assert.equal(
    getStableSlugIdentity({ path: "content\\projects\\fallback.md" }),
    "fallback",
  );
  assert.equal(getStableSlugIdentity({}), "");
});

test("rejects identity drift only after the entry becomes stable", () => {
  assert.deepEqual(
    validateStableSlugValue({ entry: { newRecord: true }, value: "new-slug" }),
    { error: false },
  );
  assert.deepEqual(
    validateStableSlugValue({
      entry: { newRecord: false, slug: "stable-slug" },
      value: "stable-slug",
    }),
    { error: false },
  );
  assert.match(
    validateStableSlugValue({
      entry: { newRecord: false, slug: "stable-slug" },
      value: "drifted-slug",
    }).error.message,
    /已锁定为 stable-slug.*内容文件.*公开 URL.*附件目录/u,
  );
});

test("renders a copyable read-only identity for existing entries", () => {
  let changed = 0;
  const control = createControlInstance({
    classNameWrapper: "cms-input",
    entry: { newRecord: false, slug: "stable-slug" },
    forID: "slug-field",
    onChange: () => { changed += 1; },
    setActiveStyle() {},
    setInactiveStyle() {},
    value: "stable-slug",
  });
  const tree = control.render();
  const input = tree.children[0];
  const evidence = tree.children[1];
  assert.equal(tree.props["data-stable-slug-lifecycle"], "locked");
  assert.equal(input.props.readOnly, true);
  assert.equal(input.props["aria-readonly"], "true");
  assert.equal(input.props["aria-describedby"], "slug-field-lifecycle");
  assert.equal(input.props.onChange, undefined);
  assert.match(evidence.children.join(""), /已锁定为 stable-slug/u);
  control.handleChange({ target: { value: "changed" } });
  assert.equal(changed, 0);
});

test("keeps new and copied entries editable until their first save", () => {
  let value = "";
  const control = createControlInstance({
    classNameWrapper: "cms-input",
    entry: { newRecord: true, path: "content/posts/copied.md" },
    forID: "slug-field",
    onChange: (nextValue) => { value = nextValue; },
    setActiveStyle() {},
    setInactiveStyle() {},
    value: "copied",
  });
  const tree = control.render();
  assert.equal(tree.props["data-stable-slug-lifecycle"], "editable");
  assert.equal(tree.children[0].props.readOnly, false);
  assert.equal(typeof tree.children[0].props.onChange, "function");
  control.handleChange({ target: { value: "new-copy" } });
  assert.equal(value, "new-copy");
  assert.match(tree.children[1].children.join(""), /复制条目.*新的 slug/u);
});

test("preserves the slug in the default entry preview", () => {
  const preview = createStableSlugPreview({
    createClass: (value) => value,
    h: element,
  });
  const tree = preview.render.call({ props: { value: "stable-slug" } });
  assert.equal(tree.props["data-stable-slug-preview"], "true");
  assert.match(tree.children.join(""), /stable-slug/u);
  assert.equal(preview.render.call({ props: { value: "" } }), null);
});

test("registers one observable widget and pins the Decap entry-state contract", async () => {
  const registrations = [];
  const CMS = {
    registerWidget(name, control, preview) {
      registrations.push({ control, name, preview });
    },
  };
  const documentRef = { documentElement: { dataset: {} } };
  const options = {
    CMS,
    createClass: (value) => value,
    documentRef,
    h: element,
  };
  const control = registerStableSlugWidget(options);
  assert.equal(registerStableSlugWidget(options), control);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].name, STABLE_SLUG_WIDGET_NAME);
  assert.equal(typeof registrations[0].preview.render, "function");
  assert.equal(documentRef.documentElement.dataset.stableSlugWidget, "registered");

  const runtimeMap = JSON.parse(await readFile(
    new URL("../node_modules/decap-cms/dist/decap-cms.js.map", import.meta.url),
    "utf8",
  ));
  const sourceContent = (suffix) => {
    const index = runtimeMap.sources.findIndex((source) => source.endsWith(suffix));
    assert.notEqual(index, -1, `runtime source map missing ${suffix}`);
    return runtimeMap.sourcesContent[index];
  };
  const widgetSource = sourceContent(
    "/components/Editor/EditorControlPane/Widget.js",
  );
  const reducerSource = sourceContent("/reducers/entryDraft.js");
  assert.match(
    widgetSource,
    /React\.createElement\(controlComponent, \{[\s\S]*?\n\s+entry,/u,
  );
  assert.match(reducerSource, /DRAFT_CREATE_FROM_ENTRY:[\s\S]*?newRecord'\], false/u);
  assert.match(reducerSource, /DRAFT_CREATE_EMPTY:[\s\S]*?newRecord'\], true/u);
  assert.match(reducerSource, /DRAFT_CREATE_DUPLICATE_FROM_ENTRY:[\s\S]*?newRecord'\], true/u);
});
