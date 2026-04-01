# Nerve - Web Client Component Inventory

**Date:** 2026-04-02
**Part:** `web-client`

## Overview

The frontend is built around a small app shell layer, provider-based data access, a route/page layer, and a large shared UI primitive library in `src/components/ui/`. The most reusable assets are the shell components, provider hooks, and the UI primitive wrappers.

## Inventory Summary

- **Shared shell components:** 4
- **Provider/data hooks:** 2 primary hooks
- **Active routed page files:** 18
- **Legacy unrouted page files:** 5
- **Reusable UI primitive wrappers:** 49

## Shared Shell And Access Control

| File | Category | Purpose | Reuse Level |
| --- | --- | --- | --- |
| `src/components/AppLayout.tsx` | Shell | Authenticated page frame with loading/error handling | High |
| `src/components/AppSidebar.tsx` | Navigation | Role/team-based sidebar configuration | High |
| `src/components/RoleGuard.tsx` | Access control | Route gating by role and optional team | High |
| `src/components/NavLink.tsx` | Utility wrapper | Router `NavLink` compatibility wrapper | Medium |

## Provider And Data Orchestration Layer

| File | Purpose | Notes |
| --- | --- | --- |
| `src/hooks/useAuth.tsx` | Session restore, login/logout, dashboard redirect selection | Active auth source for routed UI |
| `src/hooks/useAppData.tsx` | Bootstrap fetch and CRUD mutations for shared app data | Active API-backed data source |
| `src/lib/api.ts` | Low-level REST client | Shared `/api` boundary |
| `src/lib/db.ts` | Legacy localStorage-backed store | Still referenced by older unrouted screens |

## Active Routed Pages

### Public And Support

| Route | File | Purpose | Data Source |
| --- | --- | --- | --- |
| `/login` | `src/pages/Login.tsx` | Session login form | `useAuth()` |
| `*` | `src/pages/NotFound.tsx` | Fallback route | none |

### Super Admin

| Route | File | Purpose | Data Source |
| --- | --- | --- | --- |
| `/super-admin/dashboard` | `src/pages/SuperAdminDashboard.tsx` | System-level summary dashboard | `useAppData()` |
| `/super-admin/users` | `src/pages/SuperAdminUsers.tsx` | User and team management | `useAppData()` |
| `/super-admin/settings` | `src/pages/SuperAdminSettings.tsx` | Administrative settings UI | mixed local UI state |

### Branding Team

| Route | File | Purpose | Data Source |
| --- | --- | --- | --- |
| `/branding/dashboard` | `src/pages/branding/BrandingAdminDashboard.tsx` | Branding admin dashboard | `useAppData()` |
| `/branding/sub-admin` | `src/pages/branding/BrandingSubAdminDashboard.tsx` | Branding lead dashboard | `useAppData()` |
| `/branding/user` | `src/pages/branding/BrandingUserDashboard.tsx` | Branding member workspace and branding-row actions | `useAppData()` |
| `/branding/team` | `src/pages/TeamPanel.tsx` | Team member list | `useAppData()` |

### Content Team

| Route | File | Purpose | Data Source |
| --- | --- | --- | --- |
| `/content/dashboard` | `src/pages/content/ContentAdminDashboard.tsx` | Content admin dashboard | `useAppData()` |
| `/content/sub-admin` | `src/pages/content/ContentSubAdminDashboard.tsx` | Content lead dashboard | `useAppData()` |
| `/content/user` | `src/pages/content/ContentUserDashboard.tsx` | Content member dashboard | `useAppData()` |
| `/content/team` | `src/pages/TeamPanel.tsx` | Team member list | `useAppData()` |

### Shared Tools

| Route | File | Purpose | Data Source |
| --- | --- | --- | --- |
| `/browse` | `src/pages/Browse.tsx` | Browse, filter, expand, and delete entries | `useAppData()` |
| `/add` | `src/pages/AddEntry.tsx` | Create new entries | `useAppData()` |
| `/team` | `src/pages/TeamPanel.tsx` | Team roster for privileged users | `useAppData()` |
| `/admin/export` | `src/pages/AdminExport.tsx` | Download JSON or CSV exports | `useAppData()` |
| `/ai/query` | `src/pages/AIQuery.tsx` | Ask-AI style query UI with local fallback | `useAppData()` |
| `/ai/newsletter` | `src/pages/AINewsletter.tsx` | Newsletter generator with local fallback | `useAppData()` |

## Legacy Unrouted Pages

These files remain useful reference material, but they are not imported by the active router:

| File | Purpose | Data Source |
| --- | --- | --- |
| `src/pages/Dashboard.tsx` | Older generic dashboard | `src/lib/db.ts` |
| `src/pages/SubAdminDashboard.tsx` | Older lead dashboard | `src/lib/db.ts` |
| `src/pages/UserDashboard.tsx` | Older end-user dashboard | `src/lib/db.ts` |
| `src/pages/AdminUsers.tsx` | Older user-management view | `src/lib/db.ts` |
| `src/pages/SubAdminPanel.tsx` | Older user panel | `src/lib/db.ts` |

## UI Primitive Library

### Form And Input Primitives

- `form.tsx`
- `input.tsx`
- `textarea.tsx`
- `select.tsx`
- `checkbox.tsx`
- `radio-group.tsx`
- `switch.tsx`
- `label.tsx`
- `input-otp.tsx`
- `calendar.tsx`
- `slider.tsx`

### Overlay, Navigation, And Menu Primitives

- `dialog.tsx`
- `alert-dialog.tsx`
- `drawer.tsx`
- `sheet.tsx`
- `dropdown-menu.tsx`
- `context-menu.tsx`
- `hover-card.tsx`
- `menubar.tsx`
- `navigation-menu.tsx`
- `popover.tsx`
- `tooltip.tsx`
- `breadcrumb.tsx`
- `sidebar.tsx`

### Layout, Display, And Data Primitives

- `accordion.tsx`
- `aspect-ratio.tsx`
- `avatar.tsx`
- `badge.tsx`
- `button.tsx`
- `card.tsx`
- `carousel.tsx`
- `chart.tsx`
- `collapsible.tsx`
- `pagination.tsx`
- `progress.tsx`
- `resizable.tsx`
- `scroll-area.tsx`
- `separator.tsx`
- `skeleton.tsx`
- `table.tsx`
- `tabs.tsx`
- `toggle.tsx`
- `toggle-group.tsx`

### Feedback And Utility Primitives

- `alert.tsx`
- `command.tsx`
- `sonner.tsx`
- `toast.tsx`
- `toaster.tsx`
- `use-toast.ts`

## Reuse Guidance

- Prefer the existing `ui/` wrappers over introducing raw Radix or bespoke component implementations.
- Put shared route-shell behavior in `AppLayout`, `RoleGuard`, or hooks rather than duplicating auth checks in pages.
- Prefer `useAppData()` for new routed features; avoid expanding the legacy `db.ts` dependency surface.
- If a legacy unrouted page is being reintroduced, first decide whether it should be migrated onto provider/API data before wiring it back into `App.tsx`.

## Brownfield Notes

- `TeamPanel.tsx` is shared across multiple routes and is a good reuse point for any future team/member directory work.
- `SuperAdminUsers.tsx` is the heaviest active admin screen and the main place to inspect current role/team management behavior.
- `AIQuery.tsx` and `AINewsletter.tsx` already provide fallback UX patterns for disconnected AI services.

---

_Generated using BMAD Method `document-project` workflow_
