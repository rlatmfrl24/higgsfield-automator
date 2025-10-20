import { useCallback, useEffect, useRef, useState } from "react";

import { checkActiveTabMatchesTarget } from "../services/tabs";
import { navigateActiveTabToTargetPage } from "../services/navigation";

type UseActiveTargetPageResult = {
  isTargetPage: boolean;
  isChecking: boolean;
  refresh: () => Promise<boolean>;
  moveToTargetPage: () => Promise<boolean>;
};

export const useActiveTargetPage = (): UseActiveTargetPageResult => {
  const [isTargetPage, setIsTargetPage] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) {
      return false;
    }

    setIsChecking(true);

    try {
      const matches = await checkActiveTabMatchesTarget();

      if (isMountedRef.current) {
        setIsTargetPage(matches);
      }

      return matches;
    } catch (error) {
      console.error("현재 탭 정보를 확인하는 중 오류 발생", error);

      if (isMountedRef.current) {
        setIsTargetPage(false);
      }

      return false;
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh().catch((error) => {
      console.error("초기 상태 확인 중 오류 발생", error);
    });
  }, [refresh]);

  const moveToTargetPage = useCallback(async () => {
    if (!isMountedRef.current) {
      return false;
    }

    setIsChecking(true);

    try {
      const matches = await navigateActiveTabToTargetPage({
        onAttempt: (isMatch) => {
          if (isMountedRef.current) {
            setIsTargetPage(isMatch);
          }
        },
      });

      if (isMountedRef.current) {
        setIsTargetPage(matches);
      }

      return matches;
    } catch (error) {
      console.error("타겟 페이지로 이동하는 중 오류 발생", error);

      if (isMountedRef.current) {
        setIsTargetPage(false);
      }

      return false;
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, []);

  return {
    isTargetPage,
    isChecking,
    refresh,
    moveToTargetPage,
  };
};
