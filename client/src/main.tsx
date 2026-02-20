import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: "https://b14b169f90533206522a69681bf32f66@o4510919684653056.ingest.us.sentry.io/4510919715454976",
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
});

createRoot(document.getElementById("root")!).render(<App />);
