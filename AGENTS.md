<!-- HEROUI-NATIVE-AGENTS-MD-START -->

[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output AGENTS.md|.:{components\(buttons)\button.mdx,components\(buttons)\close-button.mdx,components\(buttons)\link-button.mdx,components\(collections)\menu.mdx,components\(collections)\tag-group.mdx,components\(controls)\slider.mdx,components\(controls)\switch.mdx,components\(data-display)\chip.mdx,components\(feedback)\alert.mdx,components\(feedback)\skeleton-group.mdx,components\(feedback)\skeleton.mdx,components\(feedback)\spinner.mdx,components\(forms)\checkbox.mdx,components\(forms)\control-field.mdx,components\(forms)\description.mdx,components\(forms)\field-error.mdx,components\(forms)\input-group.mdx,components\(forms)\input-otp.mdx,components\(forms)\input.mdx,components\(forms)\label.mdx,components\(forms)\radio-group.mdx,components\(forms)\search-field.mdx,components\(forms)\select.mdx,components\(forms)\text-area.mdx,components\(forms)\text-field.mdx,components\(layout)\card.mdx,components\(layout)\separator.mdx,components\(layout)\surface.mdx,components\(media)\avatar.mdx,components\(navigation)\accordion.mdx,components\(navigation)\list-group.mdx,components\(navigation)\tabs.mdx,components\(overlays)\bottom-sheet.mdx,components\(overlays)\dialog.mdx,components\(overlays)\popover.mdx,components\(overlays)\toast.mdx,components\(typography)\text.mdx,components\(utilities)\pressable-feedback.mdx,components\(utilities)\scroll-shadow.mdx,components\index.mdx,getting-started\(handbook)\animation.mdx,getting-started\(handbook)\colors.mdx,getting-started\(handbook)\composition.mdx,getting-started\(handbook)\portal.mdx,getting-started\(handbook)\provider.mdx,getting-started\(handbook)\styling.mdx,getting-started\(handbook)\theming.mdx,getting-started\(overview)\design-principles.mdx,getting-started\(overview)\quick-start.mdx,getting-started\(ui-for-agents)\agent-skills.mdx,getting-started\(ui-for-agents)\agents-md.mdx,getting-started\(ui-for-agents)\llms-txt.mdx,getting-started\(ui-for-agents)\mcp-server.mdx,getting-started\index.mdx,releases\beta-10.mdx,releases\beta-11.mdx,releases\beta-12.mdx,releases\beta-13.mdx,releases\cli-v1-0-0.mdx,releases\index.mdx,releases\rc-1.mdx,releases\rc-2.mdx,releases\rc-3.mdx,releases\rc-4.mdx,releases\v1-0-0.mdx,releases\v1-0-1.mdx,releases\v1-0-2.mdx,releases\v1-0-3.mdx,releases\v1-0-4.mdx,releases\v1-0-5.mdx,releases\v1-0-6.mdx,releases\v1-0-7.mdx,releases\v1-0-8.mdx}
<!-- HEROUI-NATIVE-AGENTS-MD-END -->

---

# Clean Code & No Comments Rule (STRICT)
1. **No Unnecessary Code Comments**: Do NOT add explanatory comments, inline explanations, or narrative text describing what code does. Write clean, self-documenting code.
2. **No Section Dividers or Decorative Banners**: Do NOT add comment dividers, section headers, or ASCII banners.
3. **No TODOs or Meta Commentary**: Never leave `// TODO`, `// NOTE`, or AI self-referential notes.
4. **Exceptions Only When Mandatory**: Only include comments if explicitly requested by the user or strictly required for compiler/linter directives.

---

## 📌 Notion Sprint Auto-Ticket Creation on Git Push (MANDATORY)

Whenever the AI is requested to push changes (or commit and push) to git for this repository (`bms-mobile`):

The AI **MUST automatically create and log a corresponding Sprint Ticket in Notion** to ensure the sprint boards remain continuously updated and reflect active development:

1. **Target Notion Agile Board**:
   - **Mobile Application Agile Board (BMS Mobile)** (`database_id: 3f88e9dc-d486-81bd-b099-dce39a1e83eb`) | Prefix: `BMS-MOB-###`

2. **Mandatory Ticket Fields**:
   - **`Task Name`**: Action-oriented, descriptive title of what was delivered.
   - **`Ticket ID`**: Next sequential ticket ID for that board.
   - **`Status`**: `Done` for completed/shipped tasks, or `In Review / QA` / `In Progress` for active branches.
   - **`Sprint`**: The current active sprint (e.g., `Sprint 6 - Multi-Tenant Facility Isolation & SuperAdmin`).
   - **`Type`**: `User Story`, `Technical Task`, `Bug / Defect`, `Security & Audit`, or `Architecture`.
   - **`Priority`**: `Critical`, `High`, `Medium`, or `Low`.
   - **`Module`**: Targeted architectural or clinical module.
   - **`Story Points`**: Fibonacci estimation (1, 2, 3, 5, or 8).
   - **`Assignee`**: Developer name (`Patrick Villamer` or role).

3. **Mandatory Card Body Content**:
   Each created ticket page must contain:
   - `## 📋 User Story & Description`: Technical and clinical motivation for the change.
   - `### ✅ Acceptance Criteria (Definition of Done)`: Checkbox list of verifiable criteria.
   - `### 🛠️ Implementation Details & Codebase Artifacts`: Specific commit hash, key files changed, and affected screens/components.

4. **Workflow Execution**:
   - After executing `git commit` and `git push`, invoke Notion MCP (`API-post-page`) or Notion API to create the ticket.
   - Report the created Ticket ID, Notion URL, and sprint status in the response to the user.

