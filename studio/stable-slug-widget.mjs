export const STABLE_SLUG_WIDGET_NAME = "stable-slug";

const REGISTRATION_KEY = "__MYBLOG_STABLE_SLUG_WIDGET_CONTROL__";

function readEntryValue(entry, key) {
  if (!entry) return undefined;
  if (typeof entry.get === "function") return entry.get(key);
  return entry[key];
}

function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function slugFromPath(path) {
  const normalized = textValue(path).replaceAll("\\", "/");
  const fileName = normalized.split("/").at(-1) || "";
  return fileName.replace(/\.[^.]+$/u, "");
}

export function getStableSlugIdentity(entry) {
  return textValue(readEntryValue(entry, "slug")) ||
    slugFromPath(readEntryValue(entry, "path"));
}

export function getStableSlugLifecycle(entry) {
  const newRecord = readEntryValue(entry, "newRecord");
  if (newRecord === true) return "editable";
  if (newRecord === false) return "locked";
  return getStableSlugIdentity(entry) ? "locked" : "editable";
}

export function validateStableSlugValue({ entry, value }) {
  if (getStableSlugLifecycle(entry) !== "locked") return { error: false };
  const identity = getStableSlugIdentity(entry);
  if (!identity || textValue(value) === identity) return { error: false };
  return {
    error: {
      message: `稳定 slug 已锁定为 ${identity}；请恢复该值。确需迁移时使用 Git 同步修改内容文件、公开 URL 和附件目录。`,
    },
  };
}

export function createStableSlugControl({ createClass, h }) {
  if (typeof createClass !== "function" || typeof h !== "function") {
    throw new Error("稳定 slug 控件缺少 Decap React 运行时");
  }

  return createClass({
    displayName: "MyBlogStableSlugControl",

    handleChange(event) {
      if (getStableSlugLifecycle(this.props.entry) === "locked") return;
      this.props.onChange(event.target.value);
    },

    isValid() {
      return validateStableSlugValue(this.props);
    },

    render() {
      const {
        classNameWrapper,
        entry,
        forID,
        setActiveStyle,
        setInactiveStyle,
        value,
      } = this.props;
      const lifecycle = getStableSlugLifecycle(entry);
      const locked = lifecycle === "locked";
      const identity = getStableSlugIdentity(entry) || textValue(value);
      const evidenceID = `${forID}-lifecycle`;
      const evidence = locked
        ? `已锁定为 ${identity}。它同时决定内容文件、公开 URL 和附件目录；迁移请使用 Git。`
        : "首次保存前可编辑；复制条目时必须换成新的 slug。保存后自动锁定。";

      return h(
        "div",
        {
          className: "stable-slug-control",
          "data-stable-slug-lifecycle": lifecycle,
        },
        h("input", {
          "aria-describedby": evidenceID,
          "aria-readonly": locked ? "true" : "false",
          autoCapitalize: "none",
          autoComplete: "off",
          autoCorrect: "off",
          className: classNameWrapper,
          "data-stable-slug-state": lifecycle,
          id: forID,
          inputMode: "url",
          onBlur: setInactiveStyle,
          onChange: locked ? undefined : this.handleChange,
          onFocus: setActiveStyle,
          readOnly: locked,
          spellCheck: false,
          type: "text",
          value: value || "",
        }),
        h(
          "p",
          {
            className: "stable-slug-lifecycle",
            "data-state": lifecycle,
            id: evidenceID,
          },
          h(
            "strong",
            {},
            `Identity state / ${lifecycle}`,
          ),
          ` · ${evidence}`,
        ),
      );
    },
  });
}

export function createStableSlugPreview({ createClass, h }) {
  if (typeof createClass !== "function" || typeof h !== "function") {
    throw new Error("稳定 slug 预览缺少 Decap React 运行时");
  }
  return createClass({
    displayName: "MyBlogStableSlugPreview",
    render() {
      if (!this.props.value) return null;
      return h(
        "div",
        { "data-stable-slug-preview": "true" },
        h("strong", {}, "稳定网址 Slug:"),
        ` ${this.props.value}`,
      );
    },
  });
}

export function registerStableSlugWidget({
  CMS = globalThis.CMS,
  createClass = globalThis.createClass,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerWidget !== "function") {
    throw new Error("稳定 slug 控件无法访问 Decap 注册表");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];

  const control = createStableSlugControl({ createClass, h });
  const preview = createStableSlugPreview({ createClass, h });
  CMS.registerWidget(STABLE_SLUG_WIDGET_NAME, control, preview);
  CMS[REGISTRATION_KEY] = control;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.stableSlugWidget = "registered";
  return control;
}
