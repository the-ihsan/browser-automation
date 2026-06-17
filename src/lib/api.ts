import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type CommTrace = { message: string; side: "rust" };
export type HelloResponse = { message: string };

export const sayHello = () => invoke<HelloResponse>("say_hello");

export const commEmit = (channel: string, payload: unknown = null) =>
  invoke<void>("comm_emit", { channel, payload });

export const commRequest = (
  channel: string,
  payload: unknown = null,
  timeoutMs = 30_000,
) => invoke<unknown>("comm_request", { channel, payload, timeoutMs });

export const commTriggerPyEvent = (channel: string, payload: unknown = null) =>
  invoke<unknown>("comm_trigger_py_event", { channel, payload });

export const commTriggerPyRequest = (channel: string, payload: unknown = null) =>
  invoke<unknown>("comm_trigger_py_request", { channel, payload });

export async function subscribeCommTrace(
  cb: (entry: CommTrace) => void,
): Promise<UnlistenFn> {
  return listen<CommTrace>("daemon://comm", (e) => cb(e.payload));
}

export async function subscribeHello(
  cb: (message: string) => void,
): Promise<UnlistenFn> {
  return listen<{ message: string }>("daemon://hello", (e) =>
    cb(e.payload.message),
  );
}

export async function subscribeDaemonLog(
  cb: (message: string) => void,
): Promise<UnlistenFn> {
  return listen<{ message: string }>("daemon://log", (e) =>
    cb(e.payload.message),
  );
}
