export const SITE_TITLE = "Zach424 / Engineering Notes";
export const SITE_DESCRIPTION =
  "记录学习路径、技术取舍和项目复盘，把写过的代码变成可复用的判断。";

interface HeaderReader {
  get(name: string): string | null;
}

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0].trim() || undefined;
}

export function resolveSiteUrl(
  requestHeaders?: HeaderReader,
  requestUrl = "http://localhost:3000",
) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }

  const fallback = new URL(requestUrl);
  const host =
    firstForwardedValue(requestHeaders?.get("x-forwarded-host") ?? null) ??
    firstForwardedValue(requestHeaders?.get("host") ?? null) ??
    fallback.host;
  const forwardedProtocol = firstForwardedValue(
    requestHeaders?.get("x-forwarded-proto") ?? null,
  );
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : fallback.protocol.replace(":", "") || "https";

  return new URL(`${protocol}://${host}`);
}

export function absoluteSiteUrl(siteUrl: URL, pathname: string) {
  return new URL(pathname, siteUrl).href;
}
