<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CRITICAL WORK PROTECTION RULES
1. **NO DESTRUCTIVE ACTIONS ON UNSTAGED WORK:** Do NOT run `git checkout --`, `git reset --hard`, or any commands that discard modified/unstaged files without first asking the user or committing them.
2. **AUTOMATIC BACKUPS:** Always copy a file to a `.bak` version or run a git checkpoint commit (`git commit -am "checkpoint: ..."`) before performing substantial manual or automated changes on files modified by the user (especially `app/page.tsx`).
3. **CHECKPOINT ON DEMAND:** Whenever the user says "checkpoint" or "save", immediately commit all unstaged files so their progress is saved in git history.

# ATELIER NOIR PREMIUM DESIGN SYSTEM RULES
All UI components, pages, and mockups created or modified must strictly adhere to the brand guidelines:
1. **Strict 0px Border-Radius:** Always use `rounded-none` on all elements, buttons, inputs, containers, modals, and cards. Never use standard rounded classes (such as `rounded`, `rounded-lg`, `rounded-full`, etc.) unless specifically requested.
2. **Atelier Noir Palette:** Use the defined theme variables:
   - Primary surface background: Warm bone `#faf9f8` / `--color-surface`
   - Foreground / text / primary buttons: Dark charcoal `#1a1c1c` / `--color-on-surface`
   - Accents / borders: Gold `#775a19` / `--color-secondary`
3. **Editorial Typography:** Ensure buttons, labels, and subheadings utilize bold uppercase text with wide tracking (e.g. `tracking-[0.2em] text-[10px] font-black uppercase`).
4. **No Raw Emojis:** Do not include raw emoji characters (such as ✅, ❌, 🚚, 📦, 🖨️) in user-facing layouts. Replace them with custom, clean vector SVG line-art icons styled in black or gold.
5. **High-Contrast Brutalist Grids:** Structure detail cards and lists with thin outline borders (e.g. `border border-on-surface/10` or `border-[#7f7667]/20`) and sharp divisions rather than floating shadow cards.

# PHASE 3 PREPARATION: FROZEN MODULES
The following Phase 2 subsystems are fully frozen and stabilized. Do NOT modify them in Phase 3 unless a production-critical bug is explicitly reported:
1. **Payment Module**: `lib/db/payments.ts`, `app/api/payments/**`, `app/api/webhooks/razorpay/**`
2. **Inventory & Reservation**: `lib/db/inventory.ts`
3. **Finance & Analytics**: `lib/db/analytics.ts`
4. **Invoice Generation**: `app/invoice/**`, `lib/invoice-template.ts`
5. **Shiprocket Sync**: `lib/db/shipments.ts`, `lib/shiprocket.ts`, `app/api/webhooks/shiprocket/**`
6. **Order Lifecycle**: `lib/db/orders.ts` (specifically `transitionOrderStatus` state machine logic).

