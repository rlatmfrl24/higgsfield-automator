import { useMemo } from "react";

export type MultiPromptTableProps = {
  entries: Array<{
    id: string;
    prompt: string;
    ratio: string;
    count: string;
  }>;
  selectOptions: Array<{ value: string; label: string }>;
  onChangePrompt: (id: string, value: string) => void;
  onChangeRatio: (id: string, value: string) => void;
  onChangeCount: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  disabledAdd: boolean;
};

export const MultiPromptTable = ({
  entries,
  selectOptions,
  onChangePrompt,
  onChangeRatio,
  onChangeCount,
  onRemove,
  onAdd,
  disabledAdd,
}: MultiPromptTableProps) => {
  const totalCount = useMemo(() => {
    return entries.reduce(
      (acc, entry) => acc + (parseInt(entry.count, 10) || 0),
      0
    );
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
            <span>총 실행 횟수</span>
            <span className="font-bold text-emerald-600">{totalCount}회</span>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-50"
          onClick={onAdd}
          disabled={disabledAdd}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          프롬프트 추가
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_100px_48px] items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-semibold text-slate-500 sm:grid md:grid-cols-[minmax(0,1fr)_140px_120px_56px]">
          <span>프롬프트</span>
          <span className="text-center">비율</span>
          <span className="text-center">생성 횟수</span>
          <span className="text-center">삭제</span>
        </div>

        <div className="divide-y divide-slate-100">
          {entries.map((entry, index) => (
            <div key={entry.id} className="flex gap-2 p-2">
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-xs font-semibold text-slate-500 sm:hidden">
                  프롬프트
                </span>
                <textarea
                  className="min-h-[100px] w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 md:min-h-[120px]"
                  placeholder={`프롬프트 ${index + 1} 입력...`}
                  value={entry.prompt}
                  onChange={(event) =>
                    onChangePrompt(entry.id, event.target.value)
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-1.5 sm:flex-none">
                  <span className="text-xs font-semibold text-slate-500 sm:hidden">
                    비율
                  </span>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={entry.ratio}
                      onChange={(event) =>
                        onChangeRatio(entry.id, event.target.value)
                      }
                    >
                      {selectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 sm:flex-none">
                  <span className="text-xs font-semibold text-slate-500 sm:hidden">
                    생성 횟수
                  </span>
                  <div className="relative">
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      type="number"
                      min={1}
                      max={99}
                      value={entry.count}
                      onChange={(event) =>
                        onChangeCount(entry.id, event.target.value)
                      }
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      회
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  onClick={() => onRemove(entry.id)}
                  disabled={entries.length <= 1}
                  aria-label={`프롬프트 ${index + 1} 삭제`}
                  title="삭제"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            필요한 만큼 프롬프트를 자유롭게 추가할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
