// utils/helper.js
import { redirect } from "@tanstack/react-router";
import { authInitPromise, initializeAuth } from "../store/slice/authSlice";

export const checkAuth = async ({ context }) => {
  const { store } = context;
  if (authInitPromise) await authInitPromise;
  const state = store.getState().auth;
  if (!state.user) throw redirect({ to: "/auth" });
  return;
};
