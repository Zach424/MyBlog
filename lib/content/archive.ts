import type { ContentRecord } from "./contract.ts";

export interface ContentArchiveMonth {
  entries: ContentRecord[];
  key: string;
  month: string;
}

export interface ContentArchiveYear {
  entryCount: number;
  months: ContentArchiveMonth[];
  year: string;
}

function compareArchiveEntries(left: ContentRecord, right: ContentRecord) {
  return (
    right.publishedAt.localeCompare(left.publishedAt) ||
    left.title.localeCompare(right.title, "zh-CN") ||
    left.url.localeCompare(right.url, "en")
  );
}

export function createContentArchive(
  records: readonly ContentRecord[],
): ContentArchiveYear[] {
  const years = new Map<string, Map<string, ContentRecord[]>>();

  for (const record of [...records].sort(compareArchiveEntries)) {
    const year = record.publishedAt.slice(0, 4);
    const month = record.publishedAt.slice(5, 7);
    const yearMonths = years.get(year) ?? new Map<string, ContentRecord[]>();
    const monthEntries = yearMonths.get(month) ?? [];

    monthEntries.push(record);
    yearMonths.set(month, monthEntries);
    years.set(year, yearMonths);
  }

  return [...years.entries()].map(([year, months]) => ({
    entryCount: [...months.values()].reduce(
      (total, entries) => total + entries.length,
      0,
    ),
    months: [...months.entries()].map(([month, entries]) => ({
      entries,
      key: `${year}-${month}`,
      month,
    })),
    year,
  }));
}
