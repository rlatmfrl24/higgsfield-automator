import { useCallback, useState } from "react";

import type { FormSnapshotPayload } from "../services/formSnapshot";
import { captureActiveTabFormSnapshot } from "../services/formSnapshotExecutor";

type UseFormSnapshotResult = {
  payload: FormSnapshotPayload | null;
  error: string | null;
  isReading: boolean;
  readSnapshot: () => Promise<void>;
};

export const useFormSnapshot = (): UseFormSnapshotResult => {
  const [payload, setPayload] = useState<FormSnapshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const readSnapshot = useCallback(async () => {
    setIsReading(true);
    setError(null);
    setPayload(null);

    try {
      const snapshot = await captureActiveTabFormSnapshot();
      setPayload(snapshot);
    } catch (cause) {
      console.error("폼 데이터를 읽는 중 오류 발생", cause);

      const message =
        cause instanceof Error
          ? cause.message
          : "알 수 없는 오류가 발생했습니다.";

      setError(message);
    } finally {
      setIsReading(false);
    }
  }, []);

  return {
    payload,
    error,
    isReading,
    readSnapshot,
  };
};

export default useFormSnapshot;
