import { validateSubscription } from "./budget.js";

const KEY = "splitseat:v1";

function validateList(value) {
  if (!Array.isArray(value)) throw new Error("Subscriptions must be a list.");
  const ids = new Set();
  return Array.from(value, item => {
    const entry = validateSubscription(item);
    if (ids.has(entry.id)) throw new Error("Subscription ids must be unique.");
    ids.add(entry.id);
    return entry;
  });
}

export function loadSubscriptions(storage) {
  const saved = storage.getItem(KEY);
  if (saved === null) return null;
  const record = JSON.parse(saved);
  if (!record || typeof record !== "object" || Array.isArray(record) || record.version !== 1) {
    throw new Error("Unsupported or invalid saved budget.");
  }
  return validateList(record.subscriptions);
}

export function saveSubscriptions(storage, subscriptions) {
  const entries = validateList(subscriptions);
  storage.setItem(KEY, JSON.stringify({ version: 1, subscriptions: entries }));
}
