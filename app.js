import { summarizeBudget, validateSubscription } from "./services/budget.js";
import { loadSubscriptions, saveSubscriptions } from "./services/storage.js";

const $ = id => document.getElementById(id);
const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
let subscriptions = [];
let storage;
let persistenceBlocked = false;
let pendingOperations = [];
let operationQueue = Promise.resolve();
let formBusy = false;
const STORAGE_KEY = "splitseat:v1";

function withStorageLock(action) {
  return globalThis.navigator?.locks?.request
    ? navigator.locks.request("splitseat:v1:edit", action)
    : Promise.resolve().then(action);
}

function enqueue(action) {
  const result = operationQueue.then(action);
  operationQueue = result.catch(() => {});
  return result;
}

function applyOperations(base, operations) {
  let result = [...base];
  for (const operation of operations) {
    if (operation.type === "delete") result = result.filter(entry => entry.id !== operation.id);
    else {
      const existing = result.find(entry => entry.id === operation.entry.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(operation.entry)) {
        throw new Error("A subscription id conflicts with saved data. Your session changes have not been saved.");
      }
      if (!existing) result.push(operation.entry);
    }
  }
  return result;
}

function notice(message) {
  $("storage-notice").textContent = message;
  $("storage-notice").hidden = !message;
}

function blockPersistence() {
  persistenceBlocked = true;
  notice("Your saved budget could not be loaded. It has been left untouched. Changes on this page cannot persist and will be lost when you reload. Check your browser's storage settings or recover the saved data before reloading.");
}

function savePending() {
  try {
    saveSubscriptions(storage, subscriptions);
    pendingOperations = [];
    notice("");
    return true;
  } catch {
    notice("Changes cannot be saved in this browser right now. Your session edits are kept on this page, but will be lost when you reload. Check your browser's storage settings or available space.");
    return false;
  }
}

function mutate(operation) {
  return enqueue(() => withStorageLock(() => {
    if (!persistenceBlocked) {
      try {
        const latest = loadSubscriptions(storage) ?? [];
        subscriptions = applyOperations(latest, pendingOperations);
      } catch {
        blockPersistence();
      }
    }
    // Replay unsaved intents on the latest data, never save a stale snapshot.
    // Failed reads block writes and preserve the session's current entries.
    subscriptions = applyOperations(subscriptions, [operation]);
    pendingOperations.push(operation);
    const saved = !persistenceBlocked && savePending();
    render();
    return saved;
  }));
}

window.addEventListener("storage", event => {
  if (event.storageArea !== storage || (event.key !== STORAGE_KEY && event.key !== null)) return;
  enqueue(() => {
    if (persistenceBlocked) return;
    try {
      const latest = loadSubscriptions(storage) ?? [];
      subscriptions = applyOperations(latest, pendingOperations);
      render();
      $("activity").textContent = pendingOperations.length
        ? "Saved changes from another tab loaded. Your unsaved session edits are still kept here."
        : "Budget updated from another tab.";
    } catch {
      blockPersistence();
    }
  });
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function render() {
  const summary = summarizeBudget(subscriptions);
  $("monthly-total").textContent = money(summary.monthlyTotalCents);
  $("subscription-count").textContent = `${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"}`;
  $("list-count").textContent = subscriptions.length;
  $("member-shares").replaceChildren();
  for (const member of summary.memberShares) {
    const item = node("li");
    const avatar = node("span", "avatar", Array.from(member.name)[0].toUpperCase());
    avatar.setAttribute("aria-hidden", "true");
    const details = node("div");
    details.append(node("span", "member-name", member.name));
    const amount = node("span", "member-amount", money(member.monthlyCents));
    amount.append(node("small", "", " / month"));
    details.append(amount);
    item.append(avatar, details);
    $("member-shares").append(item);
  }
  if (!summary.memberShares.length) $("member-shares").append(node("li", "", "Add members with your first subscription."));
  $("subscription-list").replaceChildren();
  for (const entry of subscriptions) {
    const row = node("li", "subscription-row");
    const symbol = node("span", "subscription-symbol", Array.from(entry.name)[0].toUpperCase());
    symbol.setAttribute("aria-hidden", "true");
    const info = node("div", "subscription-info");
    info.append(node("h3", "", entry.name), node("p", "", `Shared by ${entry.members.join(", ")}`));
    const price = node("div", "subscription-price");
    price.append(node("strong", "", money(entry.costCents / (entry.interval === "yearly" ? 12 : 1))),
      node("span", "", entry.interval === "yearly" ? `${money(entry.costCents)} / year` : "per month"));
    const remove = node("button", "delete-button", "Delete");
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${entry.name}`);
    remove.addEventListener("click", async () => {
      const index = subscriptions.findIndex(item => item.id === entry.id);
      const saved = await mutate({ type: "delete", id: entry.id });
      $("activity").textContent = `${entry.name} deleted.${saved ? " Saved in this browser." : " Changed for this session only."}`;
      const buttons = $("subscription-list").querySelectorAll("button");
      if (buttons.length) buttons[Math.min(index, buttons.length - 1)].focus();
      else $("subscription-name").focus();
    });
    row.append(symbol, info, price, remove);
    $("subscription-list").append(row);
  }
  $("empty-state").hidden = subscriptions.length !== 0;
}

function parseCost(text) {
  const value = text.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Enter a nonnegative dollar amount with up to two decimal places, such as 15.00.");
  const [dollars, fraction = ""] = value.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("This amount is too large. Enter a smaller bill.");
  return cents;
}

function newId() {
  let id;
  do { id = globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  while (subscriptions.some(entry => entry.id === id));
  return id;
}

$("subscription-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (formBusy) return;
  formBusy = true;
  $("form-error").hidden = true;
  try {
    const entry = validateSubscription({
      id: newId(),
      name: $("subscription-name").value,
      costCents: parseCost($("subscription-cost").value),
      interval: $("subscription-interval").value,
      members: $("subscription-members").value.split(","),
    });
    const saved = await mutate({ type: "add", entry });
    $("subscription-form").reset();
    $("activity").textContent = `${entry.name} added.${saved ? " Saved in this browser." : " Changed for this session only."}`;
    $("subscription-name").focus();
  } catch (error) {
    $("form-error").textContent = error instanceof Error ? error.message : "Check the subscription details and try again.";
    $("form-error").hidden = false;
  } finally {
    formBusy = false;
  }
});

await enqueue(() => withStorageLock(() => {
try {
  storage = window.localStorage;
  const loaded = loadSubscriptions(storage);
  if (loaded === null) {
    subscriptions = [
      { id: "example-movies", name: "Movie nights", costCents: 1599, interval: "monthly", members: ["Alex", "Sam", "Jordan"] },
      { id: "example-music", name: "Family music", costCents: 1699, interval: "monthly", members: ["Alex", "Sam"] },
      { id: "example-cloud", name: "Shared cloud storage", costCents: 2999, interval: "yearly", members: ["Alex", "Sam", "Jordan"] },
    ];
    pendingOperations = subscriptions.map(entry => ({ type: "add", entry }));
    savePending();
    $("activity").textContent = "A few examples to start. Delete them and add your household's subscriptions.";
  } else subscriptions = loaded;
} catch {
  blockPersistence();
}
render();
}));
