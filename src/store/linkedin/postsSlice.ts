import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  linkedinPostsRunCreate,
  linkedinPostsRunDelete,
  linkedinPostsRunPause,
  linkedinPostsRunRestart,
  linkedinPostsRunResume,
  linkedinPostsRunStop,
  linkedinPostsRunsGet,
  linkedinPostsRunsItemsList,
  linkedinPostsRunsList,
  type CreateRunInput,
  type LinkedInPostsRun,
  type LinkedInPostsRunItem,
} from "@/lib/linkedin/posts/api";
import type { RootState } from "@/store";

type PendingAction =
  | "loadRuns"
  | "loadRun"
  | "loadItems"
  | "create"
  | "pause"
  | "resume"
  | "stop"
  | "restart"
  | "delete"
  | "export"
  | null;

type LinkedInPostsState = {
  runs: LinkedInPostsRun[];
  runsPage: number;
  runsPageSize: number;
  runsTotal: number;
  selectedRunId: string | null;
  selectedRun: LinkedInPostsRun | null;
  items: LinkedInPostsRunItem[];
  itemsPage: number;
  itemsPageSize: number;
  itemsTotal: number;
  selectedItemId: string | null;
  pending: PendingAction;
  error: string | null;
};

const initialState: LinkedInPostsState = {
  runs: [],
  runsPage: 1,
  runsPageSize: 20,
  runsTotal: 0,
  selectedRunId: null,
  selectedRun: null,
  items: [],
  itemsPage: 1,
  itemsPageSize: 20,
  itemsTotal: 0,
  selectedItemId: null,
  pending: null,
  error: null,
};

export const loadRuns = createAsyncThunk(
  "linkedinPosts/loadRuns",
  async ({ page, pageSize }: { page?: number; pageSize?: number } = {}) => {
    return linkedinPostsRunsList(page ?? 1, pageSize ?? 20);
  },
);

export const loadSelectedRun = createAsyncThunk(
  "linkedinPosts/loadSelectedRun",
  async (runId: string) => linkedinPostsRunsGet(runId),
);

export const loadRunItems = createAsyncThunk(
  "linkedinPosts/loadRunItems",
  async ({
    runId,
    page,
    pageSize,
  }: {
    runId: string;
    page?: number;
    pageSize?: number;
  }) => linkedinPostsRunsItemsList(runId, page ?? 1, pageSize ?? 20),
);

export const createRun = createAsyncThunk(
  "linkedinPosts/createRun",
  async (input: CreateRunInput) => linkedinPostsRunCreate(input),
);

export const pauseRun = createAsyncThunk(
  "linkedinPosts/pauseRun",
  async (runId: string) => {
    await linkedinPostsRunPause(runId);
    return linkedinPostsRunsGet(runId);
  },
);

export const resumeRun = createAsyncThunk(
  "linkedinPosts/resumeRun",
  async (runId: string) => {
    await linkedinPostsRunResume(runId);
    return linkedinPostsRunsGet(runId);
  },
);

export const stopRun = createAsyncThunk(
  "linkedinPosts/stopRun",
  async (runId: string) => {
    await linkedinPostsRunStop(runId);
    return linkedinPostsRunsGet(runId);
  },
);

export const restartRun = createAsyncThunk(
  "linkedinPosts/restartRun",
  async (runId: string) => linkedinPostsRunRestart(runId),
);

export const deleteRun = createAsyncThunk(
  "linkedinPosts/deleteRun",
  async (runId: string) => {
    await linkedinPostsRunDelete(runId);
    return runId;
  },
);

