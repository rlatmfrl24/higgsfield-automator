import { ACTIVE_TAB_QUERY, TARGET_ORIGIN, TARGET_PATH } from "../constants";

type BasicTabInfo = {
  id?: number;
  url?: string;
};

const isTargetUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.origin === TARGET_ORIGIN && parsed.pathname === TARGET_PATH;
  } catch (error) {
    console.error("URL 파싱 중 오류 발생", error);
    return false;
  }
};

export const getActiveTab = async (): Promise<BasicTabInfo | undefined> => {
  const [tab] = await chrome.tabs.query(ACTIVE_TAB_QUERY);
  return tab as BasicTabInfo | undefined;
};

export const requireActiveTabId = async (): Promise<number> => {
  const tab = await getActiveTab();

  if (typeof tab?.id !== "number") {
    throw new Error("활성 탭을 찾을 수 없습니다.");
  }

  return tab.id;
};

export const checkActiveTabMatchesTarget = async (): Promise<boolean> => {
  const tab = await getActiveTab();
  if (!tab?.url) {
    return false;
  }

  return isTargetUrl(tab.url);
};
