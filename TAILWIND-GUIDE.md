# Tailwind CSS, using your own Search.jsx as the example

Tailwind doesn't work like normal CSS. Instead of writing a `.css` file with class definitions, you put small utility classes directly on the HTML/JSX element, and each class does exactly one thing. Once you can read the pattern, you can read (and change) almost any class in your project without looking anything up.

## The core idea

Normal CSS:
```css
.card { padding: 1.5rem; border-radius: 0.5rem; background: white; }
```
```html
<div class="card">...</div>
```

Tailwind — same result, no separate CSS file:
```html
<div class="p-6 rounded-lg bg-white">...</div>
```

`p-6` = padding, `rounded-lg` = border-radius, `bg-white` = background color. Every class is `{property}-{value}`. That's really the whole trick — once you know the property abbreviations and the value scale, you can read any class name cold.

## The spacing scale

Padding, margin, and gap all share one numeric scale, in steps of 4px: `1` = 4px, `2` = 8px, `4` = 16px, `6` = 24px, `8` = 32px, and so on (`p-4` = 16px of padding on all sides).

| Class | Meaning |
|---|---|
| `p-4` | padding on all 4 sides |
| `px-4` | padding left + right only |
| `py-4` | padding top + bottom only |
| `pt-4`, `pb-4`, `pl-4`, `pr-4` | padding on just one side |
| `m-4`, `mx-4`, `my-4`, `mt-4`... | same pattern, but margin |
| `gap-4` | space between flex/grid children |

From your `Search.jsx`, the search card:
```jsx
<div className="mt-5 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:max-w-3xl sm:p-6">
```
- `mt-5` — 20px of margin above the card
- `p-4` — 16px padding inside, on mobile
- `sm:p-6` — 24px padding inside, once the screen is `sm` size or wider (see responsive section below)

## Colors

Pattern is `{property}-{color}-{shade}`. Shades run from `50` (near-white) to `900` (near-black) in steps of 100.

| Class | Meaning |
|---|---|
| `bg-teal-700` | background color, teal, shade 700 (this is your brand color) |
| `text-gray-600` | text color, gray, shade 600 |
| `border-gray-200` | border color, gray, shade 200 (light) |

Try changing `teal-700` to `teal-600` or `teal-800` anywhere in your files — you'll immediately see the button/accent get lighter or darker. That's the fastest way to get a feel for the shade scale.

## Layout: flex and grid

These are the two you'll touch most when repositioning things.

`flex` — lay children out in a row (or column with `flex-col`):
```jsx
<div className="flex items-center justify-between gap-3">
  <span>Left</span>
  <span>Right</span>
</div>
```
- `items-center` — vertically centers the children
- `justify-between` — pushes the first child left and the last child right
- `gap-3` — 12px space between children

`grid` — lay children into a grid:
```jsx
<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
```
This is exactly what your "How It Works" section on the landing page uses: 2 columns on phones, 4 columns from `sm` up.

## Responsive design: mobile-first prefixes

Every class works "as-is" on the smallest screen. Adding a prefix like `sm:`, `md:`, or `lg:` means "apply this class once the screen is at least this wide, overriding whatever came before it."

| Prefix | Applies at screen width |
|---|---|
| (none) | always (mobile included) |
| `sm:` | ≥ 640px |
| `md:` | ≥ 768px |
| `lg:` | ≥ 1024px |

Example from your hero heading:
```jsx
<h1 className="text-xl font-bold ... sm:text-3xl lg:text-4xl">
```
Reads as: "text-xl by default (mobile), text-3xl once the screen is at least 640px wide, text-4xl once it's at least 1024px wide." Always design mobile-first: write the plain class for phones, then add `sm:`/`md:`/`lg:` overrides for bigger screens.

## Text sizing and weight

| Class | Meaning |
|---|---|
| `text-sm` / `text-base` / `text-lg` / `text-xl` / `text-2xl` / `text-3xl` | font size, smallest to largest |
| `font-medium` / `font-semibold` / `font-bold` | font weight |
| `text-center` | center-align text |
| `leading-relaxed` | line-height (spacing between lines) |

## Borders, rounding, shadows

| Class | Meaning |
|---|---|
| `border` | a 1px border, all sides |
| `border-gray-200` | ...colored light gray |
| `rounded-md` / `rounded-lg` / `rounded-full` | corner rounding, small to fully round |
| `shadow-sm` / `shadow-md` / `shadow-xl` | drop shadow, subtle to strong |

## States: hover, disabled, etc.

Add a prefix before the class you want to apply only in that state:
```jsx
<button className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50">
```
- On hover, background gets one shade darker.
- When the button is disabled, it fades to 50% opacity.

## Sizing

| Class | Meaning |
|---|---|
| `w-full` | width: 100% |
| `h-10` | height: 40px (same 4px-step scale as spacing) |
| `max-w-3xl` | caps the max width at a fixed breakpoint size |
| `mx-auto` | centers a block horizontally (margin-left/right: auto) |

## How to actually practice this on your landing page

1. Open `frontend/src/pages/Search.jsx` and your dev server (`npm run dev` in `frontend/`) side by side. Changes save-and-reload instantly.
2. Pick one small thing to change first — e.g. in the "Why Choose Evershine" section, find `bg-teal-50` on the feature icons and change it to `bg-blue-50`. Save, look at the browser, see what moved.
3. Use your browser's DevTools (right-click → Inspect) on any element on your live site. You can toggle classes on and off directly in DevTools to experiment before touching the actual file — nothing breaks, since it's not saved until you edit the .jsx file yourself.
4. When you want a class you don't know, search "tailwind [css property you want] class" — e.g. "tailwind letter spacing class" — the official docs (tailwindcss.com/docs) list every utility with live examples.
5. Keep the pattern in mind: `{property}-{value}`, optionally prefixed with a state (`hover:`) or breakpoint (`sm:`). Almost everything you'll ever need follows that shape.

## Quick reference: classes already in your Search.jsx

| Class you'll see | What it does |
|---|---|
| `mx-auto` | center the block horizontally |
| `max-w-5xl` | cap width so content doesn't stretch too wide on big screens |
| `px-4` | horizontal padding |
| `rounded-lg` | rounded corners |
| `border border-gray-200` | thin light-gray border |
| `bg-white` | white background |
| `shadow-sm` | subtle drop shadow |
| `text-gray-800` | dark gray text |
| `hover:bg-teal-800` | darker teal on hover |
| `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4` | 2 columns on phones, 4 on large screens |

Once these feel familiar, styling any section of the landing page is just: find the element in `Search.jsx`, change or add classes from this pattern, save, and look at the browser.
