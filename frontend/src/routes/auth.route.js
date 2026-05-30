import { createRoute } from "@tanstack/react-router";
import AuthPage from "../pages/AuthPage.jsx";
import EmailVerificationPage from "../pages/EmailVerificationPage.jsx";
import EmailVerifiedPage from "../pages/EmailVerifiedPage.jsx";
import ForgotPassword from "../pages/FogotPassword.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";

export const authRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth",
    component: AuthPage,
  });

export const emailVerificationRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth/verify-email",
    component: EmailVerificationPage,
  });
export const emailVerifiedRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth/email-verified",
    component: EmailVerifiedPage,
  });

export const forgotPasswordRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth/forgot-password",
    component: ForgotPassword,
  });
export const changePasswordRoute = (rootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth/change-password/$token",
    component: ResetPassword,
  });
