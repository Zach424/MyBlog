import { spawnSync } from "node:child_process";
import {
  CONTENT_DELIVERY_LOCAL_REF,
  CONTENT_DELIVERY_TRACKING_REF,
} from "../lib/content/delivery-triage.ts";

function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 2_000_000,
    shell: false,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} 失败，退出码 ${result.status}`);
  }
  return result;
}

export function readContentDeliveryGitSnapshot(cwd = process.cwd()) {
  const local = git(cwd, ["rev-parse", "--verify", CONTENT_DELIVERY_LOCAL_REF], {
    allowFailure: true,
  });
  if (local.status !== 0) {
    throw new Error("找不到本地 main；无法检查 Git 交付状态");
  }
  const localHead = local.stdout.trim();
  const branchValue = git(cwd, ["branch", "--show-current"]).stdout.trim();
  const currentBranch = branchValue || null;
  const tracking = git(
    cwd,
    ["rev-parse", "--verify", CONTENT_DELIVERY_TRACKING_REF],
    { allowFailure: true },
  );
  if (tracking.status !== 0) {
    return {
      ahead: null,
      behind: null,
      currentBranch,
      localHead,
      trackingHead: null,
    };
  }

  const trackingHead = tracking.stdout.trim();
  const counts = git(cwd, [
    "rev-list",
    "--left-right",
    "--count",
    `${CONTENT_DELIVERY_TRACKING_REF}...${CONTENT_DELIVERY_LOCAL_REF}`,
  ]).stdout.trim().split(/\s+/u).map(Number);
  if (
    counts.length !== 2 ||
    counts.some((value) => !Number.isInteger(value) || value < 0)
  ) {
    throw new Error("无法解析 main 与 origin/main tracking ref 的提交关系");
  }
  const [behind, ahead] = counts;
  return { ahead, behind, currentBranch, localHead, trackingHead };
}
