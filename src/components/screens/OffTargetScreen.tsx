type OffTargetScreenProps = {
  isBusy?: boolean;
  onNavigate: () => void;
};

export const OffTargetScreen = ({
  isBusy = false,
  onNavigate,
}: OffTargetScreenProps) => (
  <div className="flex flex-col items-center justify-center gap-6 h-screen w-screen bg-slate-50 text-slate-800 px-6 py-12">
    <h1 className="text-2xl font-bold text-center">
      Higgsfield Soul 페이지로 이동해야 합니다.
    </h1>
    <p className="text-center text-slate-600">
      익스텐션은 현재 페이지에서 활성화되지 않습니다. 아래 버튼을 눌러 요구되는
      페이지로 이동하세요.
    </p>
    <button
      className="rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold px-6 py-3 transition-colors disabled:bg-blue-300"
      onClick={onNavigate}
      disabled={isBusy}
    >
      페이지로 이동
    </button>
  </div>
);

export default OffTargetScreen;
