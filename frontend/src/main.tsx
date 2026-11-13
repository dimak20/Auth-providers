import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { AuthRoot } from "./auth/AuthRoot";
import { getSelectedProvider, PROVIDERS } from "./auth/registry";
import { ErrorBox, FullScreen } from "./components/ui";
import { config } from "./config";
import "./index.css";

document.title = config.appName;

const root = createRoot(document.getElementById("root")!);
const provider = getSelectedProvider();

if (provider === null) {
  const missing = PROVIDERS.filter((p) => !p.comingSoon)
    .map((p) => `${p.label}: ${p.missingEnv.join(", ")}`)
    .join("; ");

  root.render(
    <FullScreen>
      <div className="w-full max-w-md">
        <ErrorBox
          title="No auth provider is configured"
          message={`Fill in frontend/.env.local (see .env.example). ${missing}`}
        />
      </div>
    </FullScreen>,
  );
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AuthRoot provider={provider}>
          <App />
        </AuthRoot>
      </BrowserRouter>
    </StrictMode>,
  );
}
