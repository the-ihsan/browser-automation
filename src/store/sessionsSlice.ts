import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  sessionsCheck,
  sessionsCreate,
  sessionsDelete,
  sessionsLaunch,
  sessionsList,
  type SessionInfo,
} from "@/lib/sessions/api";
import type { PlatformSlug } from "@/lib/tools/registry";
import type { RootState } from "@/store";

type PendingAction = "create" | "launch" | "check" | "delete" | null;

type SessionsState = {
  platform: PlatformSlug | null;
  items: SessionInfo[];
  selectedId: string | null;
  pending: PendingAction;
  pendingSessionId: string | null;
  error: string | null;
  lastCheck: Record<string, { logged_in: boolean; url: string }>;
};

const initialState: SessionsState = {
  platform: null,
  items: [],
  selectedId: null,
  pending: null,
  pendingSessionId: null,
  error: null,
  lastCheck: {},
};

export const loadSessions = createAsyncThunk(
  "sessions/load",
  async (platform: PlatformSlug) => sessionsList(platform),
);

export const createSession = createAsyncThunk(
  "sessions/create",
  async ({
    platform,
    name,
    launchFresh,
  }: {
    platform: PlatformSlug;
    name: string;
    launchFresh: boolean;
  }) => {
    const session = await sessionsCreate(platform, name);
    if (launchFresh) {
      const launched = await sessionsLaunch(session.id, true);
      return launched.session;
    }
    return session;
  },
);

export const launchSession = createAsyncThunk(
  "sessions/launch",
  async ({ sessionId, fresh }: { sessionId: string; fresh?: boolean }) => {
    const result = await sessionsLaunch(sessionId, fresh ?? false);
    return result.session;
  },
);

export const checkSession = createAsyncThunk(
  "sessions/check",
  async (sessionId: string) => {
    const result = await sessionsCheck(sessionId);
    return result;
  },
);

export const deleteSession = createAsyncThunk(
  "sessions/delete",
  async (sessionId: string) => {
    await sessionsDelete(sessionId);
    return sessionId;
  },
);

const sessionsSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    setPlatform(state, action: PayloadAction<PlatformSlug>) {
      state.platform = action.payload;
      state.selectedId = null;
      state.error = null;
    },
    selectSession(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
    sessionClosed(state, action: PayloadAction<{ session_id: string }>) {
      state.items = state.items.map((item) =>
        item.id === action.payload.session_id
          ? {
              ...item,
              status: "idle",
              active_run_id: null,
            }
          : item,
      );
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSessions.pending, (state) => {
        state.error = null;
      })
      .addCase(loadSessions.fulfilled, (state, action) => {
        state.items = action.payload;
        if (
          state.selectedId &&
          !action.payload.some((item) => item.id === state.selectedId)
        ) {
          state.selectedId = null;
        }
      })
      .addCase(loadSessions.rejected, (state, action) => {
        state.error = action.error.message ?? "Failed to load sessions";
      })
      .addCase(createSession.pending, (state) => {
        state.pending = "create";
        state.error = null;
      })
      .addCase(createSession.fulfilled, (state, action) => {
        state.pending = null;
        state.items = [...state.items, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        state.selectedId = action.payload.id;
      })
      .addCase(createSession.rejected, (state, action) => {
        state.pending = null;
        state.error = action.error.message ?? "Failed to create session";
      })
      .addCase(launchSession.pending, (state, action) => {
        state.pending = "launch";
        state.pendingSessionId = action.meta.arg.sessionId;
        state.error = null;
      })
      .addCase(launchSession.fulfilled, (state, action) => {
        state.pending = null;
        state.pendingSessionId = null;
        state.items = state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        );
      })
      .addCase(launchSession.rejected, (state, action) => {
        state.pending = null;
        state.pendingSessionId = null;
        state.error = action.error.message ?? "Failed to launch session";
      })
      .addCase(checkSession.pending, (state, action) => {
        state.pending = "check";
        state.pendingSessionId = action.meta.arg;
        state.error = null;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        state.pending = null;
        state.pendingSessionId = null;
        state.items = state.items.map((item) =>
          item.id === action.payload.session.id
            ? action.payload.session
            : item,
        );
        state.lastCheck[action.payload.session.id] = {
          logged_in: action.payload.logged_in,
          url: action.payload.url,
        };
      })
      .addCase(checkSession.rejected, (state, action) => {
        state.pending = null;
        state.pendingSessionId = null;
        state.error = action.error.message ?? "Failed to check session";
      })
      .addCase(deleteSession.pending, (state, action) => {
        state.pending = "delete";
        state.pendingSessionId = action.meta.arg;
        state.error = null;
      })
      .addCase(deleteSession.fulfilled, (state, action) => {
        state.pending = null;
        state.pendingSessionId = null;
        state.items = state.items.filter((item) => item.id !== action.payload);
        if (state.selectedId === action.payload) {
          state.selectedId = null;
        }
        delete state.lastCheck[action.payload];
      })
      .addCase(deleteSession.rejected, (state, action) => {
        state.pending = null;
        state.pendingSessionId = null;
        state.error = action.error.message ?? "Failed to delete session";
      });
  },
});

export const { setPlatform, selectSession, sessionClosed, clearError } =
  sessionsSlice.actions;

export const selectSessions = (state: RootState) => state.sessions.items;
export const selectSelectedSessionId = (state: RootState) =>
  state.sessions.selectedId;
export const selectSessionsPending = (state: RootState) => state.sessions.pending;
export const selectSessionsPendingId = (state: RootState) =>
  state.sessions.pendingSessionId;
export const selectSessionsError = (state: RootState) => state.sessions.error;
export const selectLastCheck = (state: RootState) => state.sessions.lastCheck;
export const selectSelectedSession = (state: RootState) => {
  const id = state.sessions.selectedId;
  return state.sessions.items.find((item) => item.id === id) ?? null;
};

export default sessionsSlice.reducer;
