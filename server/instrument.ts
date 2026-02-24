import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://b14b169f90533206522a69681bf32f66@o4510919684653056.ingest.us.sentry.io/4510919715454976",
  environment: process.env.NODE_ENV || "development",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.2,
});
