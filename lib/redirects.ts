import { parseDocument } from "yaml";
import { z } from "zod";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const LITERAL_PATH_PATTERN = /^\/(?:[a-z0-9][a-z0-9._~-]*(?:\/[a-z0-9][a-z0-9._~-]*)*)?$/u;

const isoDateSchema = z.preprocess(
  (value) =>
    value instanceof Date && !Number.isNaN(value.valueOf())
      ? value.toISOString().slice(0, 10)
      : value,
  z.string().regex(ISO_DATE_PATTERN, "必须是 YYYY-MM-DD 格式的日期"),
);

const redirectRuleSchema = z
  .object({
    addedAt: isoDateSchema,
    destination: z.string().trim().min(1).max(256),
    reason: z.string().trim().min(8, "迁移原因至少需要 8 个字符").max(200),
    source: z.string().trim().min(1).max(256),
  })
  .strict();

const redirectRegistrySchema = z
  .object({
    redirects: z.array(redirectRuleSchema).max(1000, "永久重定向最多 1000 条"),
    version: z.literal(1),
  })
  .strict();

export type RedirectRule = z.infer<typeof redirectRuleSchema>;
export type RedirectRegistry = z.infer<typeof redirectRegistrySchema>;

export type RedirectValidationContext = {
  canonicalRoutes: ReadonlySet<string>;
  currentRoutes: ReadonlySet<string>;
  reportDate: string;
};

export class RedirectValidationError extends Error {
  constructor(sourcePath: string, message: string) {
    super(`[redirects] ${sourcePath}: ${message}`);
    this.name = "RedirectValidationError";
  }
}

function validateDate(value: string, sourcePath: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new RedirectValidationError(sourcePath, `addedAt 不是有效日期：${value}`);
  }
}

function validateLiteralPath(
  value: string,
  label: "destination" | "source",
  sourcePath: string,
) {
  if (!LITERAL_PATH_PATTERN.test(value)) {
    throw new RedirectValidationError(
      sourcePath,
      `${label} 必须是精确的小写 ASCII 站内路径，不能包含查询、锚点、编码、通配符或尾随斜杠：${value}`,
    );
  }
  const segments = value.slice(1).split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new RedirectValidationError(sourcePath, `${label} 不能包含 . 或 .. 路径段：${value}`);
  }
}

function parseYaml(sourcePath: string, raw: string) {
  try {
    const document = parseDocument(raw.replace(/^\uFEFF/u, ""), {
      prettyErrors: false,
      schema: "core",
      uniqueKeys: true,
    });
    if (document.errors.length > 0) throw document.errors[0];
    return document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RedirectValidationError(sourcePath, `YAML 无法解析：${message}`);
  }
}

export function parseRedirectRegistry(sourcePath: string, raw: string) {
  const result = redirectRegistrySchema.safeParse(parseYaml(sourcePath, raw));
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "registry"}: ${issue.message}`)
      .join("；");
    throw new RedirectValidationError(sourcePath, issues);
  }
  return result.data;
}

function reservedSource(source: string) {
  return ["/_next", "/api", "/studio", "/uploads"].some(
    (prefix) => source === prefix || source.startsWith(`${prefix}/`),
  );
}

function assertNoCycles(
  rulesBySource: ReadonlyMap<string, RedirectRule>,
  sourcePath: string,
) {
  for (const source of rulesBySource.keys()) {
    const visited = new Set<string>();
    let current = source;
    while (rulesBySource.has(current)) {
      if (visited.has(current)) {
        throw new RedirectValidationError(
          sourcePath,
          `永久重定向形成循环：${[...visited, current].join(" → ")}`,
        );
      }
      visited.add(current);
      current = rulesBySource.get(current)?.destination ?? "";
    }
  }
}

export function validateRedirectRegistry(
  registry: RedirectRegistry,
  context: RedirectValidationContext,
  sourcePath = "content/redirects.yml",
) {
  validateDate(context.reportDate, sourcePath);
  const rulesBySource = new Map<string, RedirectRule>();

  for (const rule of registry.redirects) {
    validateDate(rule.addedAt, sourcePath);
    if (reservedSource(rule.source)) {
      throw new RedirectValidationError(sourcePath, `source 使用保留命名空间：${rule.source}`);
    }
    validateLiteralPath(rule.source, "source", sourcePath);
    validateLiteralPath(rule.destination, "destination", sourcePath);
    if (rule.addedAt > context.reportDate) {
      throw new RedirectValidationError(
        sourcePath,
        `${rule.source} 的 addedAt ${rule.addedAt} 不能晚于构建日期 ${context.reportDate}`,
      );
    }
    if (rule.source === rule.destination) {
      throw new RedirectValidationError(sourcePath, `${rule.source} 不能重定向到自身`);
    }
    if (rulesBySource.has(rule.source)) {
      throw new RedirectValidationError(sourcePath, `source 重复：${rule.source}`);
    }
    if (context.currentRoutes.has(rule.source)) {
      throw new RedirectValidationError(sourcePath, `source 覆盖当前有效路由：${rule.source}`);
    }
    rulesBySource.set(rule.source, rule);
  }

  assertNoCycles(rulesBySource, sourcePath);
  for (const rule of rulesBySource.values()) {
    if (rulesBySource.has(rule.destination)) {
      throw new RedirectValidationError(
        sourcePath,
        `只允许单跳永久重定向：${rule.source} → ${rule.destination}`,
      );
    }
    if (!context.canonicalRoutes.has(rule.destination)) {
      throw new RedirectValidationError(
        sourcePath,
        `destination 不是当前公开 HTML 路由：${rule.destination}`,
      );
    }
  }

  return [...rulesBySource.values()].sort((left, right) =>
    left.source.localeCompare(right.source, "en"),
  );
}

export function toNextRedirects(rules: RedirectRule[]) {
  return rules.map(({ destination, source }) => ({
    destination,
    permanent: true as const,
    source,
  }));
}
