import { configureStore } from '@reduxjs/toolkit';
import authReducer from "./slice/authSlice.js";
import urlReducer from "./slice/allUrlsSlice.js";
export const store = configureStore({
  reducer: {
    auth:authReducer,
    urls:urlReducer,
  },
});
