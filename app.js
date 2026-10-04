import { summarizeBudget, validateSubscription } from "./services/budget.js";
import { loadSubscriptions, saveSubscriptions } from "./services/storage.js";

const $ = id => document.getElementById(id);
const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
let subscriptions = [];
let storage;
let persistenceBlocked = false;

function notice(message) {
  $("storage-notice").textContent = message;
  $("storage-notice").hidden = !message;
}

function persist() {
  if (persistenceBlocked) return false;
  try {
    saveSubscriptions(storage, subscriptions);
    notice("");
    return true;
  } catch {
    notice("Changes cannot be saved in this browser right now. You can keep using this page, but changes will be lost when you reload. Check your browser's storage settings or available space.");
    return false;
  }
}

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
    remove.addEventListener("click", () => {
      const index = subscriptions.findIndex(item => item.id === entry.id);
      subscriptions = subscriptions.filter(item => item.id !== entry.id);
      const saved = persist();
      render();
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

$("subscription-form").addEventListener("submit", event => {
  event.preventDefault();
  $("form-error").hidden = true;
  try {
    const entry = validateSubscription({
      id: newId(),
      name: $("subscription-name").value,
      costCents: parseCost($("subscription-cost").value),
      interval: $("subscription-interval").value,
      members: $("subscription-members").value.split(","),
    });
    subscriptions = [...subscriptions, entry];
    const saved = persist();
    render();
    $("subscription-form").reset();
    $("activity").textContent = `${entry.name} added.${saved ? " Saved in this browser." : " Changed for this session only."}`;
    $("subscription-name").focus();
  } catch (error) {
    $("form-error").textContent = error instanceof Error ? error.message : "Check the subscription details and try again.";
    $("form-error").hidden = false;
  }
});

try {
  storage = window.localStorage;
  const loaded = loadSubscriptions(storage);
  if (loaded === null) {
    subscriptions = [
      { id: "example-movies", name: "Movie nights", costCents: 1599, interval: "monthly", members: ["Alex", "Sam", "Jordan"] },
      { id: "example-music", name: "Family music", costCents: 1699, interval: "monthly", members: ["Alex", "Sam"] },
      { id: "example-cloud", name: "Shared cloud storage", costCents: 2999, interval: "yearly", members: ["Alex", "Sam", "Jordan"] },
    ];
    persist();
    $("activity").textContent = "A few examples to start. Delete them and add your household's subscriptions.";
  } else subscriptions = loaded;
} catch {
  persistenceBlocked = true;
  notice("Your saved budget could not be loaded. It has been left untouched. Changes on this page cannot persist and will be lost when you reload. Check your browser's storage settings or recover the saved data before reloading.");
}
render();
