import type { ContentRecord } from "./contract.ts";

export type ContentActivityMode = "published" | "updated";
export type ContentActivityType = "article" | "til" | "project";

export interface ContentActivityEvent {
  contentType: ContentActivityType;
  date: string;
  description: string;
  id: `${ContentActivityMode}:${ContentRecord["url"]}`;
  mode: ContentActivityMode;
  title: string;
  url: ContentRecord["url"];
}

export interface ContentActivityDay {
  date: string;
  events: ContentActivityEvent[];
}

export interface ContentActivity {
  counts: {
    days: number;
    events: number;
    published: number;
    records: number;
    updated: number;
  };
  days: ContentActivityDay[];
}

const modeOrder: Record<ContentActivityMode, number> = {
  updated: 0,
  published: 1,
};

function contentType(record: ContentRecord): ContentActivityType {
  if (record.kind === "project") return "project";
  return record.type === "til" ? "til" : "article";
}

function eventFor(
  record: ContentRecord,
  mode: ContentActivityMode,
  date: string,
): ContentActivityEvent {
  return {
    contentType: contentType(record),
    date,
    description: record.description,
    id: `${mode}:${record.url}`,
    mode,
    title: record.title,
    url: record.url,
  };
}

function compareEvents(
  left: ContentActivityEvent,
  right: ContentActivityEvent,
) {
  return (
    right.date.localeCompare(left.date) ||
    modeOrder[left.mode] - modeOrder[right.mode] ||
    left.title.localeCompare(right.title, "zh-CN") ||
    left.url.localeCompare(right.url, "en")
  );
}

export function createContentActivity(
  records: readonly ContentRecord[],
): ContentActivity {
  const events = records
    .flatMap((record) => {
      const recordEvents = [eventFor(record, "published", record.publishedAt)];
      if (record.updatedAt && record.updatedAt > record.publishedAt) {
        recordEvents.push(eventFor(record, "updated", record.updatedAt));
      }
      return recordEvents;
    })
    .sort(compareEvents);
  const days = new Map<string, ContentActivityEvent[]>();

  for (const event of events) {
    const dayEvents = days.get(event.date) ?? [];
    dayEvents.push(event);
    days.set(event.date, dayEvents);
  }

  const updated = events.filter((event) => event.mode === "updated").length;

  return {
    counts: {
      days: days.size,
      events: events.length,
      published: records.length,
      records: records.length,
      updated,
    },
    days: [...days.entries()].map(([date, dayEvents]) => ({
      date,
      events: dayEvents,
    })),
  };
}
