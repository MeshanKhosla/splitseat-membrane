import { expect, test } from "bun:test";
import { loadSubscriptions, saveSubscriptions } from "../services/storage.js";

const entry = (overrides = {}) => ({ id: "music", name: "Music", costCents: 1200,
  interval: "monthly", members: ["Alice", "Bob"], ...overrides });
function memory(initial = null) {
  return { saved: initial, writes: 0,
    getItem(key) { expect(key).toBe("splitseat:v1"); return this.saved; },
    setItem(key, value) { expect(key).toBe("splitseat:v1"); this.writes++; this.saved = value; } };
}

test("distinguishes absent data from saved empty household", () => {
  const storage = memory();
  expect(loadSubscriptions(storage)).toBeNull();
  expect(storage.writes).toBe(0);
  saveSubscriptions(storage, []);
  expect(JSON.parse(storage.saved)).toEqual({ version: 1, subscriptions: [] });
  expect(loadSubscriptions(storage)).toEqual([]);
});

test("round-trips normalized copies without changing caller data", () => {
  const source = entry({ id: " music ", name: " Music ", members: [" Alice ", "Bob"] });
  Object.freeze(source.members); Object.freeze(source);
  const storage = memory();
  saveSubscriptions(storage, [source]);
  const loaded = loadSubscriptions(storage);
  expect(loaded).toEqual([entry()]);
  expect(loaded[0]).not.toBe(source);
  expect(loaded[0].members).not.toBe(source.members);
  expect(source.members[0]).toBe(" Alice ");
  expect(storage.writes).toBe(1);
});

test("rejects malformed and unsupported records without overwriting them", () => {
  for (const saved of ["", "{", "null", "[]", "1", "{}", JSON.stringify({ version: 2, subscriptions: [] }),
    JSON.stringify({ version: "1", subscriptions: [] }), JSON.stringify({ version: 1, subscriptions: null }),
    JSON.stringify({ version: 1, subscriptions: [entry(), entry({ costCents: -1 })] })]) {
    const storage = memory(saved);
    expect(() => loadSubscriptions(storage)).toThrow(Error);
    expect(storage.saved).toBe(saved);
    expect(storage.writes).toBe(0);
  }
});

test("rejects duplicate normalized ids before reads return or writes happen", () => {
  const entries = [entry(), entry({ id: " music " })];
  const saved = JSON.stringify({ version: 1, subscriptions: entries });
  const storage = memory(saved);
  expect(() => loadSubscriptions(storage)).toThrow(Error);
  expect(() => saveSubscriptions(storage, entries)).toThrow(Error);
  expect(storage.saved).toBe(saved);
  expect(storage.writes).toBe(0);
});

test("validates the complete list before attempting any write", () => {
  const storage = memory("existing");
  for (const list of [null, {}, Array(1), [entry(), entry({ members: [] })], [entry({ costCents: Number.MAX_SAFE_INTEGER + 1 })]]) {
    expect(() => saveSubscriptions(storage, list)).toThrow(Error);
    expect(storage.saved).toBe("existing");
    expect(storage.writes).toBe(0);
  }
});

test("propagates storage read and write failures", () => {
  const readError = new Error("read blocked");
  expect(() => loadSubscriptions({ getItem() { throw readError; } })).toThrow(readError);
  const writeError = new Error("quota exceeded");
  expect(() => saveSubscriptions({ setItem() { throw writeError; } }, [entry()])).toThrow(writeError);
});

test("deleting the final entry preserves an explicitly saved empty list", () => {
  const storage = memory();
  saveSubscriptions(storage, [entry()]);
  const entries = loadSubscriptions(storage);
  entries.pop();
  saveSubscriptions(storage, entries);
  expect(loadSubscriptions(storage)).toEqual([]);
});
