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

export function createWebsiteStructuredData(siteUrl: URL) {
  const siteRoot = canonicalSiteRoot(siteUrl);

  return {
    "@context": "https://schema.org" as const,
    "@type": "WebSite" as const,
    "@id": `${siteRoot.href}#website`,
    name: SITE_TITLE,
    url: siteRoot.href,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
  };
}
