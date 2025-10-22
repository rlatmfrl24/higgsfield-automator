import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  getDownloadQueueFromCursor,
  getFirstFeedJobId,
} from "../../../services/feed";
import { useLiveRegion } from "../../../hooks/useLiveRegion";
import { downloadJobImage } from "../../../services/downloads";

const baseButtonClasses =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClasses = `${baseButtonClasses} bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-200/60 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-600 active:to-emerald-600`;

const secondaryButtonClasses = `${baseButtonClasses} border border-emerald-200 bg-white text-emerald-600 shadow-sm shadow-emerald-100/60 hover:bg-emerald-50 active:bg-emerald-100`;

const inputClasses =
  "w-full rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm shadow-emerald-100/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

const listClasses =
  "grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-inner";

const queueItemButtonClasses =
  "rounded-lg px-3 py-1 text-xs font-semibold shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

const queueActionButtonClasses =
  "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-600 shadow-sm shadow-emerald-100/60 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

type JobDownloadState = "idle" | "pending" | "success" | "error";

const jobStateClasses: Record<JobDownloadState, string> = {
  idle: "bg-white text-emerald-700 hover:bg-emerald-100",
  pending:
    "bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100",
  success:
    "bg-emerald-200 text-emerald-900 border border-emerald-300 hover:bg-emerald-200",
  error: "bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-100",
};

const jobStateBadgeClasses: Record<JobDownloadState, string> = {
  idle: "",
  pending:
    "mt-0.5 inline-flex items-center rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700",
  success:
    "mt-0.5 inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white",
  error:
    "mt-0.5 inline-flex items-center rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white",
};

const jobStateLabels: Record<JobDownloadState, string> = {
  idle: "대기 중",
  pending: "다운로드 요청 중",
  success: "다운로드 요청 완료",
  error: "오류 · 다시 시도",
};

const jobStateTitles: Record<JobDownloadState, string> = {
  idle: "이미지 다운로드",
  pending: "이미지 다운로드가 진행 중입니다.",
  success: "이미지 다운로드를 요청했습니다.",
  error: "이미지 다운로드에 실패했습니다. 다시 시도하려면 클릭하세요.",
};

const statusStyles = {
  neutral:
    "rounded-xl border border-dashed border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 shadow-inner",
  success:
    "rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 shadow-inner",
  error:
    "rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 shadow-inner",
} as const;

type StatusState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; jobId: string; source: "auto" | "manual" }
  | { type: "error"; message: string };

type QueueStatus =
  | { type: "idle"; items: string[] }
  | { type: "loading"; items: string[] }
  | { type: "success"; items: string[] }
  | { type: "error"; items: string[]; message: string };

type DownloadState =
  | { type: "idle" }
  | { type: "loading"; jobId: string }
  | { type: "success"; jobId: string }
  | { type: "error"; jobId: string; message: string };

type BulkDownloadState =
  | { type: "idle" }
  | { type: "running"; currentJobId: string; completed: number; total: number }
  | { type: "success"; total: number; succeeded: number; failed: number }
  | {
      type: "error";
      total: number;
      succeeded: number;
      failed: number;
      message: string;
    };

type PerformDownloadResult =
  | { status: "success"; jobId: string }
  | { status: "error"; jobId: string; message: string }
  | { status: "skipped"; jobId: string };

type DownloadPanelProps = {
  panelId: string;
  labelledById: string;
  jobIdInput: string;
  onJobIdInputChange: (nextValue: string) => void;
  downloadCursor: string;
  onDownloadCursorChange: (nextValue: string) => void;
};

