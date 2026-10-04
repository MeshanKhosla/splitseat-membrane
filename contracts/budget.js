/**
 * Proposed v1 contract, to be reviewed at intake.
 * No external packages or network services are required.
 *
 * Subscription: { id: string, name: string, costCents: integer >= 0,
 *   interval: "monthly" | "yearly", members: nonempty unique string[] }.
 * Members are trimmed names, compared case-insensitively within an entry.
 * Currency is USD for v1. An entry is a recurring full subscription charge.
 * Each member pays an equal fraction of that entry's monthly equivalent.
 * Annual cost divides by 12. Keep fractional cents during aggregation and
 * round only for display; displayed shares may differ by a cent in sum.
 *
 * services/budget.js exports:
 * validateSubscription(value): Subscription, returning a normalized copy,
 *   throwing Error for invalid input. Never mutate the caller's value.
 * summarizeBudget(subscriptions): { monthlyTotalCents: number,
 *   memberShares: Array<{ name: string, monthlyCents: number }> }.
 *   Shares combine case-insensitive member names using first-seen spelling,
 *   sorted by name. Empty input returns zero and an empty shares array.
 *
 * services/storage.js exports:
 * loadSubscriptions(storage): Subscription[] | null.
 *   null means absent data; [] is a saved empty household.
 *   Invalid JSON or invalid entries throw Error. Never overwrite bad data.
 * saveSubscriptions(storage, subscriptions): void, throwing on write failure.
 *   storage has getItem(key) and setItem(key, value), as localStorage does.
 *   Persist { version: 1, subscriptions } under "splitseat:v1".
 *   Validate the complete list; reject duplicate ids before reads return
 *   data or writes happen. Budget validation defines valid entries.
 *
 * The browser seeds example entries only for absent data. It catches storage
 * errors and tells users changes cannot persist. A corrupt saved record must
 * not be replaced automatically. Delete the final entry and preserve [].
 */
