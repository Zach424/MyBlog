"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type CopyState = "idle" | "copied" | "failed";

const COPY_RESET_DELAY = 2_400;

const COPY_LABELS: Record<CopyState, string> = {
  idle: "COPY",
  copied: "COPIED",
  failed: "FAILED",
};

const COPY_STATUS: Record<CopyState, string> = {
  idle: "",
  copied: "代码已复制到剪贴板。",
  failed: "复制失败，请手动选择代码。",
};

export function CodeBlock({
  children,
  language,
}: {
  children: ReactNode;
  language: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusId = useId();

  useEffect(() => {
    buttonRef.current?.removeAttribute("hidden");

    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function copyCode() {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    try {
      const code = preRef.current?.querySelector("code")?.textContent;
      if (typeof code !== "string" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    resetTimerRef.current = setTimeout(() => setCopyState("idle"), COPY_RESET_DELAY);
  }

  return (
    <figure className="code-block" data-copy-state={copyState}>
      <figcaption className="code-block-rail">
        <span className="code-block-language">CODE / {language}</span>
        <button
          aria-describedby={statusId}
          aria-label={
            copyState === "idle"
              ? `复制 ${language} 代码`
              : COPY_STATUS[copyState]
          }
          className="code-copy-button"
          hidden
          onClick={copyCode}
          ref={buttonRef}
          type="button"
        >
          {COPY_LABELS[copyState]}
        </button>
      </figcaption>
      <pre ref={preRef}>{children}</pre>
      <span aria-live="polite" className="visually-hidden" id={statusId}>
        {COPY_STATUS[copyState]}
      </span>
    </figure>
  );
}
