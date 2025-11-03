type OffTargetScreenProps = {
  isBusy?: boolean;
  onNavigate: () => void;
  onOpenMultiPrompt?: () => void;
  onOpenDownloadQueue?: () => void;
};

export const OffTargetScreen = ({
  isBusy = false,
  onNavigate,
  onOpenMultiPrompt,
  onOpenDownloadQueue,
}: OffTargetScreenProps) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 px-6 py-12">
    <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white px-8 py-12 text-slate-800 shadow-lg">
      <div className="space-y-6 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-slate-900">
            Higgsfield Soul 페이지로 이동해야 합니다.
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            익스텐션은 현재 페이지에서 활성화되지 않습니다. 아래 버튼을 눌러
            요구되는 페이지로 이동하세요.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            onClick={onNavigate}
            disabled={isBusy}
          >
            페이지로 이동
          </button>
          <button
            className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onOpenMultiPrompt}
            disabled={isBusy}
            type="button"
          >
            멀티 프롬프트 사전 설정
          </button>
          <button
            className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onOpenDownloadQueue}
            disabled={isBusy}
            type="button"
          >
            다운로드 큐 생성 화면
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default OffTargetScreen;
