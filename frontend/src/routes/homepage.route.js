import { createRoute } from "@tanstack/react-router"
import Homepage from "../pages/Homepage.jsx"

export const homepageRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Homepage,
  })