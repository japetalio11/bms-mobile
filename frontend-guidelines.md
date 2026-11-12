# Silang Mobile Frontend Guidelines

Use this guide for UI changes in the Expo mobile app. The web application is a visual reference for Silang’s restrained clinical style, but mobile uses native layouts and HeroUI Native components. Preserve mobile touch sizing, safe areas, and navigation.

## Product and implementation

- Build phone-first screens. Keep primary tasks reachable, readable, and operable with touch.
- Use Expo Router for routes, HeroUI Native for controls, Uniwind for styling and theme variants, and shared components from `src/components/`.
- Use Phosphor icons only through `src/components/AppIcon.tsx`. The adapter maps legacy icon names to Phosphor components; do not import Ionicons directly or call the adapter `Ionicons` in new code.
- Use the shared `Header`, `AnimatedTabBar`, `MobileEmptyState`, and feedback components when they fit the screen.
- Load Manrope through the root layout. Reuse existing screen patterns before introducing another visual treatment.

## Color and theme

- The regular mobile app uses light mode: white canvas, near-white surfaces, dark foreground text, muted gray supporting text, and subtle neutral borders.
- Use semantic classes from `src/global.css` (`bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, and border tokens) for standard screen surfaces and controls.
- Authentication screens use the same light canvas and field geometry as the rest of the app. Keep the Silang green for restrained auth links and the yellow accent for primary actions.
- Use Silang yellow `#fffe8c` sparingly for primary actions, selected emphasis, and small accent elements. On yellow button or quick-action icon backgrounds, use black icons and text for contrast.
- Silang green `#003f2c` remains a brand color. Use green, amber, and red for clinical/workflow states with clear text labels; never rely on color alone.
- The Home dashboard has a dark, full-width pregnancy hero and a dark dose-tracking panel against the light app. These are deliberate exceptions; do not turn all Home content dark.
- Home’s lower content begins with a gentle yellow-tinted gradient that fades to white. Keep it subtle, low-contrast, and confined to the dashboard content below the hero. Avoid gradients on routine cards, controls, and other screens unless a specific design calls for one.

## Typography

- Use Manrope for interface text. Keep the interface to three sizes: 14px (`text-sm`), 16px (`text-base`), and 24px (`text-2xl`). Use 14px for metadata and supporting labels, 16px for body/control text, and 24px for screen or modal titles. Avoid one-off sizes and oversized display numerals.
- Use three weights: normal 400 for body copy, medium 500 for labels and controls, and semibold 600 for titles or key values. Avoid bold 700 in new UI.
- Titles use foreground color and concise supporting copy when the context benefits from it. Keep title and description aligned and close together. Avoid all-caps headings and redundant instructional paragraphs.
- Keep secondary text visibly quieter than primary content without reducing it below the 14px minimum.

## Spacing, shape, and interaction

- Use 16px horizontal screen gutters, 8px control gaps, 16px related-content spacing, and 24px between major sections. Align headings, cards, and controls to shared gutters.
- Keep touch targets at least 44px high or wide, including icon-only actions. Visual elements may be smaller inside the touch target.
- Use compact, consistent control radii around 6px. Use moderate card radii around 16–18px where a card is needed; reserve fully rounded shapes for circular icon buttons, avatars, and the floating navigation rail.
- Inputs and selects in the same form share a 44px touch height, 6px radius, border, fill, placeholder contrast, and label spacing. Keep labels about 6px above fields. Use the shared `AppInput`, `AppTextField`, and `AppButton` wrappers where possible, and HeroUI Native controls for specialized fields.
- Bottom sheets use HeroUI Native `BottomSheet` where possible. Match the shared sheet treatment: dim overlay, 20px horizontal padding, 24px top radius, and a 44px unfilled X touch target through `BottomSheetHeader` and `SheetCloseButton`. Keep a short title with only useful context beneath it, then leave 16–20px before the first control. Keep the same field tokens and control radius inside every sheet.
- Keep sheet content quiet: use spacing, alignment, and surface contrast instead of separator lines. Avoid explanatory paragraphs, repeated headings, nested bordered cards, and redundant cancel actions. Group related choices into simple touch rows; reserve filled color for the primary action and use a low contrast treatment for secondary actions. Scroll long content while keeping the action area easy to reach above the safe area.
- Standard app fields use the HeroUI field background, border, and placeholder tokens with a 6px radius and 44px touch target. The dark login and signup fields use the same geometry with their intentional dark auth palette.
- Prefer spacing and contrast to extra borders, nested cards, and dividers. Use separators only when they clarify distinct content groups.
- Give each action clear hierarchy. Primary actions use the yellow accent with dark text; secondary actions use a quiet neutral surface. Do not make every action visually prominent. Use short 180–220ms fades for newly displayed content and a horizontal slide for bottom navigation. Avoid scale or bounce effects on routine navigation.
- Show success, failure, and reminder feedback with HeroUI Native toasts rather than adding persistent explanatory UI to the screen.
- Provide accessible labels and selected/disabled states for icon-only and interactive controls. Add brief motion only when it clarifies a state change.

## Authentication screens

- Sign-in and sign-up use the same compact centered column, Manrope type, matching input geometry, and restrained brand accents as the current authentication screens.
- Use a 24px semibold title, 14px field labels and helper copy, and 16px input and button text. Keep fields and buttons at a consistent 44px height and 6px corner radius.
- Keep email/password labels visually quiet and consistent with each other. Password visibility and error feedback should not change layout unexpectedly.
- Google sign-in uses the multicolor Google mark. Do not add Apple sign-in or a back button to the initial login screen unless the user requests it.
- Signup may use clear, short steps. Preserve entered values and make progress and recovery actions obvious.

## Home dashboard and app shell

- The Home hero is edge-to-edge with no separate outer card margin. It contains a compact mother identity row, trimester subtitle, Active Pregnancy label and week, then two actions: New Appointment and Track Pregnancy. Keep the hero dark with white type; reserve yellow for the primary action.
- The mother name and trimester sit beside the person icon. Settings and notifications are the only hero actions; notification state uses a small accent dot.
- Quick actions are QR Connect, Upload EHR, Appointment History, and Messages. Lay them out evenly with 56px circular yellow icon surfaces, black Phosphor icons, and centered 14px labels. Start the subtle yellow-to-white dashboard gradient at this row and let it fade down behind lower Home content.
- Under quick actions, show the daily prescription dose tracker and appointment preview/list. Keep both compact and scannable. Appointment empty states should follow the web table empty-state content pattern: quiet icon, concise title, short explanation, and one relevant action when useful.
- The appointment heading shows the current month and year as a calendar link; “See all” is a yellow text link, not a filled button. Upcoming/Completed use a connected folder-like tab surface and compact visit cards.
- The floating bottom navigation has exactly two destinations: Home and EHR Records. Use a dark rounded rail with a large light selected pill; show the selected label and keep inactive destinations icon-only. Respect the bottom safe area and leave scroll content clear of the rail.
- Keep the shared header compact. Avoid duplicating global settings, notifications, or navigation controls inside page content.

## Data, loading, and empty states

- Prefer cached local data for immediate screen rendering, then refresh from the API when online. Keep offline and loading states understandable without exposing database or developer terminology.
- Use HeroUI Native skeletons when a screen or section is waiting on data long enough to disrupt the layout. Avoid replacing stable content with a spinner when cached content is available.
- Keep empty states concise and context-specific. Provide a next action only when there is a useful action for that state.
- Use toasts for successful create, update, delete, and messaging events. Use inline field errors only for the field currently being corrected.

## Current project progress snapshot

- The mobile project is an Expo Router app using HeroUI Native, Uniwind, Manrope, and Phosphor icons. The web and mobile repositories are separate; changes to this guide apply to the mobile repository.
- Authentication includes email/password, Google sign-in, phone/OTP flows, sign-up, and password recovery screens.
- Main mobile workflows present in the app include Home, appointments/calendar/history, QR connection, EHR upload and records, vitals, chat, profile/security/settings, notifications, and offline data support.
- Home already reads appointment and supplement data from local storage, refreshes from the API while online, and records a local daily dose log. Its no-appointment preview is a clearly marked UI preview, not a saved appointment.
- The dashboard hero, quick actions, dose tracker, and appointments are established. The Home iconography, colors, and two-item navigation have a shared direction; extend these patterns instead of adding unrelated styling.
- Continue checking authentication typography, screen-specific hard-coded colors, and large dashboard numerals against the three-size rule. Some existing screens still have legacy styling that should be aligned as they are revised.

## Review before finishing a screen

- Check a narrow phone viewport and the platform safe areas.
- Confirm type stays within the three-size and three-weight scale, touch targets remain comfortable, and labels/placeholders are readable.
- Check light mode on standard app screens and authentication, plus the deliberate dark treatment on the Home hero and folder panels.
- Confirm empty, loading, offline, and error states fit the same layout without causing jumps or overflow.
- Update this guide when a system-wide design decision changes.