export const DownloadPanel = ({
  panelId,
  labelledById,
  jobIdInput,
  onJobIdInputChange,
  downloadCursor,
  onDownloadCursorChange,
}: DownloadPanelProps) => {
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    type: "idle",
    items: [],
  });
  const [downloadState, setDownloadState] = useState<DownloadState>({
    type: "idle",
  });
  const [jobDownloadStates, setJobDownloadStates] = useState<
    Record<string, JobDownloadState>
  >({});
  const [bulkDownloadState, setBulkDownloadState] = useState<BulkDownloadState>(
    {
      type: "idle",
    }
  );
  const announce = useLiveRegion();

  useEffect(() => {
    const trimmedCursor = downloadCursor.trim();

    if (!trimmedCursor) {
      setStatus((previous) => {
        if (previous.type === "idle") {
          return previous;
        }

        return { type: "idle" };
      });
      return;
    }

    setStatus((previous) => {
      if (previous.type === "loading") {
        return previous;
      }

      if (previous.type === "error") {
        return previous;
      }

      if (previous.type === "success" && previous.jobId === trimmedCursor) {
        return previous;
      }

      return { type: "success", jobId: trimmedCursor, source: "manual" };
    });
  }, [downloadCursor]);

  const cursorLabel = downloadCursor
    ? `현재 다운로드 커서: ${downloadCursor}`
    : "다운로드 커서가 설정되어 있지 않습니다.";

  const autoButtonLabel = useMemo(() => {
    switch (status.type) {
      case "loading":
        return "피드 확인 중...";
      default:
        return "피드의 첫 Job ID 가져오기";
    }
  }, [status.type]);

  const queueButtonLabel = useMemo(() => {
    switch (queueStatus.type) {
      case "loading":
        return "다운로드 큐 구성 중...";
      default:
        return "다운로드 큐 가져오기";
    }
  }, [queueStatus.type]);

  const statusMessage = useMemo(() => {
    switch (status.type) {
      case "idle":
        return "자동 다운로드 기능을 준비 중입니다. 다운로드 커서를 테스트로 설정할 수 있습니다.";
      case "loading":
        return "피드에서 Job ID를 검색하는 중입니다.";
      case "success":
        return status.source === "manual"
          ? `사용자가 입력한 다운로드 커서는 ${status.jobId} 입니다.`
          : `가장 앞에 있는 Job ID는 ${status.jobId} 입니다.`;
      case "error":
        return status.message;
      default:
        return "";
    }
  }, [status]);

  const statusVariant = useMemo(() => {
    if (status.type === "error") {
      return "error" as const;
    }

    if (status.type === "success") {
      return "success" as const;
    }

    return "neutral" as const;
  }, [status.type]);

  const downloadStatusVariant = useMemo(() => {
    if (downloadState.type === "error") {
      return "error" as const;
    }

    if (downloadState.type === "success") {
      return "success" as const;
    }

    return "neutral" as const;
  }, [downloadState.type]);

  const handleFetchClick = useCallback(async () => {
    setStatus({ type: "loading" });
    announce("피드에서 Job ID를 검색합니다.");

    try {
      const jobId = await getFirstFeedJobId();
      onJobIdInputChange(jobId);
      onDownloadCursorChange(jobId);
      setStatus({ type: "success", jobId, source: "auto" });
      announce(`피드의 첫 Job ID는 ${jobId} 입니다.`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Job ID를 가져오는 중 알 수 없는 오류가 발생했습니다.";
      setStatus({ type: "error", message });
      announce(`Job ID를 가져오지 못했습니다. ${message}`);
    }
  }, [announce, onDownloadCursorChange, onJobIdInputChange]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      onJobIdInputChange(nextValue);

      const trimmed = nextValue.trim();

      if (trimmed.length === 0) {
        setStatus({ type: "idle" });
        onDownloadCursorChange("");
        announce("입력된 다운로드 커서를 초기화했습니다.");
        return;
      }

      onDownloadCursorChange(trimmed);
      setStatus({ type: "success", jobId: trimmed, source: "manual" });
      announce(`사용자 지정 다운로드 커서를 ${trimmed}로 설정했습니다.`);
    },
    [announce, onDownloadCursorChange, onJobIdInputChange]
  );

  const handleQueueFetch = useCallback(async () => {
    const cursor = downloadCursor.trim();

    if (!cursor) {
      setQueueStatus((prev) => ({
        type: "error",
        items: prev.items,
        message: "다운로드 커서를 먼저 설정해주세요.",
      }));
      announce("다운로드 커서를 먼저 설정해주세요.");
      return;
    }

    setQueueStatus((prev) => ({ type: "loading", items: prev.items }));
    announce("다운로드 큐를 구성하는 중입니다.");

    try {
      const queue = await getDownloadQueueFromCursor(cursor);
      setQueueStatus({ type: "success", items: queue });
      setJobDownloadStates((previous) => {
        const next: Record<string, JobDownloadState> = {};
        queue.forEach((jobId) => {
          next[jobId] = previous[jobId] ?? "idle";
        });
        return next;
      });
      announce(
        `다운로드 큐를 ${queue.length}개의 아이템으로 구성했습니다. (커서 제외)`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "다운로드 큐를 구성하는 중 알 수 없는 오류가 발생했습니다.";
      setQueueStatus((prev) => ({ type: "error", items: prev.items, message }));
      announce(`다운로드 큐를 구성하지 못했습니다. ${message}`);
    }
  }, [announce, downloadCursor]);

  const performDownload = useCallback(
    async (jobId: string): Promise<PerformDownloadResult> => {
      const trimmedJobId = jobId.trim();

      if (!trimmedJobId) {
        return { status: "skipped", jobId };
      }

      try {
        await downloadJobImage(trimmedJobId);
        return { status: "success", jobId: trimmedJobId };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "이미지 다운로드 중 알 수 없는 오류가 발생했습니다.";
        return { status: "error", jobId: trimmedJobId, message };
      }
    },
    []
  );

  const handleDownload = useCallback(
    async (jobId: string) => {
      const trimmedJobId = jobId.trim();

      if (!trimmedJobId) {
        return;
      }

      setDownloadState({ type: "loading", jobId: trimmedJobId });
      setJobDownloadStates((previous) => ({
        ...previous,
        [trimmedJobId]: "pending",
      }));
      announce(`${trimmedJobId} 이미지 다운로드를 준비합니다.`);

      const result = await performDownload(trimmedJobId);

      if (result.status === "success") {
        setDownloadState({
          type: "success",
          jobId: trimmedJobId,
        });
        setJobDownloadStates((previous) => ({
          ...previous,
          [trimmedJobId]: "success",
        }));
        announce(`${trimmedJobId} 이미지 다운로드를 시작했습니다.`);
        return;
      }

      if (result.status === "error") {
        setDownloadState({
          type: "error",
          jobId: trimmedJobId,
          message: result.message,
        });
        setJobDownloadStates((previous) => ({
          ...previous,
          [trimmedJobId]: "error",
        }));
        announce(`이미지 다운로드에 실패했습니다. ${result.message}`);
        return;
      }

      setDownloadState({ type: "idle" });
      setJobDownloadStates((previous) => ({
        ...previous,
        [trimmedJobId]: "idle",
      }));
    },
    [announce, performDownload]
  );

  const handleBulkDownload = useCallback(async () => {
    if (bulkDownloadState.type === "running") {
      announce("이미 일괄 다운로드가 진행 중입니다.");
      return;
    }

    const queueItems = [...queueStatus.items];

    if (queueItems.length === 0) {
      const message =
        "다운로드 큐가 비어 있어 일괄 다운로드를 실행할 수 없습니다.";
      setBulkDownloadState({
        type: "error",
        total: 0,
        succeeded: 0,
        failed: 0,
        message,
      });
      announce(message);
      return;
    }

    const effectiveQueue = queueItems
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (effectiveQueue.length === 0) {
      const message = "다운로드할 유효한 Job ID가 큐에 없습니다.";
      setBulkDownloadState({
        type: "error",
        total: 0,
        succeeded: 0,
        failed: 0,
        message,
      });
      announce(message);
      return;
    }

    setBulkDownloadState({
      type: "running",
      currentJobId: "",
      completed: 0,
      total: effectiveQueue.length,
    });
    setDownloadState({ type: "idle" });
    announce("다운로드 큐 일괄 다운로드를 시작합니다.");

    let succeeded = 0;
    let failed = 0;
    const jobResults: PerformDownloadResult[] = [];

    for (const jobId of effectiveQueue) {
      setBulkDownloadState((previous) => {
        if (previous.type !== "running") {
          return previous;
        }

        return {
          ...previous,
          currentJobId: jobId,
        };
      });

      setJobDownloadStates((previous) => ({
        ...previous,
        [jobId]: "pending",
      }));

      const result = await performDownload(jobId);
      jobResults.push(result);

      if (result.status === "success") {
        succeeded += 1;
        setJobDownloadStates((previous) => ({
          ...previous,
          [jobId]: "success",
        }));
      } else if (result.status === "error") {
        failed += 1;
        setJobDownloadStates((previous) => ({
          ...previous,
          [jobId]: "error",
        }));
      } else {
        setJobDownloadStates((previous) => ({
          ...previous,
          [jobId]: "idle",
        }));
      }

      setBulkDownloadState((previous) => {
        if (previous.type !== "running") {
          return previous;
        }

        return {
          ...previous,
          completed: Math.min(previous.completed + 1, previous.total),
        };
      });
    }

    if (failed > 0) {
      const failedItems = jobResults.filter(
        (
          result
        ): result is Extract<PerformDownloadResult, { status: "error" }> =>
          result.status === "error"
      );
      const failedSummary = failedItems
        .map((item) => `${item.jobId}: ${item.message}`)
        .join("; ");
      const message =
        failedSummary.length > 0
          ? `총 ${effectiveQueue.length}개 중 ${failed}개 다운로드에 실패했습니다. (${failedSummary})`
          : `총 ${effectiveQueue.length}개 중 ${failed}개 다운로드에 실패했습니다.`;
      setBulkDownloadState({
        type: "error",
        total: effectiveQueue.length,
        succeeded,
        failed,
        message,
      });
      announce(message);
      return;
    }

    setBulkDownloadState({
      type: "success",
      total: effectiveQueue.length,
      succeeded,
      failed,
    });
    announce(`총 ${succeeded}개 항목의 다운로드를 요청했습니다.`);
  }, [announce, bulkDownloadState.type, performDownload, queueStatus.items]);

  const bulkButtonLabel = useMemo(() => {
    if (bulkDownloadState.type === "running") {
      return `모두 다운로드 (${bulkDownloadState.completed}/${bulkDownloadState.total})`;
    }

    return "모두 다운로드";
  }, [bulkDownloadState]);

  const bulkStatusVariant = useMemo(() => {
    if (bulkDownloadState.type === "error") {
      return "error" as const;
    }

    if (bulkDownloadState.type === "success") {
      return "success" as const;
    }

    return "neutral" as const;
  }, [bulkDownloadState.type]);

  const bulkDownloadStatusMessage = useMemo(() => {
    switch (bulkDownloadState.type) {
      case "idle":
        return "다운로드 큐 전체를 한 번에 다운로드할 수 있습니다.";
      case "running":
        return bulkDownloadState.currentJobId
          ? `일괄 다운로드 진행 중입니다. (${bulkDownloadState.completed}/${bulkDownloadState.total}) · 현재: ${bulkDownloadState.currentJobId}`
          : `일괄 다운로드 진행 중입니다. (${bulkDownloadState.completed}/${bulkDownloadState.total})`;
      case "success":
        return `일괄 다운로드를 완료했습니다. 총 ${bulkDownloadState.total}개 중 ${bulkDownloadState.succeeded}개 다운로드를 요청했습니다.`;
      case "error":
        return `일괄 다운로드 중 문제가 발생했습니다. ${bulkDownloadState.message} (성공 ${bulkDownloadState.succeeded}개)`;
      default:
        return "";
    }
  }, [bulkDownloadState]);

  const bulkDownloadStatusClassName = statusStyles[bulkStatusVariant];

  const downloadStatusMessage = useMemo(() => {
    switch (downloadState.type) {
      case "idle":
        return "다운로드 큐에서 항목을 클릭하면 해당 Job ID의 이미지를 다운로드합니다.";
      case "loading":
        return `${downloadState.jobId} 이미지 다운로드를 준비 중입니다...`;
      case "success":
        return `${downloadState.jobId} 이미지 다운로드를 시작했습니다.`;
      case "error":
        return `${downloadState.jobId} 이미지 다운로드에 실패했습니다. ${downloadState.message}`;
      default:
        return "";
    }
  }, [downloadState]);

  const statusClassName = statusStyles[statusVariant];
  const downloadStatusClassName = statusStyles[downloadStatusVariant];
  const inputId = `${panelId}-job-id-input`;
  const globalDownloadPending = downloadState.type === "loading";

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledById}
      className="space-y-6 p-8"
      aria-live="polite"
    >
      <div className="space-y-2">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-emerald-700"
        >
          다운로드 커서 직접 설정
        </label>
        <input
          id={inputId}
          type="text"
          value={jobIdInput}
          onChange={handleInputChange}
          className={inputClasses}
          placeholder="예: bcfd3a19-a8d7-48bb-9a80-4fc6722e279f"
          spellCheck={false}
        />
        <p className="text-xs text-emerald-600">{cursorLabel}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`${primaryButtonClasses} px-6 py-3 text-base`}
          onClick={handleFetchClick}
          disabled={status.type === "loading"}
          type="button"
        >
          {autoButtonLabel}
        </button>
        <button
          className={`${secondaryButtonClasses} px-6 py-3 text-base`}
          onClick={handleQueueFetch}
          disabled={queueStatus.type === "loading"}
          type="button"
        >
          {queueButtonLabel}
        </button>
      </div>

      <div className={statusClassName}>
        <p>{statusMessage}</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-emerald-700">
          <span className="font-semibold">다운로드 큐</span>
          <span>
            {queueStatus.items.length}개 아이템 · 상태: {queueStatus.type} ·
            커서 제외
          </span>
        </div>
        {queueStatus.type === "error" ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
            {queueStatus.message}
          </p>
        ) : null}
        {queueStatus.items.length > 0 ? (
          <div className={bulkDownloadStatusClassName}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-emerald-700">
                  일괄 다운로드
                </span>
                <span className="text-emerald-700">
                  {bulkDownloadStatusMessage}
                </span>
              </div>
              <button
                type="button"
                className={queueActionButtonClasses}
                onClick={handleBulkDownload}
                disabled={
                  bulkDownloadState.type === "running" ||
                  queueStatus.type === "loading" ||
                  queueStatus.items.length === 0
                }
              >
                {bulkButtonLabel}
              </button>
            </div>
          </div>
        ) : null}
        <div className={listClasses}>
          {queueStatus.items.length === 0 ? (
            <p className="text-xs text-emerald-600">
              다운로드 큐가 비어 있습니다.
            </p>
          ) : (
            queueStatus.items.map((jobId) => (
              <button
                key={jobId}
                type="button"
                className={`${queueItemButtonClasses} ${
                  jobStateClasses[jobDownloadStates[jobId] ?? "idle"]
                }`}
                onClick={() => handleDownload(jobId)}
                disabled={
                  globalDownloadPending ||
                  bulkDownloadState.type === "running" ||
                  (jobDownloadStates[jobId] ?? "idle") === "pending"
                }
                aria-busy={(jobDownloadStates[jobId] ?? "idle") === "pending"}
                title={jobStateTitles[jobDownloadStates[jobId] ?? "idle"]}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="font-semibold">{jobId}</span>
                  {jobDownloadStates[jobId] &&
                  jobDownloadStates[jobId] !== "idle" ? (
                    <span
                      className={
                        jobStateBadgeClasses[jobDownloadStates[jobId] ?? "idle"]
                      }
                    >
                      {jobStateLabels[jobDownloadStates[jobId] ?? "idle"]}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <div className={downloadStatusClassName}>
        <p>{downloadStatusMessage}</p>
      </div>
    </div>
  );
};

export default DownloadPanel;
