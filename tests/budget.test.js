import { expect, test } from "bun:test";
import { summarizeBudget, validateSubscription } from "../services/budget.js";

const entry = (overrides = {}) => ({
  id: "music", name: "Music", costCents: 1200, interval: "monthly",
  members: ["Alice", "Bob"], ...overrides,
});

test("normalizes a fresh copy without changing the input", () => {
  const original = entry({ id: " music ", name: " Music ", members: [" Alice ", "Bob"] });
  Object.freeze(original.members);
  Object.freeze(original);
  const normalized = validateSubscription(original);
  expect(normalized).toEqual(entry());
  expect(normalized).not.toBe(original);
  expect(normalized.members).not.toBe(original.members);
  expect(original.members[0]).toBe(" Alice ");
});

test("rejects malformed subscriptions and missing required fields", () => {
  for (const value of [null, undefined, [], "music", {}, ...["id", "name", "costCents", "interval", "members"].map(key => {
    const value = entry(); delete value[key]; return value;
  })]) expect(() => validateSubscription(value)).toThrow(Error);
});

test("rejects invalid money, intervals, names and duplicate members", () => {
  for (const costCents of [-1, 0.5, NaN, Infinity, "1200", Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => validateSubscription(entry({ costCents }))).toThrow(Error);
  }
  for (const overrides of [
    { id: " " }, { name: "" }, { interval: "weekly" }, { members: [] },
    { members: "Alice" }, { members: [""] }, { members: [null] },
    { members: ["Alice", " alice "] }, { members: Array(1) },
  ]) expect(() => validateSubscription(entry(overrides))).toThrow(Error);
  expect(validateSubscription(entry({ costCents: 0 })).costCents).toBe(0);
});

test("combines monthly and annual costs and case-insensitive household shares", () => {
  const result = summarizeBudget([
    entry({ members: ["Bob", "Alice"] }),
    entry({ id: "annual", interval: "yearly", costCents: 12000, members: ["alice", "Charlie"] }),
    entry({ id: "solo", costCents: 300, members: [" bob "] }),
  ]);
  expect(result).toEqual({ monthlyTotalCents: 2500, memberShares: [
    { name: "Alice", monthlyCents: 1100 },
    { name: "Bob", monthlyCents: 900 },
    { name: "Charlie", monthlyCents: 500 },
  ] });
});

test("keeps fractional cents until display, including uneven annual shares", () => {
  const result = summarizeBudget([entry({ interval: "yearly", costCents: 100, members: ["A", "B", "C"] })]);
  expect(result.monthlyTotalCents).toBeCloseTo(100 / 12, 12);
  for (const share of result.memberShares) expect(share.monthlyCents).toBeCloseTo(100 / 36, 12);
  expect(result.memberShares.reduce((sum, share) => sum + share.monthlyCents, 0)).toBeCloseTo(result.monthlyTotalCents, 12);
});

test("handles empty and free budgets and member names that resemble object keys", () => {
  expect(summarizeBudget([])).toEqual({ monthlyTotalCents: 0, memberShares: [] });
  expect(summarizeBudget([entry({ costCents: 0, members: ["__proto__"] })])).toEqual({
    monthlyTotalCents: 0, memberShares: [{ name: "__proto__", monthlyCents: 0 }],
  });
});

test("summary rejects invalid entries and leaves caller data unchanged", () => {
  const input = [entry()];
  const before = JSON.stringify(input);
  summarizeBudget(input);
  expect(JSON.stringify(input)).toBe(before);
  expect(() => summarizeBudget(null)).toThrow(Error);
  expect(() => summarizeBudget([entry(), entry({ costCents: -1 })])).toThrow(Error);
});


test("retains first-seen spelling and sorts combined member names", () => {
  const result = summarizeBudget([
    entry({ members: [" zoE ", "alice"] }),
    entry({ members: ["ALICE", "Zoe"] }),
  ]);
  expect(result.memberShares).toEqual([
    { name: "alice", monthlyCents: 1200 },
    { name: "zoE", monthlyCents: 1200 },
  ]);
});

test("aggregates many fractional shares without rounding each entry", () => {
  const result = summarizeBudget(Array.from({ length: 12 }, (_, index) =>
    entry({ id: String(index), costCents: 1, interval: "yearly", members: ["A", "B", "C"] })
  ));
  expect(result.monthlyTotalCents).toBeCloseTo(1, 12);
  for (const share of result.memberShares) expect(share.monthlyCents).toBeCloseTo(1 / 3, 12);
  expect(() => summarizeBudget(Array(1))).toThrow(Error);
});

test("rejects amounts outside the exact integer range", () => {
  expect(() => validateSubscription(entry({ costCents: Number.MAX_SAFE_INTEGER + 1 }))).toThrow(Error);
  expect(validateSubscription(entry({ costCents: Number.MAX_SAFE_INTEGER })).costCents)
    .toBe(Number.MAX_SAFE_INTEGER);
});
