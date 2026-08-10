import type { ContentRecord } from "./content";
import { createRssXml, type RssChannelOptions } from "./discovery";
import { createFeedLastModified } from "./feed-http";
import { createSha256ConditionalResponse } from "./http-validators";

export const RSS_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

export function createRssNotFoundResponse(scope: string) {
  return new Response(`${scope} RSS not found.\n`, {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}

interface RssResponseOptions extends RssChannelOptions {
  headers?: HeadersInit;
}

export function createRssResponse(
  request: Request,
  siteUrl: URL,
  records: ContentRecord[],
  options: RssResponseOptions = {},
) {
  const { headers: extraHeaders, ...channelOptions } = options;
  const headers = new Headers(extraHeaders);
  headers.set("cache-control", RSS_CACHE_CONTROL);
  headers.set("content-type", "application/rss+xml; charset=utf-8");

  return createSha256ConditionalResponse(
    request,
    createRssXml(siteUrl, records, channelOptions),
    headers,
    { lastModified: createFeedLastModified("rss", records) },
  );
}
