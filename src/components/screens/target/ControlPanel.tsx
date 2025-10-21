import { HighlightBadges } from "./HighlightBadges";
import { MultiPromptTable } from "./MultiPromptTable";
import { GenerationPanel } from "./GenerationPanel";

import type { MultiPromptEntry } from "./multiPrompt";

type SelectOption = { value: string; label: string };

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

type ControlPanelProps = {
  panelId: string;
  labelledById: string;
  figures: string[];
  datasetValues: Record<string, string>;
  isAutomationRunning: boolean;
  entries: MultiPromptEntry[];
  selectOptions: SelectOption[];
  onAddPrompt: () => void;
  onRemovePrompt: (id: string) => void;
  onChangePrompt: (id: string, value: string) => void;
  onChangeRatio: (id: string, value: string) => void;
  onChangeCount: (id: string, value: string) => void;
  canAddMore: boolean;
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
  highlightInfo: Parameters<typeof GenerationPanel>[0]["highlightInfo"];
  onPrepareGeneration: () => Promise<void>;
  preparationMessage: string | null;
  isConfirming: boolean;
  onConfirmGeneration: () => Promise<void>;
  onCancelGeneration: () => void;
  generationError: string | null;
};

export const ControlPanel = ({
  panelId,
  labelledById,
  figures,
  datasetValues,
  isAutomationRunning,
  entries,
  selectOptions,
  onAddPrompt,
  onRemovePrompt,
  onChangePrompt,
  onChangeRatio,
  onChangeCount,
  canAddMore,
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
  highlightInfo,
  onPrepareGeneration,
  preparationMessage,
  isConfirming,
  onConfirmGeneration,
  onCancelGeneration,
  generationError,
}: ControlPanelProps) => {
  const baseButtonClasses =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";
  const automationActionButtonClasses = `${baseButtonClasses} border border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100 disabled:text-emerald-300 shadow-sm shadow-emerald-100/60`;
  const automationStopButtonClasses = `${baseButtonClasses} border border-rose-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50 active:bg-rose-100 disabled:text-rose-300`;

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
          <HighlightBadges figures={figures} datasetValues={datasetValues} />

          {isAutomationRunning ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center text-sm text-emerald-700">
              자동 생성 루프가 실행 중입니다. 자동화가 종료되면 멀티 프롬프트
              입력 폼이 다시 표시됩니다.
            </div>
          ) : (
            <MultiPromptTable
              entries={entries}
              selectOptions={selectOptions}
              onChangePrompt={onChangePrompt}
              onChangeRatio={onChangeRatio}
              onChangeCount={onChangeCount}
              onRemove={onRemovePrompt}
              onAdd={onAddPrompt}
              disabledAdd={!canAddMore}
            />
          )}
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

          <GenerationPanel
            onPrepare={() => {
              void onPrepareGeneration();
            }}
            highlightInfo={highlightInfo}
            preparationMessage={preparationMessage}
            isConfirming={isConfirming}
            onConfirm={() => {
              void onConfirmGeneration();
            }}
            onCancel={onCancelGeneration}
            errorMessage={generationError}
          />
        </aside>
      </div>
    </div>
  );
};

export default ControlPanel;
