import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  type KeyboardEvent,
} from "react";

import type { FormSnapshotPayload } from "../../services/formSnapshot";
import { updateActiveTabFieldValue } from "../../services/formControl";
import { useLiveRegion } from "../../hooks/useLiveRegion";
import { ControlPanel } from "./target/ControlPanel";
import { useAutomationState } from "../../hooks/useAutomationState";
import {
  deriveFormData,
  extractHighlightFromText,
  isBasicQualitySelection,
} from "./target/formData";
import {
  buildSuccessAnnouncement,
  SUCCESS_PREPARATION_MESSAGE,
} from "./target/messages";
import {
  createMultiPromptEntry,
  hasNonEmptyString,
  isPositiveIntegerString,
} from "./target/multiPrompt";
import { useMultiPromptState } from "./target/useMultiPromptState";
import {
  validateMultiPromptEntries,
  validatePreparation,
} from "./target/validation";
import { DownloadPanel } from "./target/DownloadPanel";

type TargetScreenProps = {
  isReadingForm: boolean;
  formReadError: string | null;
  formPayload: FormSnapshotPayload | null;
  onReadForm: () => void;
};

export const TargetScreen = ({
  isReadingForm,
  formReadError,
  formPayload,
  onReadForm,
}: TargetScreenProps) => {
  const announce = useLiveRegion();
  const derived = useMemo(() => deriveFormData(formPayload), [formPayload]);

  const {
    setRatioValue,
    entries,
    setEntries,
    selectOptions,
    addEntry,
    removeEntry,
    updateEntry,
    canAddMore,
  } = useMultiPromptState(derived?.ratio);

  useEffect(() => {
    if (!derived) {
      return;
    }

    if (entries.length === 0) {
      const initialCount = Math.max(2, entries.length);
      const nextEntries = Array.from({ length: initialCount }).map(() =>
        createMultiPromptEntry(derived.ratio?.value ?? "")
      );
      setEntries(nextEntries);
    }
  }, [derived, entries.length, setEntries]);

  const [isConfirming, setIsConfirming] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [preparationMessage, setPreparationMessage] = useState<string | null>(
    null
  );
  const [automationActionMessage, setAutomationActionMessage] = useState<
    string | null
  >(null);
  const [automationActionError, setAutomationActionError] = useState<
    string | null
  >(null);
  const [isAutomationActionProcessing, setIsAutomationActionProcessing] =
    useState(false);
  const [activeTab, setActiveTab] = useState<"control" | "download">("control");
  const [downloadJobIdInput, setDownloadJobIdInput] = useState("");
  const [downloadCursor, setDownloadCursor] = useState("");

  const {
    state: automationState,
    error: automationError,
    start: startAutomationLoop,
    pause: pauseAutomationLoop,
    resume: resumeAutomationLoop,
    stop: stopAutomationLoop,
    isLoading: isAutomationLoading,
    refresh: refreshAutomationState,
  } = useAutomationState();

  useEffect(() => {
    setAutomationActionMessage(null);
    setAutomationActionError(null);
  }, [
    automationState.status,
    automationState.processedCount,
    automationState.nextRetryAt,
  ]);

  const automationQueue = useMemo(() => {
    return entries
      .filter((entry) => hasNonEmptyString(entry.prompt))
      .flatMap((entry) => {
        const countValue = isPositiveIntegerString(entry.count)
          ? Number.parseInt(entry.count, 10)
          : 0;

        if (countValue <= 0) {
          return [];
        }

        return Array.from({ length: countValue }).map(() => ({
          prompt: entry.prompt.trim(),
          ratio: entry.ratio?.trim() || null,
        }));
      });
  }, [entries]);

  const buildAutomationPayload = useCallback(() => {
    return {
      queue: automationQueue,
      promptFieldIndex: derived?.prompt?.fieldIndex ?? -1,
      ratioFieldIndex: derived?.ratio?.fieldIndex ?? null,
    };
  }, [
    automationQueue,
    derived?.prompt?.fieldIndex,
    derived?.ratio?.fieldIndex,
  ]);

  const highlightInfo = useMemo(() => {
    if (!derived) {
      return null;
    }

    for (const text of derived.figures) {
      const result = extractHighlightFromText(text);
      if (result) {
        return result;
      }
    }

    return null;
  }, [derived]);

  const resetMessages = useCallback(() => {
    setPreparationMessage(null);
    setGenerationError(null);
    setIsConfirming(false);
  }, []);

  const handleSelectTab = useCallback(
    (tab: "control" | "download") => {
      setActiveTab(tab);
      resetMessages();
    },
    [resetMessages]
  );

  const failPreparation = useCallback(
    (message: string) => {
      setGenerationError(message);
      setPreparationMessage(null);
      setIsConfirming(false);
      announce(message);
    },
    [announce]
  );

  const handleRequestGeneration = useCallback(async () => {
    setGenerationError(null);
    setPreparationMessage(null);
    setIsConfirming(false);

    const baseValidation = validatePreparation({ derived, entries });

    if (!baseValidation.ok) {
      failPreparation(baseValidation.message ?? "폼 검증에 실패했습니다.");
      return;
    }

    if (!derived?.quality || !isBasicQualitySelection(derived.quality)) {
      failPreparation("퀄리티 옵션이 Basic으로 설정되어야 합니다.");
      return;
    }

    const entryValidation = validateMultiPromptEntries(entries);

    if (!entryValidation.ok) {
      failPreparation(
        entryValidation.message ?? "멀티 프롬프트 검증에 실패했습니다."
      );
      return;
    }

    const [firstPrompt, ...rest] = entries;
    const { prompt, ratio } = derived;

    try {
      if (
        prompt &&
        typeof prompt.fieldIndex === "number" &&
        prompt.fieldIndex >= 0 &&
        hasNonEmptyString(firstPrompt.prompt)
      ) {
        await updateActiveTabFieldValue({
          fieldIndex: prompt.fieldIndex,
          value: firstPrompt.prompt,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "프롬프트 입력에 실패했습니다.";
      failPreparation(message);
      return;
    }

    try {
      if (
        ratio &&
        typeof ratio.fieldIndex === "number" &&
        ratio.fieldIndex >= 0 &&
        hasNonEmptyString(firstPrompt.ratio)
      ) {
        await updateActiveTabFieldValue({
          fieldIndex: ratio.fieldIndex,
          value: firstPrompt.ratio,
        });
        setRatioValue(firstPrompt.ratio);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "비율 입력에 실패했습니다.";
      failPreparation(message);
      return;
    }

    if (!derived?.prompt?.value || !hasNonEmptyString(derived.prompt.value)) {
      setEntries((prev) => {
        const normalised = prev.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                prompt: entry.prompt || firstPrompt.prompt,
                ratio: entry.ratio || firstPrompt.ratio,
              }
            : entry
        );

        return normalised;
      });
    } else {
      setEntries([firstPrompt, ...rest]);
    }

    setPreparationMessage(SUCCESS_PREPARATION_MESSAGE);
    announce(buildSuccessAnnouncement(highlightInfo));
    setIsConfirming(true);
  }, [
    announce,
    derived,
    entries,
    failPreparation,
    highlightInfo,
    setEntries,
    setRatioValue,
  ]);

  const runAutomationAction = useCallback(
    async (action: () => Promise<void>, successMessage: string) => {
      try {
        setIsAutomationActionProcessing(true);
        setAutomationActionError(null);
        await action();
        setAutomationActionMessage(successMessage);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "요청을 처리하는 중 오류가 발생했습니다.";
        setAutomationActionError(message);
      } finally {
        setIsAutomationActionProcessing(false);
      }
    },
    []
  );

  const handleResumeAutomation = useCallback(() => {
    return runAutomationAction(
      resumeAutomationLoop,
      "자동 생성 루프를 재개했습니다."
    );
  }, [resumeAutomationLoop, runAutomationAction]);

  const handlePauseAutomation = useCallback(() => {
    return runAutomationAction(
      pauseAutomationLoop,
      "자동 생성 루프를 일시중단했습니다."
    );
  }, [pauseAutomationLoop, runAutomationAction]);

  const handleStopAutomation = useCallback(() => {
    return runAutomationAction(
      stopAutomationLoop,
      "자동 생성 루프를 종료했습니다."
    );
  }, [runAutomationAction, stopAutomationLoop]);

  const handleCancelGeneration = useCallback(() => {
    setIsConfirming(false);
  }, []);

  const handleConfirmGeneration = useCallback(async () => {
    try {
      const payload = buildAutomationPayload();

      if (!payload.queue.length) {
        throw new Error("자동화할 프롬프트가 없습니다.");
      }

      setIsConfirming(false);
      await startAutomationLoop(payload);
      setPreparationMessage(
        `자동 생성 루프를 시작했습니다. 총 ${payload.queue.length}회의 생성이 예약되었습니다.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "자동화 시작 중 오류가 발생했습니다.";
      failPreparation(message);
    }
  }, [buildAutomationPayload, failPreparation, startAutomationLoop]);

  const handleAddPrompt = useCallback(() => {
    resetMessages();
    addEntry();
  }, [addEntry, resetMessages]);

  const handleRemovePrompt = useCallback(
    (id: string) => {
      resetMessages();
      removeEntry(id);
    },
    [removeEntry, resetMessages]
  );

  const handleChangePrompt = useCallback(
    (id: string, value: string) => {
      resetMessages();
      updateEntry(id, { prompt: value });
    },
    [resetMessages, updateEntry]
  );

  const handleChangeRatio = useCallback(
    (id: string, value: string) => {
      resetMessages();
      updateEntry(id, { ratio: value });
    },
    [resetMessages, updateEntry]
  );

  const handleChangeCount = useCallback(
    (id: string, value: string) => {
      resetMessages();
      updateEntry(id, { count: value });
    },
    [resetMessages, updateEntry]
  );

  const formatTimeLabel = useCallback((timestamp: number | null) => {
    if (!timestamp) {
      return "-";
    }

    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (error) {
      console.warn("Failed to format time", error);
      return "-";
    }
  }, []);

  const automationStatusMeta = useMemo(() => {
    const status = automationState.status;
    const statusMap: Record<
      typeof status,
      {
        label: string;
        description: string;
        badgeClass: string;
        dotClass: string;
      }
    > = {
      running: {
        label: "진행 중",
        description: "자동 생성 루프가 실행되고 있습니다.",
        badgeClass: "bg-emerald-100 text-emerald-700",
        dotClass: "bg-emerald-500",
      },
      paused: {
        label: "일시중단",
        description: "자동 생성 루프가 일시중단 상태입니다.",
        badgeClass: "bg-amber-100 text-amber-700",
        dotClass: "bg-amber-500",
      },
      idle: {
        label: "대기 중",
        description: "자동화를 시작하면 상태가 갱신됩니다.",
        badgeClass: "bg-slate-200 text-slate-700",
        dotClass: "bg-slate-500",
      },
    };

    const meta = statusMap[status];
    const totalCount = automationState.maxCount || automationQueue.length;
    const processedCount = automationState.processedCount;
    const progressPercent = totalCount
      ? Math.min(100, Math.round((processedCount / totalCount) * 100))
      : 0;

    const stateQueue = automationState.queue ?? [];
    const hasStateQueue = stateQueue.length > 0;
    const stateCurrentPrompt =
      hasStateQueue &&
      automationState.cursor >= 0 &&
      automationState.cursor < stateQueue.length
        ? stateQueue[automationState.cursor]?.prompt ?? null
        : null;
    const stateNextPrompt =
      hasStateQueue && automationState.cursor + 1 < stateQueue.length
        ? stateQueue[automationState.cursor + 1]?.prompt ?? null
        : null;

    const plannedCurrentPrompt = automationQueue[0]?.prompt ?? null;
    const plannedNextPrompt =
      automationQueue.length > 1 ? automationQueue[1]?.prompt ?? null : null;

    const currentPrompt =
      status === "idle"
        ? plannedCurrentPrompt
        : stateCurrentPrompt ?? plannedCurrentPrompt;
    const nextPrompt =
      status === "idle"
        ? plannedNextPrompt
        : stateNextPrompt ?? plannedNextPrompt;

    return {
      ...meta,
      totalCount,
      processedCount,
      progressPercent,
      currentPrompt,
      nextPrompt,
      nextRetryAt: formatTimeLabel(automationState.nextRetryAt),
      status,
      maxCount: automationState.maxCount,
    };
  }, [
    automationQueue,
    automationState.cursor,
    automationState.maxCount,
    automationState.nextRetryAt,
    automationState.processedCount,
    automationState.queue,
    automationState.status,
    formatTimeLabel,
  ]);

  const automationRemainingCount = Math.max(
    (automationStatusMeta.maxCount ?? automationQueue.length) -
      automationStatusMeta.processedCount,
    0
  );

  const handleRefreshAutomation = useCallback(() => {
    void refreshAutomationState();
  }, [refreshAutomationState]);

  const isAutomationRunning = automationState.status === "running";

  const baseButtonClasses =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";
  const primaryButtonClasses = `${baseButtonClasses} bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-200/60 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-600 active:to-emerald-600`;
  const secondaryButtonClasses = `${baseButtonClasses} border border-emerald-200 bg-white text-emerald-600 shadow-sm shadow-emerald-100/60 hover:bg-emerald-50 active:bg-emerald-100`;
  const tabItemBaseClasses =
    "relative flex cursor-pointer select-none items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-emerald-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500";
  const tabItemActiveClasses =
    "bg-white text-emerald-700 shadow-md shadow-emerald-200/60 after:absolute after:-bottom-3 after:left-1/2 after:h-1 after:w-8 after:-translate-x-1/2 after:rounded-full after:bg-emerald-500";
  const tabItemInactiveClasses = "hover:text-emerald-600 hover:bg-white/40";
  const controlTabId = "target-screen-tab-control";
  const downloadTabId = "target-screen-tab-download";
  const controlPanelId = "target-screen-panel-control";
  const downloadPanelId = "target-screen-panel-download";
  const tabs = [
    {
      value: "control" as const,
      label: "폼 제어 패널",
      tabId: controlTabId,
      panelId: controlPanelId,
    },
    {
      value: "download" as const,
      label: "자동 다운로드 패널",
      tabId: downloadTabId,
      panelId: downloadPanelId,
    },
  ];

  const handleTabKeyDown = useCallback(
    (tab: "control" | "download", event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSelectTab(tab);
      }
    },
    [handleSelectTab]
  );

  return (
    <div className="flex min-h-screen w-full justify-center bg-slate-50 px-4 py-10 text-slate-800 sm:px-6">
      <div className="flex w-full max-w-6xl flex-col gap-8">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-8 py-6 text-center shadow-md">
          <h1 className="text-3xl font-bold text-emerald-700">
            타겟 페이지에 도달했습니다!
          </h1>
          <p className="mt-2 text-sm text-emerald-600">
            현재 Higgsfield Soul 페이지에 있으므로 익스텐션 기능을 곧바로 실행할
            수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className={`${primaryButtonClasses} px-6 py-3 text-base`}
            onClick={onReadForm}
            disabled={isReadingForm}
            type="button"
          >
            {isReadingForm ? "폼 데이터 읽는 중..." : "폼 데이터 화면 출력"}
          </button>
          <button
            className={`${secondaryButtonClasses} px-5 py-3 text-sm`}
            onClick={handleRefreshAutomation}
            disabled={isAutomationLoading}
            type="button"
          >
            {isAutomationLoading
              ? "자동화 상태 동기화 중..."
              : "자동화 상태 새로고침"}
          </button>
        </div>

        {formReadError ? (
          <p className="text-sm font-semibold text-rose-600">{formReadError}</p>
        ) : null}

        {derived ? (
          <div className="w-full">
            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
              <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-6 pt-5">
                <div
                  role="tablist"
                  aria-label="타겟 화면 내비게이션"
                  className="relative flex gap-3 rounded-t-2xl bg-emerald-100/40 p-2"
                >
                  {tabs.map(({ value, label, tabId, panelId }) => {
                    const isActive = activeTab === value;
                    return (
                      <div
                        key={value}
                        id={tabId}
                        role="tab"
                        tabIndex={isActive ? 0 : -1}
                        aria-selected={isActive}
                        aria-controls={panelId}
                        className={`${tabItemBaseClasses} ${
                          isActive
                            ? tabItemActiveClasses
                            : tabItemInactiveClasses
                        }`}
                        onClick={() => handleSelectTab(value)}
                        onKeyDown={(event) => handleTabKeyDown(value, event)}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeTab === "control" ? (
                <ControlPanel
                  panelId={controlPanelId}
                  labelledById={controlTabId}
                  figures={derived.figures}
                  datasetValues={derived.datasetValues}
                  isAutomationRunning={isAutomationRunning}
                  entries={entries}
                  selectOptions={selectOptions}
                  onAddPrompt={handleAddPrompt}
                  onRemovePrompt={handleRemovePrompt}
                  onChangePrompt={handleChangePrompt}
                  onChangeRatio={handleChangeRatio}
                  onChangeCount={handleChangeCount}
                  canAddMore={canAddMore}
                  automationQueueLength={automationQueue.length}
                  automationActiveCount={automationState.activeCount}
                  automationRemainingCount={automationRemainingCount}
                  automationLastError={automationState.lastError ?? null}
                  automationStatusMeta={automationStatusMeta}
                  automationActionMessage={automationActionMessage}
                  automationActionError={automationActionError}
                  automationError={automationError}
                  isAutomationActionProcessing={isAutomationActionProcessing}
                  onResumeAutomation={handleResumeAutomation}
                  onPauseAutomation={handlePauseAutomation}
                  onStopAutomation={handleStopAutomation}
                  highlightInfo={highlightInfo}
                  onPrepareGeneration={handleRequestGeneration}
                  preparationMessage={preparationMessage}
                  isConfirming={isConfirming}
                  onConfirmGeneration={handleConfirmGeneration}
                  onCancelGeneration={handleCancelGeneration}
                  generationError={generationError}
                />
              ) : (
                <DownloadPanel
                  panelId={downloadPanelId}
                  labelledById={downloadTabId}
                  jobIdInput={downloadJobIdInput}
                  onJobIdInputChange={setDownloadJobIdInput}
                  downloadCursor={downloadCursor}
                  onDownloadCursorChange={setDownloadCursor}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TargetScreen;
