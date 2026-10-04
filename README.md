# SplitSeat

A household subscription tracker with monthly totals and equal member shares. Add a full bill in USD, choose monthly or yearly billing, and enter comma-separated member names. Names combine case-insensitively across subscriptions. Annual charges divide by 12, and amounts round only for display, so displayed member shares may add up a cent differently.

The light interface works on phones and desktops, supports keyboard navigation, and announces changes and errors. Subscription and member names render as text. No account, external service, runtime dependency, or build step is needed.

Serve the repository with `python3 -m http.server 8080`, then open `http://localhost:8080`. Native browser modules require HTTP hosting. Assets and module imports use relative paths, including when hosted at `/splitseat-membrane/` on GitHub Pages. Publish the repository root after owner approval.

Data stays in this browser and does not sync across devices. The app saves a versioned record under `splitseat:v1` in localStorage. Examples appear only when no saved record exists. Deleting every subscription saves an empty household, which stays empty after reload. Invalid saved records are left untouched and disable persistence for that page session. Storage write failures show a warning; edits remain usable in memory but can be lost on reload. The app does not automatically reset or repair saved data.

Run the service checks with `bun test tests/budget.test.js tests/storage.test.js`. Browser verification should cover add/delete, monthly/yearly billing, member merging, invalid input, reload, deleting the final entry, corrupt saved data and unavailable storage. Check keyboard focus and the layout at narrow and wide widths. These service checks alone do not verify the browser interface.

Development uses Membrane. The owner reviews task access, delivers pinned capsules, reviews reported decisions, prepares a checked candidate, and accepts it separately. Source checkout commits are not accepted Membrane revisions. Export accepted code before publishing. No deployment has been configured or started.
