import { useCallback, useRef, useState } from "react";

import CheckingScreen from "@presentation/app/screens/CheckingScreen";
import OffTargetScreen from "@presentation/app/screens/OffTargetScreen";
import TargetScreen from "@presentation/app/screens/TargetScreen";
import MultiPromptSetupScreen from "@presentation/app/screens/MultiPromptSetupScreen";
import DownloadQueueScreen from "@presentation/app/screens/DownloadQueueScreen";
import { useActiveTargetPage } from "@presentation/hooks/useActiveTargetPage";
import { useFormSnapshot } from "@presentation/hooks/useFormSnapshot";

type AppView = "main" | "multi-prompt" | "download-queue";

function App() {
  const { isTargetPage, isChecking, moveToTargetPage } = useActiveTargetPage();
  const { payload, error, isReading, readSnapshot } = useFormSnapshot();
  const [activeView, setActiveView] = useState<AppView>("main");
  const returnViewRef = useRef<AppView>("main");

  const handleReadForm = useCallback(() => {
    void (async () => {
      const success = await readSnapshot();

      if (!success) {
        const moved = await moveToTargetPage();

        if (moved) {
          await readSnapshot();
        }
      }
    })();
  }, [moveToTargetPage, readSnapshot]);

  const handleOpenMultiPrompt = useCallback(() => {
    returnViewRef.current = activeView;
    setActiveView("multi-prompt");
  }, [activeView]);

  const handleOpenDownloadQueue = useCallback(() => {
    returnViewRef.current = activeView;
    setActiveView("download-queue");
  }, [activeView]);

  const handleCloseStandalone = useCallback(() => {
    setActiveView(returnViewRef.current);
  }, []);

  if (activeView === "multi-prompt") {
    return (
      <MultiPromptSetupScreen
        onBack={handleCloseStandalone}
        onNavigateToTarget={moveToTargetPage}
        formReadError={error}
        formPayload={payload}
      />
    );
  }

  if (activeView === "download-queue") {
    return (
      <DownloadQueueScreen
        onBack={handleCloseStandalone}
        onNavigateToTarget={moveToTargetPage}
      />
    );
  }

  if (isChecking) {
    return <CheckingScreen />;
  }

  if (!isTargetPage) {
    return (
      <OffTargetScreen
        isBusy={isChecking}
        onNavigate={moveToTargetPage}
        onOpenMultiPrompt={handleOpenMultiPrompt}
        onOpenDownloadQueue={handleOpenDownloadQueue}
      />
    );
  }

  return (
    <TargetScreen
      isReadingForm={isReading}
      formReadError={error}
      formPayload={payload}
      onReadForm={handleReadForm}
      onOpenStandaloneMultiPrompt={handleOpenMultiPrompt}
      onOpenDownloadQueue={handleOpenDownloadQueue}
    />
  );
}

export default App;
