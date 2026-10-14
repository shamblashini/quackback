# Upstream candidates

Changes on `selfhost` (or noticed while working on it) that could go to
QuackbackIO/quackback. Newest first. Move an item to **Done** once its PR is
merged or the idea is dropped.

Every PR branch starts from `upstream/main`, never from `selfhost`. Commits
have no session or co-author trailers.

## Ready to PR

### Roadmap columns show two scrollbars

- **What:** each public roadmap column shows a dead scrollbar pinned at the
  top, next to the one that works.
- **Cause:** `components/public/roadmap-column.tsx` renders `<ScrollBar />`
  inside a `ScrollArea`, and `ScrollArea` already renders its own.
- **Fix:** delete that `<ScrollBar />` and its import. On selfhost: `5f6a051d8`.
- **Upstream:** still present on upstream/main (checked 2026-10-14).

### Changelog featured image is cropped

- **What:** on the public changelog entry page, the hero image is forced into
  a 2:1 box with `object-cover`. Wider and taller images get cut off.
- **Fix:** let it keep its own aspect ratio at full width (`block h-auto w-full`).
  On selfhost: `65421669d`.
- **Upstream:** still `object-cover aspect-[2/1]` on upstream/main.
- **Note:** a 2:1 crop could be a deliberate design choice. Frame the PR as
  "don't crop images that aren't 2:1".

### Slack changelog message links to the changelog index

- **What:** Slack's `changelog.published` message links `${rootUrl}/changelog`,
  not the entry itself. Discord (our PR) links the entry.
- **Fix:** one line in `integrations/slack/server/message.ts`.

### UI fixes on `fix/ui-polish` (needs a rebase on upstream/main)

- **Category dialog focus:** focus starts on the icon picker instead of the
  Name field. Not fixed upstream. Good PR.
- **Bare Enter in the changelog title submits the form:** not fixed upstream.
  Good PR.
- **Changelog admin list body preview:** this is a design preference, so the
  PR pitch is weaker.
- **Popover layering (z-index):** no reproduction on upstream yet. Find one
  first, or drop it.
- **Roadmap builder scroll:** already fixed upstream by #582. Drop it.
- **Commit messages:** two of them mention Radix; upstream now uses Base UI.
  Reword before the PR.

## Needs discussion first (open an issue)

### Editable announcement templates

- **What:** let admins edit the Discord/Slack message for events. Templates
  would use placeholders (`{title}`, `{url}`, `{excerpt}`, …), with an
  excerpt-length setting and a preview.
- **Why an issue first:** this is a product decision. It needs i18n in every
  locale, and maintainers will probably want it for Slack and Teams too.
- **Prerequisite:** the Discord changelog PR.

### Click below the text to focus the rich-text editor

- **What:** from `738ad2baf`. A click in the empty part of the editor pane
  focuses the end of the document.
- **Before proposing:** check whether upstream still has the problem.

## Selfhost only (not for upstream)

- **Changelog list without bodies** (`66c58b1ef`): a product preference.
- **Discord new-post messages show only the title** (`feef655a6`): a product
  preference.
- **Report boards and the `/reports` page:** a self-host feature.
- **Board reply policy (`4981efc73`):** upstream shipped its own version
  ("let a board limit replies to the post author"). Check whether ours is now
  redundant or conflicts with it.

## In flight

- **Discord changelog announcements:** branch
  `feat/discord-changelog-announcements` (`7ffce4979`), pushed to the fork.
  The PR is opened by hand.

## Done

- **Ukrainian locale:** merged upstream as #720. The maintainer followed up in
  #746.