const linkedinPostsSlice = createSlice({
  name: "linkedinPosts",
  initialState,
  reducers: {
    selectRun(state, action: PayloadAction<string | null>) {
      state.selectedRunId = action.payload;
      state.selectedItemId = null;
      state.items = [];
      state.itemsPage = 1;
      state.itemsTotal = 0;
      if (!action.payload) {
        state.selectedRun = null;
      } else {
        const run = state.runs.find((r) => r.id === action.payload);
        if (run) {
          state.selectedRun = run;
        }
      }
    },
    selectItem(state, action: PayloadAction<string | null>) {
      state.selectedItemId = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
    runUpdated(state, action: PayloadAction<LinkedInPostsRun>) {
      const idx = state.runs.findIndex((r) => r.id === action.payload.id);
      if (idx >= 0) {
        state.runs[idx] = action.payload;
      }
      if (state.selectedRunId === action.payload.id) {
        state.selectedRun = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    const setPending =
      (action: PendingAction) => (state: LinkedInPostsState) => {
        state.pending = action;
        state.error = null;
      };
    const setError = (state: LinkedInPostsState, message: string) => {
      state.pending = null;
      state.error = message;
    };

    builder
      .addCase(loadRuns.pending, setPending("loadRuns"))
      .addCase(loadRuns.fulfilled, (state, action) => {
        state.pending = null;
        state.runs = action.payload.items;
        state.runsTotal = action.payload.total;
        state.runsPage = action.payload.page;
        state.runsPageSize = action.payload.page_size;
      })
      .addCase(loadRuns.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to load runs");
      })

      .addCase(loadSelectedRun.pending, setPending("loadRun"))
      .addCase(loadSelectedRun.fulfilled, (state, action) => {
        state.pending = null;
        state.selectedRun = action.payload;
        const idx = state.runs.findIndex((r) => r.id === action.payload.id);
        if (idx >= 0) {
          state.runs[idx] = action.payload;
        }
      })
      .addCase(loadSelectedRun.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to load run");
      })

      .addCase(loadRunItems.pending, setPending("loadItems"))
      .addCase(loadRunItems.fulfilled, (state, action) => {
        state.pending = null;
        state.items = action.payload.items;
        state.itemsTotal = action.payload.total;
        state.itemsPage = action.payload.page;
        state.itemsPageSize = action.payload.page_size;
      })
      .addCase(loadRunItems.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to load posts");
      })

      .addCase(createRun.pending, setPending("create"))
      .addCase(createRun.fulfilled, (state, action) => {
        state.pending = null;
        state.runs.unshift(action.payload);
        state.runsTotal += 1;
        state.selectedRunId = action.payload.id;
        state.selectedRun = action.payload;
      })
      .addCase(createRun.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to create run");
      })

      .addCase(pauseRun.pending, setPending("pause"))
      .addCase(pauseRun.fulfilled, (state, action) => {
        state.pending = null;
        const idx = state.runs.findIndex((r) => r.id === action.payload.id);
        if (idx >= 0) {
          state.runs[idx] = action.payload;
        }
        if (state.selectedRunId === action.payload.id) {
          state.selectedRun = action.payload;
        }
      })
      .addCase(pauseRun.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to pause run");
      })

      .addCase(resumeRun.pending, setPending("resume"))
      .addCase(resumeRun.fulfilled, (state, action) => {
        state.pending = null;
        const idx = state.runs.findIndex((r) => r.id === action.payload.id);
        if (idx >= 0) {
          state.runs[idx] = action.payload;
        }
        if (state.selectedRunId === action.payload.id) {
          state.selectedRun = action.payload;
        }
      })
      .addCase(resumeRun.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to resume run");
      })

      .addCase(stopRun.pending, setPending("stop"))
      .addCase(stopRun.fulfilled, (state, action) => {
        state.pending = null;
        const idx = state.runs.findIndex((r) => r.id === action.payload.id);
        if (idx >= 0) {
          state.runs[idx] = action.payload;
        }
        if (state.selectedRunId === action.payload.id) {
          state.selectedRun = action.payload;
        }
      })
      .addCase(stopRun.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to stop run");
      })

      .addCase(restartRun.pending, setPending("restart"))
      .addCase(restartRun.fulfilled, (state, action) => {
        state.pending = null;
        state.selectedRun = action.payload;
        const idx = state.runs.findIndex((r) => r.id === action.payload.id);
        if (idx >= 0) {
          state.runs[idx] = action.payload;
        }
        state.items = [];
        state.itemsTotal = 0;
        state.selectedItemId = null;
      })
      .addCase(restartRun.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to restart run");
      })

      .addCase(deleteRun.pending, setPending("delete"))
      .addCase(deleteRun.fulfilled, (state, action) => {
        state.pending = null;
        state.runs = state.runs.filter((run) => run.id !== action.payload);
        state.runsTotal = Math.max(0, state.runsTotal - 1);
        if (state.selectedRunId === action.payload) {
          state.selectedRunId = null;
          state.selectedRun = null;
          state.items = [];
          state.itemsTotal = 0;
          state.selectedItemId = null;
        }
      })
      .addCase(deleteRun.rejected, (state, action) => {
        setError(state, action.error.message ?? "Failed to delete run");
      });
  },
});

export const { selectRun, selectItem, clearError, runUpdated } =
  linkedinPostsSlice.actions;

export const selectLinkedInRuns = (state: RootState) => state.linkedinPosts.runs;
export const selectLinkedInRunsPage = (state: RootState) =>
  state.linkedinPosts.runsPage;
export const selectLinkedInRunsTotal = (state: RootState) =>
  state.linkedinPosts.runsTotal;
export const selectLinkedInRunsPageSize = (state: RootState) =>
  state.linkedinPosts.runsPageSize;
export const selectSelectedRunId = (state: RootState) =>
  state.linkedinPosts.selectedRunId;
export const selectSelectedRun = (state: RootState) =>
  state.linkedinPosts.selectedRun;
export const selectLinkedInItems = (state: RootState) => state.linkedinPosts.items;
export const selectLinkedInItemsPage = (state: RootState) =>
  state.linkedinPosts.itemsPage;
export const selectLinkedInItemsTotal = (state: RootState) =>
  state.linkedinPosts.itemsTotal;
export const selectLinkedInItemsPageSize = (state: RootState) =>
  state.linkedinPosts.itemsPageSize;
export const selectSelectedItemId = (state: RootState) =>
  state.linkedinPosts.selectedItemId;
export const selectSelectedItem = (state: RootState) =>
  state.linkedinPosts.items.find((i) => i.id === state.linkedinPosts.selectedItemId) ??
  null;
export const selectLinkedInPostsPending = (state: RootState) =>
  state.linkedinPosts.pending;
export const selectLinkedInPostsError = (state: RootState) =>
  state.linkedinPosts.error;

export default linkedinPostsSlice.reducer;
