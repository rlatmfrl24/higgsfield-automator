import CheckingScreen from "@presentation/app/screens/CheckingScreen";
import OffTargetScreen from "@presentation/app/screens/OffTargetScreen";
import TargetScreen from "@presentation/app/screens/TargetScreen";
import { useActiveTargetPage } from "@presentation/hooks/useActiveTargetPage";
import { useFormSnapshot } from "@presentation/hooks/useFormSnapshot";

function App() {
  const { isTargetPage, isChecking, moveToTargetPage } = useActiveTargetPage();
  const { payload, error, isReading, readSnapshot } = useFormSnapshot();

  if (isChecking) {
    return <CheckingScreen />;
  }

  if (!isTargetPage) {
    return (
      <OffTargetScreen isBusy={isChecking} onNavigate={moveToTargetPage} />
    );
  }

  return (
    <TargetScreen
      isReadingForm={isReading}
      formReadError={error}
      formPayload={payload}
      onReadForm={readSnapshot}
    />
  );
}

export default App;
