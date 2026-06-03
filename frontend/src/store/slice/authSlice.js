import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getCurrentUser, refreshAccessToken } from "../../api/user.api";

const initialState = {
  user: null,
  loading: true,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login(state, action) {
      state.user = action.payload.user;
    },
    logout(state) {
      state.user = null;
    },
    setVerified(state) {
      if (state.user) {
        state.user.isVerified = true;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.user = null;
        state.loading = false;
      });
  },
});
export const initializeAuth = createAsyncThunk(
  "auth/initialize",
  async (_, { rejectWithValue }) => {
    try {
      const {accessToken} = await refreshAccessToken();
      const user = await getCurrentUser();
      return user;
    } catch {
      return rejectWithValue("Not authenticated");
    }
  },
);
export const { login, logout, setLoading, setError, setVerified } = authSlice.actions;
export default authSlice.reducer;
