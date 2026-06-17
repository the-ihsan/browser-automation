import { configureStore } from "@reduxjs/toolkit";
import browserReducer from "./browserSlice";
import linkedinPostsReducer from "./linkedin/postsSlice";
import sessionsReducer from "./sessionsSlice";
import setupReducer from "./setupSlice";

export const store = configureStore({
  reducer: {
    browser: browserReducer,
    linkedinPosts: linkedinPostsReducer,
    sessions: sessionsReducer,
    setup: setupReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
