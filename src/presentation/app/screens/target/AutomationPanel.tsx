import { HighlightBadges } from "./HighlightBadges";

import type { MultiPromptEntry } from "./multiPrompt";
import { hasNonEmptyString, isPositiveIntegerString } from "./multiPrompt";

type AutomationStatusMeta = {
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
  totalCount: number;
  processedCount: number;
  progressPercent: number;
  currentPrompt: string | null;
  nextPrompt: string | null;
  nextRetryAt: string;
  status: string;
  maxCount?: number | null;
};

type AutomationPanelProps = {
  panelId: string;
  labelledById: string;
  figures: string[];
  datasetValues: Record<string, string>;
  isAutomationRunning: boolean;
  entries: MultiPromptEntry[];
  automationQueueLength: number;
  automationActiveCount: number;
  automationRemainingCount: number;
  automationLastError: string | null;
  automationStatusMeta: AutomationStatusMeta;
  automationActionMessage: string | null;
  automationActionError: string | null;
  automationError: string | null;
  isAutomationActionProcessing: boolean;
  onResumeAutomation: () => Promise<void>;
  onPauseAutomation: () => Promise<void>;
  onStopAutomation: () => Promise<void>;
  isFormDataReady?: boolean;
  onOpenStandalone?: () => void;
};

export const AutomationPanel = ({
  panelId,
  labelledById,
  figures,
  datasetValues,
  isAutomationRunning,
  entries,
  automationQueueLength,
  automationActiveCount,
  automationRemainingCount,
  automationLastError,
  automationStatusMeta,
  automationActionMessage,
  automationActionError,
  automationError,
  isAutomationActionProcessing,
  onResumeAutomation,
  onPauseAutomation,
  onStopAutomation,
  isFormDataReady = true,
  onOpenStandalone,
}: AutomationPanelProps) => {
  const baseButtonClasses =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";
  const automationActionButtonClasses = `${baseButtonClasses} border border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100 disabled:text-emerald-300 shadow-sm shadow-emerald-100/60`;
  const automationStopButtonClasses = `${baseButtonClasses} border border-rose-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50 active:bg-rose-100 disabled:text-rose-300`;

  const filledEntries = entries.filter((entry) =>
    hasNonEmptyString(entry.prompt)
  );
  const totalRequestedCount = filledEntries.reduce((total, entry) => {
    if (!isPositiveIntegerString(entry.count)) {
      return total;
    }

    return total + Number.parseInt(entry.count, 10);
  }, 0);
  const previewEntries = filledEntries.slice(0, 3);
  const remainingPreviewCount = filledEntries.length - previewEntries.length;

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledById}
      className="space-y-8 p-8"
      aria-live="polite"
    >
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr] xl:items-start">
        <section className="space-y-6">
          {!isFormDataReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              폼 데이터를 아직 읽지 않았습니다. 멀티 프롬프트는 미리 입력하고,
              필요할 때 "폼 데이터 화면 출력" 버튼으로 대상 정보를
              동기화하세요.
            </div>
          ) : null}

          <HighlightBadges figures={figures} datasetValues={datasetValues} />

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-md shadow-slate-200/60">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  멀티 프롬프트 요약
                </p>
                <p className="text-xs text-slate-500">
                  독립형 설정 화면에서 상세 편집이 가능합니다.
                </p>
              </div>
              <button
                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onOpenStandalone}
                type="button"
                disabled={!onOpenStandalone}
              >
                설정 열기
              </button>
            </div>

            {filledEntries.length ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-700">
                      등록된 프롬프트
                    </span>
                    <span>{filledEntries.length}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-700">
                      예약된 생성 횟수
                    </span>
                    <span>{totalRequestedCount}회</span>
                  </div>
                </div>

                <ul className="space-y-2 text-xs text-slate-600">
                  {previewEntries.map((entry, index) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <p className="line-clamp-2 font-medium text-slate-700">
                        {entry.prompt.trim() || `프롬프트 ${index + 1}`}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-emerald-600">
                          비율 {entry.ratio || "-"}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600">
                          {entry.count || "-"}회 생성
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {remainingPreviewCount > 0 ? (
                  <p className="text-xs text-slate-500">
                    + {remainingPreviewCount}개의 프롬프트가 더 등록되어 있습니다.
                  </p>
                ) : null}

                {isAutomationRunning ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    자동 생성 루프가 실행 중입니다. 수정은 루프 종료 후 가능하며,
                    설정 화면에서는 언제든지 내용을 검토할 수 있습니다.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                등록된 멀티 프롬프트가 없습니다. 설정 화면에서 프롬프트를 추가해 주세요.
              </p>
            )}
          </section>
        </section>

        <aside className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-md shadow-slate-200/50">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  자동화 개요
                </p>
                <p className="text-xs text-slate-500">
                  {automationStatusMeta.description}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${automationStatusMeta.badgeClass}`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${automationStatusMeta.dotClass}`}
                  aria-hidden="true"
                />
                {automationStatusMeta.label}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">상태 코드</span>
                <span>{automationStatusMeta.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">예약된 생성</span>
                <span>{automationQueueLength}개</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">진행 상황</span>
                <span>
                  {automationStatusMeta.processedCount}/
                  {automationStatusMeta.totalCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">
                  대기 중 아이템
                </span>
                <span>{automationActiveCount}개</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">
                  남은 프롬프트
                </span>
                <span>{automationRemainingCount}개</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">
                  다음 재시도 시각
                </span>
                <span>{automationStatusMeta.nextRetryAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">
                  다음 프롬프트
                </span>
                <span className="max-w-[12rem] truncate text-right">
                  {automationStatusMeta.nextPrompt ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">마지막 오류</span>
                <span className="max-w-[12rem] truncate text-right">
                  {automationLastError ?? "-"}
                </span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 transition-all"
                style={{ width: `${automationStatusMeta.progressPercent}%` }}
                aria-hidden="true"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <button
                className={`${automationActionButtonClasses} px-3 py-2 text-sm`}
                onClick={() => {
                  void onResumeAutomation();
                }}
                disabled={
                  automationStatusMeta.status !== "paused" ||
                  isAutomationActionProcessing
                }
                type="button"
              >
                재개
              </button>
              <button
                className={`${automationActionButtonClasses} px-3 py-2 text-sm`}
                onClick={() => {
                  void onPauseAutomation();
                }}
                disabled={
                  automationStatusMeta.status !== "running" ||
                  isAutomationActionProcessing
                }
                type="button"
              >
                일시중단
              </button>
              <button
                className={`${automationStopButtonClasses} px-3 py-2 text-sm`}
                onClick={() => {
                  void onStopAutomation();
                }}
                disabled={
                  automationStatusMeta.status === "idle" ||
                  isAutomationActionProcessing
                }
                type="button"
              >
                중단
              </button>
            </div>

            {automationActionMessage ? (
              <p className="text-sm font-medium text-emerald-600">
                {automationActionMessage}
              </p>
            ) : null}

            {automationActionError ? (
              <p className="text-sm font-medium text-rose-600">
                {automationActionError}
              </p>
            ) : automationError ? (
              <p className="text-sm font-medium text-rose-600">
                {automationError}
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default AutomationPanel;

