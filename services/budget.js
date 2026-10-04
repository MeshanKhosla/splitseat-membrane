function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a nonempty name.`);
  }
  return value.trim();
}

export function validateSubscription(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Subscription must be an object.");
  }
  const id = requiredText(value.id, "Subscription id");
  const name = requiredText(value.name, "Subscription name");
  if (!Number.isSafeInteger(value.costCents) || value.costCents < 0) {
    throw new Error("Cost must be a nonnegative safe integer in cents.");
  }
  if (value.interval !== "monthly" && value.interval !== "yearly") {
    throw new Error("Interval must be monthly or yearly.");
  }
  if (!Array.isArray(value.members) || value.members.length === 0) {
    throw new Error("Choose at least one household member.");
  }
  const members = Array.from(value.members, member => requiredText(member, "Member"));
  if (new Set(members.map(member => member.toLowerCase())).size !== members.length) {
    throw new Error("Each member may appear only once per subscription.");
  }
  return { id, name, costCents: value.costCents, interval: value.interval, members };
}

export function summarizeBudget(subscriptions) {
  if (!Array.isArray(subscriptions)) throw new Error("Subscriptions must be a list.");
  let monthlyTotalCents = 0;
  const shares = new Map();
  for (const value of subscriptions) {
    const entry = validateSubscription(value);
    const monthlyCents = entry.costCents / (entry.interval === "yearly" ? 12 : 1);
    monthlyTotalCents += monthlyCents;
    if (!Number.isFinite(monthlyTotalCents)) throw new Error("Budget total is too large.");
    for (const name of entry.members) {
      const key = name.toLowerCase();
      const share = shares.get(key) ?? { name, monthlyCents: 0 };
      share.monthlyCents += monthlyCents / entry.members.length;
      shares.set(key, share);
    }
  }
  const memberShares = [...shares.values()].sort((a, b) => {
    const first = a.name.toLowerCase();
    const second = b.name.toLowerCase();
    return first < second ? -1 : first > second ? 1 : 0;
  });
  return { monthlyTotalCents, memberShares };
}
