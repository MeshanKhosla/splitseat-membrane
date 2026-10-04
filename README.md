# SplitSeat

A shared-subscription budget tracker for households. This commit reserves the v1 file inventory; app implementation awaits Membrane owner review.

Planned v1 includes recurring monthly and yearly entries, household members, monthly totals, equal per-member shares, adding and deleting entries, a first-visit example, and local browser persistence. USD is the proposed v1 currency. Data stays in this browser and does not sync across devices.

Run checks with `bun test tests/budget.test.js tests/storage.test.js`. The scaffold tests are explicit TODOs, not evidence that the app works.

Serve the repository with a static HTTP server, such as `python3 -m http.server 8080`, and open `http://localhost:8080`. Relative asset paths and native browser modules support GitHub Pages under a repository subpath. No build step, paid API, credentials, or runtime dependencies are planned.

Development uses Membrane. The owner reviews the outside-Git intake configuration and task scopes, delivers pinned capsules, reviews reported decisions, prepares a checked candidate, and accepts it separately. Source checkout commits are not accepted Membrane revisions. Publishing requires separate owner authorization. After accepted code is exported to the repository, GitHub Pages can publish the repository root. No deployment has been configured or started.
