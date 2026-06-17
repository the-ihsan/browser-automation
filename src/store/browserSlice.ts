import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  browserLaunch,
  browserStatus,
  browserStop,
  type BrowserRun,
} from "@/lib/api";

export type PendingAction = "launch" | "stop" | null;

export interface BrowserState {
  headless: boolean;
  run: BrowserRun | null;
  pending: PendingAction;
  error: string | null;
}

const initialState: BrowserState = {
  headless: true,
  run: null,
  pending: null,
  error: null,
};

function applyStatus(state: BrowserState, status: BrowserRun) {
  state.run = status.crashed || !status.running ? (status.crashed ? status : null) : status;
}

export const syncBrowserStatus = createAsyncThunk(
  "browser/syncStatus",
  async (runId?: string) => browserStatus(runId),
);

export const launchBrowser = createAsyncThunk(
  "browser/launch",
  async (headless: boolean) => browserLaunch(headless),
);

export const stopBrowser = createAsyncThunk(
  "browser/stop",
  async (runId: string, { dispatch }) => {
    try {
      return await browserStop(runId);
    } catch (e) {
      await dispatch(syncBrowserStatus(runId));
      throw e;
    }
  },
);

const browserSlice = createSlice({
  name: "browser",
  initialState,
  reducers: {
    setHeadless(state, action: PayloadAction<boolean>) {
      state.headless = action.payload;
    },
    browserClosed(state, action: PayloadAction<BrowserRun>) {
      applyStatus(state, action.payload);
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncBrowserStatus.fulfilled, (state, action) => {
        applyStatus(state, action.payload);
      })
      .addCase(launchBrowser.pending, (state) => {
        state.pending = "launch";
        state.error = null;
      })
      .addCase(launchBrowser.fulfilled, (state, action) => {
        state.pending = null;
        state.run = action.payload;
      })
      .addCase(launchBrowser.rejected, (state, action) => {
        state.pending = null;
        state.error = action.error.message ?? "Failed to launch browser";
      })
      .addCase(stopBrowser.pending, (state) => {
        state.pending = "stop";
        state.error = null;
      })
      .addCase(stopBrowser.fulfilled, (state) => {
        state.pending = null;
        state.run = null;
      })
      .addCase(stopBrowser.rejected, (state, action) => {
        state.pending = null;
        state.error = action.error.message ?? "Failed to stop browser";
      });
  },
});

export const { setHeadless, browserClosed, clearError } = browserSlice.actions;

export const selectBrowserRun = (state: { browser: BrowserState }) =>
  state.browser.run;
export const selectHeadless = (state: { browser: BrowserState }) =>
  state.browser.headless;
export const selectPending = (state: { browser: BrowserState }) =>
  state.browser.pending;
export const selectError = (state: { browser: BrowserState }) =>
  state.browser.error;
export const selectBusy = (state: { browser: BrowserState }) =>
  state.browser.pending !== null;
export const selectRunning = (state: { browser: BrowserState }) =>
  state.browser.run?.running === true;

export default browserSlice.reducer;
