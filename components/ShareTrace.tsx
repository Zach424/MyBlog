"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  shareCanonicalRecord,
  type CanonicalShareOutcome,
} from "@/lib/share";

type ShareState = "idle" | "working" | Exclude<CanonicalShareOutcome, "cancelled">;

const SHARE_RESET_DELAY = 3_200;

const SHARE_LABELS: Record<ShareState, string> = {
  idle: "SHARE / COPY",
  working: "WORKING",
  shared: "SHARED",
  copied: "COPIED",
  failed: "FAILED",
};

const SHARE_STATUS: Record<ShareState, string> = {
  idle: "",
  working: "正在打开系统分享或复制规范链接。",
  shared: "规范链接已交给系统分享。",
  copied: "规范链接已复制到剪贴板。",
  failed: "无法分享或复制，请使用旁边的规范链接。",
};

export function ShareTrace({
  text,
  title,
  url,
}: {
  text: string;
  title: string;
  url: string;
}) {
  const [shareState, setShareState] = useState<ShareState>("idle");
  const actionRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sectionRef = useRef<HTMLElement>(null);
  const statusId = useId();

  useEffect(() => {
    mountedRef.current = true;
    sectionRef.current?.setAttribute("data-share-enhanced", "true");
    actionRef.current?.removeAttribute("hidden");

    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function shareRecord() {
    if (busyRef.current) return;
    busyRef.current = true;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setShareState("working");

    let outcome: CanonicalShareOutcome = "failed";

    try {
      outcome = await shareCanonicalRecord(
        { text, title, url },
        {
          share:
            typeof navigator.share === "function"
              ? navigator.share.bind(navigator)
              : undefined,
          copy:
            typeof navigator.clipboard?.writeText === "function"
              ? navigator.clipboard.writeText.bind(navigator.clipboard)
              : undefined,
        },
      );
    } catch {
      outcome = "failed";
    } finally {
      busyRef.current = false;
    }

    if (!mountedRef.current) return;
    if (outcome === "cancelled") {
      setShareState("idle");
      return;
    }

    setShareState(outcome);
    resetTimerRef.current = setTimeout(() => setShareState("idle"), SHARE_RESET_DELAY);
  }

  return (
    <section
      aria-label="分享这条记录"
      className="content-share"
      data-share-enhanced="false"
      data-share-state={shareState}
      ref={sectionRef}
    >
      <div className="content-share-trace" aria-hidden="true">
        <span>Share trace</span>
        <strong>Canonical</strong>
      </div>
      <a
        aria-label={`“${title}”的规范链接`}
        className="content-share-source"
        href={url}
      >
        <span>Source</span>
        <code>{url}</code>
      </a>
      <div className="content-share-action" hidden ref={actionRef}>
        <button
          aria-describedby={statusId}
          aria-label={`分享或复制“${title}”的规范链接`}
          className="content-share-button"
          disabled={shareState === "working"}
          onClick={shareRecord}
          type="button"
        >
          {SHARE_LABELS[shareState]}
          <span aria-hidden="true">↗</span>
        </button>
        <span
          aria-atomic="true"
          aria-live="polite"
          className="content-share-status"
          id={statusId}
        >
          {SHARE_STATUS[shareState]}
        </span>
      </div>
    </section>
  );
}
