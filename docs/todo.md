# 📋 Textile Production & QC System — Full Project Log
> **Written in plain language for the team. Every feature, every button, every plan — explained simply.**

---

## ✅ WHAT WE HAVE BUILT SO FAR

### 🔐 1. Security & Login
- The system has a **secure login page**. No one can access anything without a username and password.
- There are different **roles**: Admin can do everything. Managers can create/edit orders. QC Officers can only submit quality reports.
- Passwords are encrypted. Nobody (not even us) can read them.

### 🏭 2. Two Production Tracks
We separated work into two lanes:

**Sampling Track (Blue)**
> Used when we are making a *new product prototype* for the first time.
- Create a new Sample Product with its name, category, vendor, and target deadline.
- Stages flow in order: Sample Start → Fabrication → Cutting → Embellishment → Stitching → Washing → Dispatch.

**Bulk Production Track (Green)**
> Used when a *confirmed order (PO)* comes in and we need to manufacture at scale.
- Create a Bulk Style with a PO number, vendor, and quantity.
- Stages flow in order: PP Sample → Fabrication → Cutting → Embellishment → Stitching → Top Wash → Finishing → Ex-Factory.

### 📅 3. Stage-by-Stage Tracking (The Timeline)
- When you open any order, you see a **horizontal bar** with all the stages like a checklist.
- The system **only shows you the current active stage** — the one the team is working on right now.
- All future stages are **locked** (shown with a padlock icon). They cannot be accessed until the previous stage is marked "Completed."
- When a stage is **completed**, the next one automatically unlocks.
- Each stage has:
  - **Phase Status**: Pending / In Progress / Completed.
  - **Target Days**: How many days this stage should take (set during order creation as a planning benchmark).
  - **Target Date**: The actual deadline date for this stage.
  - **Commencement Date**: The day the team actually *started* working.
  - **Final Completion Date**: The day the team actually *finished*.
  - **Unit/Floor Remarks**: Any notes from the floor about issues or delays.

### ⏱️ 4. Performance Tracking (SLA System)
- When creating an order, you **pre-assign target days** for each stage (e.g., Fabrication = 3 days, Cutting = 2 days).
- These are **not hard limits** — the team can still work beyond them — but the system uses them to track if the team is on time or late.
- If a stage goes past its Target Date, it turns **Red** and shows "Late Phase."
- If it's on time, it stays **Green** and shows "On Track."

### 📦 5. Vendor Management
- We maintain a list of all our vendors (manufacturers/suppliers).
- Each order is linked to a vendor.

### 📊 6. Quality Control (QC) Reports
- QC Officers can fill in a **digital inspection form** for any order.
- The system auto-calculates:
  - **DHU%** = Defects per 100 units (lower is better).
  - **FPY%** = First Pass Yield — how many pieces passed quality on the first check (higher is better).
- Managers can **Approve or Reject** QC reports.
- There's a library of standard **defect codes** so everyone uses the same language.

### 📈 7. Dashboard & Reports
- Visual charts showing: total orders, delays, QC pass rates.
- Export data to **PDF** and **Excel** for sharing with the client or management.

---

## 🔜 WHAT WE ARE BUILDING NEXT

### Phase 6: Smart Auto-Dates & Audit Stage
> Priority: HIGH | Status: Planning

---

#### Feature 1: Auto-Calculate Completion Date from Target Days
**In simple words:** When you enter a Target Date for a stage, the system should automatically fill in the "Completion Date" by counting the number of pre-assigned target days forward from that date.

*Example: If Target Date is May 10 and Target Days = 2, the system should auto-suggest May 12 as the expected completion.*

**What needs to be built:**
- [ ] Frontend: When Target Date field is filled, auto-calculate and pre-fill "Completion Date" field.
- [ ] The user can still manually override it if needed.

---

#### Feature 2: AUDIT Stage (Sampling Track — Final Review)
**In simple words:** After all production stages are done for a sample, a final "Audit" review stage automatically appears. This is the formal sign-off before the sample is closed or promoted to bulk production.

**The Audit Stage (default view) will have:**

- [ ] **Document Upload**: Attach any file — PDF, Word, PPT, Excel — like a tech pack, approval form, or client sign-off letter.
- [ ] **Before & After Photos**:
  - Upload a "Before" photo (the raw/original state).
  - Upload an "After" photo (the final finished product).
  - Both photos show on the order card in the main list, side by side.
