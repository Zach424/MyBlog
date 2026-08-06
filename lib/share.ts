export type CanonicalSharePayload = {
  text: string;
  title: string;
  url: string;
};

export type CanonicalShareCapabilities = {
  copy?: (value: string) => Promise<void>;
  share?: (payload: CanonicalSharePayload) => Promise<void>;
};

export type CanonicalShareOutcome = "cancelled" | "copied" | "failed" | "shared";

export type MarkdownCitationCopyOutcome = "copied" | "failed";

export function createMarkdownCitation(
  payload: Pick<CanonicalSharePayload, "title" | "url">,
) {
  const label = payload.title.replace(
    /[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/gu,
    "\\$&",
  );

  return `[${label}](${payload.url})`;
}

export async function copyMarkdownCitation(
  payload: Pick<CanonicalSharePayload, "title" | "url">,
  capabilities: Pick<CanonicalShareCapabilities, "copy">,
): Promise<MarkdownCitationCopyOutcome> {
  if (!capabilities.copy) return "failed";

  try {
    await capabilities.copy(createMarkdownCitation(payload));
    return "copied";
  } catch {
    return "failed";
  }
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function shareCanonicalRecord(
  payload: CanonicalSharePayload,
  capabilities: CanonicalShareCapabilities,
): Promise<CanonicalShareOutcome> {
  if (capabilities.share) {
    try {
      await capabilities.share(payload);
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "cancelled";
    }
  }

  if (capabilities.copy) {
    try {
      await capabilities.copy(payload.url);
      return "copied";
    } catch {
      // The caller still exposes the canonical anchor as the recovery path.
    }
  }

  return "failed";
}
