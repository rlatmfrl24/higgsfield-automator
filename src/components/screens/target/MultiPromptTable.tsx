type MultiPromptTableProps = {
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
}: MultiPromptTableProps) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-700">
        멀티 프롬프트 입력
      </h2>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
        onClick={onAdd}
        disabled={disabledAdd}
      >
        <span className="text-base leading-none">＋</span>
        프롬프트 추가
      </button>
    </div>

    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_92px_92px_36px] items-center gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
        <span>프롬프트</span>
        <span className="text-center">비율</span>
        <span className="text-center">생성 횟수</span>
        <span className="text-center">&nbsp;</span>
      </div>

      <div className="divide-y divide-slate-200">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="grid grid-cols-[minmax(0,1fr)_92px_92px_36px] items-start gap-3 px-4 py-3"
          >
            <textarea
              className="min-h-[140px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={`프롬프트 ${index + 1}`}
              value={entry.prompt}
              onChange={(event) => onChangePrompt(entry.id, event.target.value)}
            />
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={entry.ratio}
              onChange={(event) => onChangeRatio(entry.id, event.target.value)}
            >
              {selectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              type="number"
              min={1}
              max={99}
              value={entry.count}
              onChange={(event) => onChangeCount(entry.id, event.target.value)}
            />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
              onClick={() => onRemove(entry.id)}
              disabled={entries.length <= 1}
              aria-label={`프롬프트 ${index + 1} 삭제`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <p className="text-xs text-slate-500">
          최소 1개, 최대 6개의 프롬프트를 설정할 수 있습니다.
        </p>
      </div>
    </div>
  </div>
);
