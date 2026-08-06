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
