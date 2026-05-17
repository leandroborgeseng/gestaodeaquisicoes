"use client";

import { openDB } from "idb";

export interface OfflineMutation {
  id?: number;
  endpoint: string;
  method: string;
  body: string;
  createdAt: number;
}

async function getDB() {
  return openDB("aion-offline", 1, {
    upgrade(db) {
      db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
    },
  });
}

export async function queueMutation(m: Omit<OfflineMutation, "id" | "createdAt">) {
  const db = await getDB();
  await db.add("mutations", { ...m, createdAt: Date.now() });
}

export async function getPendingMutations(): Promise<OfflineMutation[]> {
  const db = await getDB();
  return db.getAll("mutations");
}

export async function deleteMutation(id: number) {
  const db = await getDB();
  await db.delete("mutations", id);
}

export async function flushMutations(): Promise<number> {
  const pending = await getPendingMutations();
  let flushed = 0;
  for (const m of pending) {
    try {
      const res = await fetch(m.endpoint, {
        method: m.method,
        headers: { "Content-Type": "application/json" },
        body: m.body,
      });
      if (res.ok) { await deleteMutation(m.id!); flushed++; }
    } catch { /* still offline */ }
  }
  return flushed;
}
