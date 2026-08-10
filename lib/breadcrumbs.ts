import { absoluteSiteUrl } from "./site.ts";

export interface BreadcrumbTrailItem {
  href: string;
  name: string;
}

function assertSiteUrl(siteUrl: URL) {
  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
    throw new TypeError("siteUrl must use http or https");
  }
}

export function createBreadcrumbList(
  siteUrl: URL,
  items: readonly BreadcrumbTrailItem[],
) {
  assertSiteUrl(siteUrl);
  if (items.length < 2) {
    throw new TypeError("breadcrumb trail must contain at least two items");
  }

  const siteRoot = new URL("/", siteUrl);
  const seenUrls = new Set<string>();
  const itemListElement = items.map((entry, index) => {
    if (entry.name.trim().length === 0) {
      throw new TypeError(`breadcrumb item ${index + 1} must have a non-empty name`);
    }
    if (!entry.href.startsWith("/") || entry.href.startsWith("//")) {
      throw new TypeError(
        `breadcrumb item ${index + 1} must use a root-relative path`,
      );
    }

    const itemUrl = new URL(entry.href, siteRoot);
    if (itemUrl.origin !== siteRoot.origin) {
      throw new TypeError(`breadcrumb item ${index + 1} must stay on the site origin`);
    }
    if (itemUrl.search || itemUrl.hash) {
      throw new TypeError(
        `breadcrumb item ${index + 1} must not include a query or fragment`,
      );
    }

    const item = absoluteSiteUrl(siteRoot, itemUrl.pathname);
    if (seenUrls.has(item)) {
      throw new TypeError("breadcrumb items must use a unique URL");
    }
    seenUrls.add(item);

    return {
      "@type": "ListItem" as const,
      position: index + 1,
      name: entry.name,
      item,
    };
  });

  return {
    "@context": "https://schema.org" as const,
    "@type": "BreadcrumbList" as const,
    itemListElement,
  };
}
