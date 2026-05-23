import { createRootRoute } from "@tanstack/react-router";
import App from "../App";
import { homepageRoute } from "./homepage.route.js";
import { dashboardRoute } from "./dashboard.route.js";
import { authRoute, emailVerificationRoute, emailVerifiedRoute } from "./auth.route.js";

export const rootRoute = createRootRoute({
  component: App,
});

rootRoute.addChildren([
  homepageRoute(rootRoute),
  dashboardRoute(rootRoute),
  authRoute(rootRoute),
  emailVerificationRoute(rootRoute),
  emailVerifiedRoute(rootRoute),
]);
