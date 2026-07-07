import * as Sentry from "@sentry/node";
import config from "./index.js";
Sentry.init({
  dsn: config.sentry.dsn,

  environment: config.app.env,
  enabled: !!config.sentry.dsn,

  sendDefaultPii: false,
});

export default Sentry;