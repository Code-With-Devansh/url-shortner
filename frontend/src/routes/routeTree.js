import { createRootRoute } from "@tanstack/react-router";
import App from "../App";
import { homepageRoute } from "./homepage.route.js";
import { dashboardRoute } from "./dashboard.route.js";
import { urlDetailsRoute } from "./urlDetails.route.js";
import { analyticsRoute } from "./analytics.route.js";
import { authRoute, changePasswordRoute, emailVerificationRoute, emailVerifiedRoute, forgotPasswordRoute } from "./auth.route.js";

export const rootRoute = createRootRoute({
  component: App,
});

rootRoute.addChildren([
  homepageRoute(rootRoute),
  dashboardRoute(rootRoute),
  urlDetailsRoute(rootRoute),
  analyticsRoute(rootRoute),
  authRoute(rootRoute),
  emailVerificationRoute(rootRoute),
  emailVerifiedRoute(rootRoute),
  forgotPasswordRoute(rootRoute),
  changePasswordRoute(rootRoute)
]);
