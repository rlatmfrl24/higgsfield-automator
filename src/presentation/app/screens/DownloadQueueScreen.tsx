import { DownloadQueueBuilder } from "./target/DownloadQueueBuilder";

type DownloadQueueScreenProps = {
  onBack: () => void;
  onNavigateToTarget?: () => void;
};

export const DownloadQueueScreen = ({
  onBack,
  onNavigateToTarget,
}: DownloadQueueScreenProps) => {
  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 sm:gap-10 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[96rem]">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-6 py-5 shadow lg:px-8 lg:py-6">
          <div className="space-y-1 lg:space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
              Download Queue Planner
            </p>
            <h1 className="text-2xl font-bold text-emerald-700 sm:text-3xl">
              다운로드 큐 생성 도우미
            </h1>
            <p className="text-sm text-emerald-600 sm:text-base">
              피드를 탐색하여 원하는 개수만큼 아이템을 추출하고, 다운로드 큐를 준비하세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:px-5"
              onClick={onBack}
              type="button"
            >
              돌아가기
            </button>
            {onNavigateToTarget ? (
              <button
                className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 sm:px-5"
                onClick={onNavigateToTarget}
                type="button"
              >
                타겟 페이지로 이동
              </button>
            ) : null}
          </div>
        </header>

        <DownloadQueueBuilder className="border border-white" />
      </div>
    </div>
  );
};

export default DownloadQueueScreen;


