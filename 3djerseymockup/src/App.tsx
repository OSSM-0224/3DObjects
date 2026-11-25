import { lazy, Suspense } from "react";
import "./App.css";
import JerseyExperience from "./components/JerseyExperience";

const DesignShowcase = lazy(() => import("./components/DesignShowcase"));

function App() {
  const mode = new URLSearchParams(window.location.search).get("mode");

  if (mode === "designs") {
    return (
      <Suspense
        fallback={
          <div style={{ display: "grid", placeItems: "center", minHeight: "100svh", font: "700 0.7rem Archivo, sans-serif", letterSpacing: "0.18em" }}>
            LOADING DESIGN SHOWCASE…
          </div>
        }
      >
        <DesignShowcase />
      </Suspense>
    );
  }

  return <JerseyExperience />;
}

export default App;
