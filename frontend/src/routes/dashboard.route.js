import { createRoute } from "@tanstack/react-router";
import DashboardPage from "../pages/DashboardPage.jsx";
import { checkAuth } from "../utils/helper.js";

export const dashboardRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: DashboardPage,
    beforeLoad: checkAuth,
  });
