import { useCallback, useRef, useState } from "react";

import CheckingScreen from "@presentation/app/screens/CheckingScreen";
import OffTargetScreen from "@presentation/app/screens/OffTargetScreen";
import TargetScreen from "@presentation/app/screens/TargetScreen";
import MultiPromptSetupScreen from "@presentation/app/screens/MultiPromptSetupScreen";
import { useActiveTargetPage } from "@presentation/hooks/useActiveTargetPage";
import { useFormSnapshot } from "@presentation/hooks/useFormSnapshot";

function App() {
  const { isTargetPage, isChecking, moveToTargetPage } = useActiveTargetPage();
  const { payload, error, isReading, readSnapshot } = useFormSnapshot();
  const [activeView, setActiveView] = useState<"main" | "multi-prompt">("main");
  const returnViewRef = useRef<"main">("main");

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
    returnViewRef.current = "main";
    setActiveView("multi-prompt");
  }, [returnViewRef]);

  const handleCloseMultiPrompt = useCallback(() => {
    setActiveView(returnViewRef.current);
  }, [returnViewRef]);

  if (activeView === "multi-prompt") {
    return (
      <MultiPromptSetupScreen
        onBack={handleCloseMultiPrompt}
        onNavigateToTarget={moveToTargetPage}
        formReadError={error}
        formPayload={payload}
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
    />
  );
}

export default App;
