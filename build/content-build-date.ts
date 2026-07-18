const CONTENT_TIME_ZONE = "Asia/Shanghai";

export function resolveContentBuildDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONTENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}
