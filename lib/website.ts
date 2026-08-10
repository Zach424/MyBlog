import {
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_TITLE,
} from "./site.ts";

function canonicalSiteRoot(siteUrl: URL) {
  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
    throw new TypeError("siteUrl must use http or https");
  }
  if (siteUrl.username || siteUrl.password) {
    throw new TypeError("siteUrl must not include credentials");
  }

  return new URL("/", siteUrl);
}

export function createWebsiteId(siteUrl: URL) {
  return `${canonicalSiteRoot(siteUrl).href}#website`;
}

export function createContentStructuredIdentity(
  siteUrl: URL,
  contentUrl: URL,
) {
  const siteRoot = canonicalSiteRoot(siteUrl);
  const canonicalContentUrl = new URL(contentUrl);

  if (canonicalContentUrl.username || canonicalContentUrl.password) {
    throw new TypeError("contentUrl must not include credentials");
  }
  if (canonicalContentUrl.origin !== siteRoot.origin) {
    throw new TypeError("contentUrl must use the same origin as siteUrl");
  }
  if (canonicalContentUrl.search || canonicalContentUrl.hash) {
    throw new TypeError("contentUrl must not include a query or fragment");
  }
  if (canonicalContentUrl.pathname === "/") {
    throw new TypeError("contentUrl must identify a content path");
  }

  return {
    "@id": `${canonicalContentUrl.href}#content`,
    isPartOf: {
      "@id": createWebsiteId(siteRoot),
    },
  };
}

export function createWebsiteStructuredData(siteUrl: URL) {
  const siteRoot = canonicalSiteRoot(siteUrl);

  return {
    "@context": "https://schema.org" as const,
    "@type": "WebSite" as const,
    "@id": createWebsiteId(siteRoot),
    name: SITE_TITLE,
    url: siteRoot.href,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
  };
}
