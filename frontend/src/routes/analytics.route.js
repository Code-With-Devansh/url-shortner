import { createRoute } from "@tanstack/react-router";
import AnalyticsPage from "../pages/AnalyticsPage.jsx";
import { checkAuth } from "../utils/helper.js";

export const analyticsRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/analytics",
    component: AnalyticsPage,
    beforeLoad: checkAuth,
  });
