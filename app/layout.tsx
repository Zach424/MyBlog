import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import {
  resolveSiteUrl,
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_TITLE,
} from "@/lib/site";
import "./globals.css";
import "./markdown-rich-content.css";

async function getSiteUrl() {
  const requestHeaders = await headers();
  return resolveSiteUrl(requestHeaders);
}

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl();

  return {
    metadataBase: siteUrl,
    title: {
      default: SITE_TITLE,
      template: `%s — Zach424`,
    },
    description: SITE_DESCRIPTION,
    authors: [{ name: "Zach424", url: "https://github.com/Zach424" }],
    creator: "Zach424",
    icons: {
      icon: {
        type: "image/png",
        url: "/icon.png",
      },
      other: {
        rel: "search",
        type: "application/opensearchdescription+xml",
        url: new URL("/opensearch.xml", siteUrl),
      },
    },
    alternates: {
      canonical: "/",
      types: {
        "application/json": "/content.json",
        "application/feed+json": "/feed.json",
        "application/atom+xml": "/updates.atom",
        "application/rss+xml": "/rss.xml",
      },
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: "/",
      siteName: SITE_TITLE,
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: "Zach424 Engineering Notes — Commit Trace",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F6F7" },
    { media: "(prefers-color-scheme: dark)", color: "#101820" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={SITE_LANGUAGE}>
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <div className="top-rule" aria-hidden="true" />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
