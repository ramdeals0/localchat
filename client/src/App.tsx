import { useEffect, useState } from "react";
import { ToastProvider } from "./components/ui/ToastProvider";
import { ToastViewport } from "./components/ui/ToastViewport";
import { ChatWorkspace } from "./pages/ChatWorkspace";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { ThemeProvider } from "./theme/ThemeProvider";

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}

export default function App() {
  const route = useHashRoute();

  if (route === "#/design-system") {
    return (
      <ThemeProvider>
        <DesignSystemPage onBack={() => { window.location.hash = ""; }} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <ChatWorkspace
          onOpenDesignSystem={() => {
            window.location.hash = "#/design-system";
          }}
        />
        <ToastViewport />
      </ToastProvider>
    </ThemeProvider>
  );
}
