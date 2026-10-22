// IndexedDB persistence and recovery of interrupted walkthrough recordings.
import { messages } from "../locales";
import type { TestSession } from "../shared/recordingModel";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("se12-location-lab", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("sessions", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error(messages.errors.storageBlocked));
  });
}
async function runTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const storageTransaction = database.transaction("sessions", mode);
    const request = action(storageTransaction.objectStore("sessions"));
    // Request success can precede a failed commit, so wait for the whole transaction.
    storageTransaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    storageTransaction.onabort = storageTransaction.onerror = () => {
      database.close();
      reject(
        storageTransaction.error ||
          request.error ||
          Error(messages.errors.storageFailed),
      );
    };
  });
}
export const save = (session: TestSession) =>
  runTransaction("readwrite", (store) => store.put(structuredClone(session)));
export const all = () =>
  runTransaction("readonly", (store) => store.getAll()) as Promise<
    TestSession[]
  >;
export const remove = (id: string) =>
  runTransaction("readwrite", (store) => store.delete(id));
export async function recover() {
  const sessions = await all();
  for (const session of sessions)
    if (session.status === "active") {
      session.status = "interrupted";
      // The actual stop time is unknown; using reload time would invent unobserved duration.
      session.endedAt = Math.max(
        session.startedAt,
        session.events.at(-1)?.at ?? 0,
        session.samples.at(-1)?.receivedAt ?? 0,
      );
      session.events.push({
        at: Date.now(),
        type: "reload",
        detail: messages.recordings.reloadDetail,
      });
      await save(session);
    }
  return sessions.sort(
    (earlierSession, laterSession) =>
      laterSession.startedAt - earlierSession.startedAt,
  );
}
