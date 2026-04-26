# Native `<details>` accordion + chevron pattern

Use this pattern anywhere we show a **disclosure** accordion (expand/collapse a section by clicking a header row), so the UI matches **Manager → Tasks → Shared** numeric groups.

## Canonical implementation

**File:** `components/manager/shared-numeric-tasks-accordion.tsx` (`SharedNumericTaskPanel`)

- **`group`** on `<details>` so Tailwind’s **`group-open:`** variant applies when the element is open (Tailwind **3.4+**).
- **`list-none`** on `<summary>` to hide the browser’s default disclosure marker.
- **`ChevronDown`** from `lucide-react` in the summary, right-aligned, with **`group-open:rotate-180`** for a clear open/closed affordance.
- **`aria-hidden`** on the chevron when the summary text is sufficient for screen readers.

```tsx
<details className="group rounded-lg border bg-card">
  <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50 flex flex-wrap items-center justify-between gap-2">
    <span className="min-w-0 truncate" title={title}>
      {title}
    </span>
    <ChevronDown
      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
      aria-hidden
    />
  </summary>
  <div className="border-t p-4">{/* body */}</div>
</details>
```

## Copy-paste checklist

| Location | Notes |
|----------|--------|
| Manager → Tasks → Regular | Per-employee `<details>` |
| Manager → Tasks → History | Per-day `<details>` |
| Manager → Tasks → Regular | Certificates block `<details>` |
| Manager → Attendance → History | Per-employee `<details>` |
| Manager → Leaves → History | Per-day `<details>` |
| Org **Tasks** page (`app/org/[orgSlug]/tasks/page.tsx`) | Pending approvals, certificates, history-by-date |
| **Task assignment** panel | Grouped by assignee (`components/shared/task-assignment-panel.tsx`) |

## When **not** to use this

- **Expandable table rows** (e.g. pending verification with `aria-expanded` on a **button**): keep **Button + ChevronUp/ChevronDown** toggled by React state.
- **Dropdown menus** or **top nav** chevrons: those are menu affordances, not `<details>` disclosure.

## Dependencies

- `lucide-react`: `ChevronDown`
- `tailwindcss` **^3.4** for `group-open:`

## Related

- Radix **Accordion** (`components/ui/accordion.tsx`) is available for animated height; native `<details>` is preferred for simple, zero-JS-boilerplate sections.
