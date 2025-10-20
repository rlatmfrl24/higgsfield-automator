import { GENERATION_BUTTON_KEY_PHRASE } from "../../../services/generation";
import type { CreditHighlight } from "./formData";

type GenerationPanelProps = {
  onPrepare: () => void;
  highlightInfo: CreditHighlight | null;
  preparationMessage: string | null;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  errorMessage: string | null;
};

export const GenerationPanel = ({
  onPrepare,
  highlightInfo,
  preparationMessage,
  isConfirming,
  onConfirm,
  onCancel,
  errorMessage,
}: GenerationPanelProps) => (
  <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-emerald-800">이미지 생성</p>
        <p className="text-xs text-emerald-700">
          {highlightInfo
            ? highlightInfo.display
            : `버튼 텍스트에 "${GENERATION_BUTTON_KEY_PHRASE}" 문구가 포함된 버튼을 찾아 클릭합니다.`}
        </p>
        {preparationMessage ? (
          <p className="text-xs text-emerald-600">{preparationMessage}</p>
        ) : null}
      </div>
      <button
        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-emerald-300"
        onClick={onPrepare}
      >
        이미지 생성 준비
      </button>
    </div>

    {isConfirming ? (
      <div className="space-y-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs text-slate-700">
        <p className="font-semibold text-amber-700">
          하루 무료 크레딧이 차감됩니다. 계속 진행할까요?
        </p>
        <div className="flex gap-2">
          <button
            className="rounded border border-amber-400 bg-amber-50 px-3 py-1 font-semibold text-amber-700 hover:bg-amber-100"
            onClick={onConfirm}
          >
            동의하고 진행
          </button>
          <button
            className="rounded border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-100"
            onClick={onCancel}
          >
            취소
          </button>
        </div>
      </div>
    ) : null}

    {errorMessage ? (
      <p className="text-xs text-red-600">{errorMessage}</p>
    ) : null}
  </div>
);
