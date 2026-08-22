# Frontend Guidelines

This document outlines the standard UI/UX design rules to follow for consistency across the application.

## Typography

To maintain a clean and consistent hierarchy, limit font sizes to the following **three standard Tailwind classes**:

1. **`text-sm` (Small)**
   - **Usage**: Subtitles, metadata, placeholder text, and minor labels.
   - **Styling**: Often combined with `text-muted` (gray text) or `font-normal`.

2. **`text-base` (Medium / Base)**
   - **Usage**: Body text, input field text, main list items, standard button labels.
   - **Styling**: The default reading text size. Usually `text-white` and `font-medium`.

3. **`text-lg` (Large)**
   - **Usage**: Main page headers, primary section titles, large user names.
   - **Styling**: Typically combined with `font-semibold` and `text-white`.

**Do Not Use**: `text-xs`, `text-xl`, `text-2xl`, `text-3xl`, or any custom font size overrides unless explicitly building a unique graphic element (e.g. a large date counter).

## Border Radius

To keep the application's aesthetic consistent, all standard Card and container elements must use a uniform border radius that is rounded but not overly circular.

- **Standard Radius**: **`rounded-xl`**
- **Usage**: All `Card` components, custom View containers, SearchFields, and action Buttons.
- **Exceptions**: Avatars and icon-only circular buttons must use `rounded-full` to remain perfectly circular.
- **Do Not Use**: `rounded-2xl`, `rounded-3xl`, `rounded-[24px]` for standard containers.

## Headers

- Every main application screen must utilize the shared `<Header />` component from `src/components/Header.tsx`.
- The top-level header always shows the User Avatar on the left and the Settings Gear icon on the right.
- **Consistency**: Do not omit the settings gear icon on any primary tab screen (e.g., Home, Appointments). If a screen is a sub-page, use `showBackButton={true}` which will swap the Avatar for a back button, but still keep the standard layout.
