import { useEffect } from "react";
import { CheckingScreen } from "@/components/CheckingScreen";
import { MainApp } from "@/components/MainApp";
import { SetupScreen } from "@/components/SetupScreen";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkChromiumInstall,
  selectSetupPhase,
} from "@/store/setupSlice";

function App() {
  const dispatch = useAppDispatch();
  const phase = useAppSelector(selectSetupPhase);

  useEffect(() => {
    dispatch(checkChromiumInstall());
  }, [dispatch]);

  if (phase === "checking") {
    return <CheckingScreen />;
  }

  if (phase === "setup") {
    return <SetupScreen />;
  }

  return <MainApp />;
}

export default App;
