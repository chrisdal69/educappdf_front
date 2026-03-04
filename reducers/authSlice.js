import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isAuthenticated: false,
  isReady: false,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthenticated: (state, action) => {
      state.isAuthenticated = true;
      state.isReady = true;
      state.user = action.payload || null;
    },
    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.isReady = true;
      state.user = null;
    },
    setAuthReady: (state) => {
      state.isReady = true;
    },
  },
});

export const { setAuthenticated, clearAuth, setAuthReady } = authSlice.actions;
export default authSlice.reducer;
