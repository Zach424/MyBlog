"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  copyMarkdownCitation,
  shareCanonicalRecord,
  type CanonicalShareOutcome,
  type MarkdownCitationCopyOutcome,
} from "@/lib/share";

type ShareFeedback =
  | { action: "none"; phase: "idle" }
  | {
      action: "share";
      phase: "working" | Exclude<CanonicalShareOutcome, "cancelled">;
    }
  | {
      action: "citation";
      phase: "working" | MarkdownCitationCopyOutcome;
    };
type ShareActionPhase = Extract<ShareFeedback, { action: "share" }>["phase"];
type CitationActionPhase = Extract<
  ShareFeedback,
  { action: "citation" }
>["phase"];

const SHARE_RESET_DELAY = 3_200;
const IDLE_FEEDBACK = { action: "none", phase: "idle" } as const;

const SHARE_LABELS: Record<ShareActionPhase, string> = {
  working: "WORKING",
  shared: "SHARED",
  copied: "URL COPIED",
  failed: "FAILED",
};

const CITATION_LABELS: Record<CitationActionPhase, string> = {
  working: "WORKING",
  copied: "MD COPIED",
  failed: "FAILED",
};

function feedbackStatus(feedback: ShareFeedback) {
  if (feedback.action === "none") return "";

  if (feedback.action === "citation") {
    if (feedback.phase === "working") return "正在复制 Markdown 引用。";
    if (feedback.phase === "copied") return "Markdown 引用已复制到剪贴板。";
    return "无法复制 Markdown；请复制旁边链接并在笔记中加入标题。";
  }

  if (feedback.phase === "working") return "正在打开系统分享或复制规范链接。";
  if (feedback.phase === "shared") return "规范链接已交给系统分享。";
  if (feedback.phase === "copied") return "规范链接已复制到剪贴板。";
  return "无法分享或复制，请使用旁边的规范链接。";
}

export function ShareTrace({
  text,
  title,
  url,
}: {
  text: string;
  title: string;
  url: string;
}) {
  const [shareFeedback, setShareFeedback] =
    useState<ShareFeedback>(IDLE_FEEDBACK);
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

  function clipboardCapability() {
    return typeof navigator.clipboard?.writeText === "function"
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : undefined;
  }

  function beginAction(action: "share" | "citation") {
    if (busyRef.current) return false;
    busyRef.current = true;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setShareFeedback({ action, phase: "working" });
    return true;
  }

  function scheduleReset() {
    resetTimerRef.current = setTimeout(
      () => setShareFeedback(IDLE_FEEDBACK),
      SHARE_RESET_DELAY,
    );
  }

  async function shareRecord() {
    if (!beginAction("share")) return;

    let outcome: CanonicalShareOutcome = "failed";

    try {
      outcome = await shareCanonicalRecord(
        { text, title, url },
        {
          share:
            typeof navigator.share === "function"
              ? navigator.share.bind(navigator)
              : undefined,
          copy: clipboardCapability(),
        },
      );
    } catch {
      outcome = "failed";
    } finally {
      busyRef.current = false;
    }

    if (!mountedRef.current) return;
    if (outcome === "cancelled") {
      setShareFeedback(IDLE_FEEDBACK);
      return;
    }

    setShareFeedback({ action: "share", phase: outcome });
    scheduleReset();
  }

  async function copyCitation() {
    if (!beginAction("citation")) return;

    let outcome: MarkdownCitationCopyOutcome = "failed";

    try {
      outcome = await copyMarkdownCitation(
        { title, url },
        { copy: clipboardCapability() },
      );
    } catch {
      outcome = "failed";
    } finally {
      busyRef.current = false;
    }

    if (!mountedRef.current) return;
    setShareFeedback({ action: "citation", phase: outcome });
    scheduleReset();
  }

  const isWorking = shareFeedback.phase === "working";
  const shareButtonLabel =
    shareFeedback.action === "share"
      ? SHARE_LABELS[shareFeedback.phase]
      : "SHARE / COPY";
  const citationButtonLabel =
    shareFeedback.action === "citation"
      ? CITATION_LABELS[shareFeedback.phase]
      : "COPY MD";

  return (
    <section
      aria-label="分享这条记录"
      className="content-share"
      data-action={shareFeedback.action}
      data-share-enhanced="false"
      data-state={shareFeedback.phase}
      ref={sectionRef}
    >
      <div className="share-trace" aria-hidden="true">
        <span>Share trace</span>
        <strong>Canonical</strong>
      </div>
      <a
        aria-label={`“${title}”的规范链接`}
        className="share-url"
        href={url}
      >
        <span>Source</span>
        <code>{url}</code>
      </a>
      <div className="share-ops" hidden ref={actionRef}>
        <button
          aria-describedby={statusId}
          aria-label="分享或复制规范链接"
          className="share-button share-button-main"
          disabled={isWorking}
          onClick={shareRecord}
        type="button"
      >
        {shareButtonLabel}
      </button>
        <button
          aria-describedby={statusId}
          aria-label="复制 Markdown 引用"
          className="share-button share-button-md"
          disabled={isWorking}
          onClick={copyCitation}
          type="button"
        >
          {citationButtonLabel}
        </button>
        <span
          aria-atomic="true"
          aria-live="polite"
          className="share-status"
          id={statusId}
        >
          {feedbackStatus(shareFeedback)}
        </span>
      </div>
    </section>
  );
}
