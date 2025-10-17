import type { FormSnapshotPayload } from "../../services/formSnapshot";

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
}: TargetScreenProps) => (
  <div className="flex flex-col items-center justify-center gap-4 h-screen w-screen bg-slate-50 text-slate-800 px-6 py-12">
    <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-green-700">
        타겟 페이지에 도달했습니다!
      </h1>
      <p className="mt-2 text-sm text-green-600">
        현재 Higgsfield Soul 페이지에 있으므로 익스텐션 기능을 사용할 수
        있습니다.
      </p>
    </div>

    <button
      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold px-6 py-3 transition-colors disabled:bg-emerald-300"
      onClick={onReadForm}
      disabled={isReadingForm}
    >
      {isReadingForm ? "폼 데이터 읽는 중..." : "폼 데이터 화면 출력"}
    </button>

    {formReadError ? (
      <p className="text-sm text-red-600">{formReadError}</p>
    ) : null}

    {formPayload ? (
      <div className="w-full max-w-2xl mt-4">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-left text-sm font-semibold text-slate-700">
            폼 스냅샷
          </div>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-slate-700">값</h2>
            <div className="mt-2 rounded bg-slate-900 text-slate-100 text-xs">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono">
                {JSON.stringify(formPayload.values, null, 2)}
              </pre>
            </div>

            <h2 className="mt-4 text-sm font-semibold text-slate-700">필드</h2>
            <div className="mt-2 rounded bg-slate-900 text-slate-100 text-xs">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono">
                {JSON.stringify(formPayload.fields, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    ) : null}
  </div>
);

export default TargetScreen;
