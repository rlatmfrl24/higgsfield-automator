type CheckingScreenProps = {
  message?: string;
};

const DEFAULT_MESSAGE = "페이지 상태 확인 중...";

export const CheckingScreen = ({
  message = DEFAULT_MESSAGE,
}: CheckingScreenProps) => (
  <div className="flex flex-col items-center justify-center gap-4 h-screen w-screen bg-slate-50 text-slate-800 px-6 py-12">
    <h1 className="text-xl font-semibold">{message}</h1>
  </div>
);

export default CheckingScreen;
