import { createRoot } from "react-dom/client";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { rootRoute } from "./routes/routeTree";
import { store } from "./store/store.js";
import { Provider } from "react-redux";
import { initializeAuth, setAuthInitPromise } from "./store/slice/authSlice.js";
const queryClient = new QueryClient();

setAuthInitPromise(store.dispatch(initializeAuth()))
const router = createRouter({ routeTree: rootRoute , context: {queryClient, store}})

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
  </Provider>
);