- [ ] **"Move to Bulk" Button**: A big action button that, when clicked, opens a small confirmation form.

**What appears ONLY when "Move to Bulk" is clicked:**

- [ ] **PO Number Field**: Enter the official Purchase Order number that the client has issued for the bulk run.
- [ ] **Change Vendor Option**: If a different vendor will handle the bulk production (instead of the sample vendor), select the new one here.
- [ ] **Confirm Button**: After filling PO + Vendor, clicking Confirm will:
  - Automatically create the order in the **Bulk Production Track** with the new PO and vendor.
  - Remove the sample from the Sampling page.
  - The Bulk order starts fresh with all bulk stages unlocked from the beginning.

> **Why this way?** Most of the time the user just wants to upload docs and photos. The PO + Vendor details only matter at the exact moment of promotion to bulk — so we don't clutter the screen with them unless needed.

---

#### Feature 3: AUDIT Stage (Bulk Production Track — Final Review)
**In simple words:** After all production stages are done for a bulk order, a final "Audit" review stage appears for final documentation before shipment.

**The Bulk Audit Stage will have (same as Sampling but simpler):**

- [ ] **Document Upload**: Attach shipping docs, packing lists, QC sign-off, etc. (PDF, Word, Excel, PPT).
- [ ] **Before & After Photos**: Upload and display photos of the finished packed goods on the order card.
- [ ] **"Ready for Shipment"** button to mark the entire order as closed/shipped.
- [ ] No "Move to Bulk" or PO/Vendor change options — already in bulk, already has a PO.

---

#### Feature 4: Vendor Sheets (Two Separate Views)
**In simple words:** Each vendor should have a profile page that shows two tabs — one for all their Sampling work and one for all their Bulk Production work.

- [ ] Vendor detail page with two tabs: **Sampling History** | **Bulk History**
- [ ] Each tab shows all orders linked to that vendor, their status, and SLA performance.

---

## 🗺️ BUTTON & FEATURE GLOSSARY
> *For the team — what every button does, in plain English.*

| Button / Label | Where It Is | What It Does |
|---|---|---|
| **Initiate New Sample** | Sampling page (top right) | Opens a form to register a new sample development project |
| **Register Style & PO** | Bulk page (top right) | Opens a form to register a new bulk production order |
| **Stage Button (e.g., FABRICATION)** | Order detail, horizontal bar | Click to view that specific production stage |
| 🔒 *Lock icon on stage* | Order detail, horizontal bar | This stage is locked. You must complete the previous stage first |
| ✅ *Green checkmark on stage* | Order detail, horizontal bar | This stage has been completed |
| **Update Status** | Active stage card | Opens edit mode for the current stage — change dates, status, notes |
| **SAVE** | Stage edit mode | Saves all changes. If marked "Completed", unlocks the next stage |
| **CANCEL** | Stage edit mode | Exits edit mode without saving any changes |
| **Phase Status Dropdown** | Stage edit mode | Change the stage between: Pending / In Progress / Completed |
| **Target Days** | Stage edit mode | How many days this stage is planned to take (performance benchmark) |
| **Target Date** | Stage edit mode | The deadline for this stage to be finished |
| **Commencement Date** | Stage edit mode | The actual day work started on this stage |
| **Final Completion Date** | Stage edit mode | The actual day work finished on this stage |
| **Unit/Floor Remarks** | Stage edit mode | Notes from the production floor (delays, issues, special instructions) |
| **Generate QC Report** | Order sidebar | Opens a QC inspection form for this order |
| **Production Track Tab** | Order detail | Shows the stage-by-stage timeline view |
| **Tech Block Tab** | Order detail | Shows technical notes and requirements for the order |
| **← Back Arrow** | Order detail (top left) | Goes back to the orders list page |

---

## 📌 KNOWN ISSUES & TECH NOTES

- Backend runs locally on port 8000 (FastAPI).
- Frontend runs locally on port 3000 (Next.js).
- Database: SQLite (local file — `textile_qc.db`).
- Stage target durations are **performance benchmarks only**, not hard system locks.
- The system runs natively on the Mac without Docker.
