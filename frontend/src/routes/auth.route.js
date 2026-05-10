import { createRoute } from "@tanstack/react-router"
import AuthPage from "../pages/AuthPage.jsx"

export const authRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/auth',
    component: AuthPage,
  })