import { createRoute } from "@tanstack/react-router";
import dashboardPage from "../pages/dashboardPage.jsx";
import { checkAuth } from "../utils/helper.js";

export const dashboardRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: dashboardPage,
    beforeLoad: checkAuth,
  });
