import { createRoute } from "@tanstack/react-router";
import UrlDetailsPage from "../pages/UrlDetailsPage.jsx";
import { checkAuth } from "../utils/helper.js";

export const urlDetailsRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard/urls/$id",
    component: UrlDetailsPage,
    beforeLoad: checkAuth,
  });
