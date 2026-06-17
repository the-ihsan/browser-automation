import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  browserInstallRun,
  browserInstallStatus,
  type BrowserInstallResult,
} from "@/lib/api";

export type SetupPhase = "checking" | "setup" | "ready";

export interface SetupState {
  phase: SetupPhase;
  installing: boolean;
  error: string | null;
}

const initialState: SetupState = {
  phase: "checking",
  installing: false,
  error: null,
};

export const checkChromiumInstall = createAsyncThunk(
  "setup/checkChromiumInstall",
  async () => browserInstallStatus(),
);

export const installChromium = createAsyncThunk(
  "setup/installChromium",
  async () => browserInstallRun(),
);

function applyInstallResult(
  state: SetupState,
  result: BrowserInstallResult,
  rejectMessage?: string,
) {
  if (result.installed) {
    state.phase = "ready";
    state.error = null;
    return;
  }
  state.phase = "setup";
  state.error = rejectMessage ?? result.error ?? "Chromium is not installed";
}

const setupSlice = createSlice({
  name: "setup",
  initialState,
  reducers: {
    clearSetupError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkChromiumInstall.pending, (state) => {
        state.phase = "checking";
        state.error = null;
      })
      .addCase(checkChromiumInstall.fulfilled, (state, action) => {
        applyInstallResult(state, action.payload);
      })
      .addCase(checkChromiumInstall.rejected, (state, action) => {
        state.phase = "setup";
        state.error =
          action.error.message ?? "Failed to check Chromium installation";
      })
      .addCase(installChromium.pending, (state) => {
        state.installing = true;
        state.error = null;
      })
      .addCase(installChromium.fulfilled, (state, action) => {
        state.installing = false;
        applyInstallResult(
          state,
          action.payload,
          action.payload.error ?? "Chromium install failed",
        );
      })
      .addCase(installChromium.rejected, (state, action) => {
        state.installing = false;
        state.phase = "setup";
        state.error = action.error.message ?? "Chromium install failed";
      });
  },
});

export const { clearSetupError } = setupSlice.actions;

export const selectSetupPhase = (state: { setup: SetupState }) =>
  state.setup.phase;
export const selectSetupInstalling = (state: { setup: SetupState }) =>
  state.setup.installing;
export const selectSetupError = (state: { setup: SetupState }) =>
  state.setup.error;

export default setupSlice.reducer;
