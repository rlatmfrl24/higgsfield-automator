import { GenerationPanel } from "./GenerationPanel";

type ControlPanelProps = {
  panelId: string;
  labelledById: string;
  highlightInfo: Parameters<typeof GenerationPanel>[0]["highlightInfo"];
  onPrepareGeneration: () => Promise<void>;
  preparationMessage: string | null;
  isConfirming: boolean;
  onConfirmGeneration: () => Promise<void>;
  onCancelGeneration: () => void;
  generationError: string | null;
  hidden?: boolean;
};

export const ControlPanel = ({
  panelId,
  labelledById,
  highlightInfo,
  onPrepareGeneration,
  preparationMessage,
  isConfirming,
  onConfirmGeneration,
  onCancelGeneration,
  generationError,
  hidden = false,
}: ControlPanelProps) => {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledById}
      className="space-y-6 p-8"
      aria-live="polite"
      hidden={hidden}
      aria-hidden={hidden}
    >
      <div className="space-y-4 rounded-2xl border border-emerald-100 bg-white px-6 py-5 shadow-sm">
        <h3 className="text-base font-semibold text-emerald-800">
          이미지 생성 요청
        </h3>
        <p className="text-sm text-emerald-700">
          멀티 프롬프트 자동화는 별도 탭에서 구성할 수 있으며, 이 화면에서는
          준비된 설정을 바탕으로 이미지 생성 요청을 전송합니다.
        </p>
      </div>

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
    </div>
  );
};

export default ControlPanel;
