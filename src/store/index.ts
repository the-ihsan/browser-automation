import { configureStore } from "@reduxjs/toolkit";
import browserReducer from "./browserSlice";
import setupReducer from "./setupSlice";

export const store = configureStore({
  reducer: {
    browser: browserReducer,
    setup: setupReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
