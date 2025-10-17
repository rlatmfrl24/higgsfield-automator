import CheckingScreen from "./components/screens/CheckingScreen";
import OffTargetScreen from "./components/screens/OffTargetScreen";
import TargetScreen from "./components/screens/TargetScreen";
import { useActiveTargetPage } from "./hooks/useActiveTargetPage";
import { useFormSnapshot } from "./hooks/useFormSnapshot";

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
