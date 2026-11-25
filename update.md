# DentSync – change notes

## What changed
- **Calendar:** Week + Daily views, past dates/times disabled, Procedure dropdown, no double-booking, click a free slot to book.
- **Patients:** Last / First / Middle name, Age (auto from birthdate), required validated phone, duplicate check kept.
- **Billing:** pick a patient first (list incl. new patients) → Treatment tab (multi-procedure, auto cost + total, Payment Option, installment calculator) → Visit Records (per visit).
- **Roles:** Dentist (Dr. Mary Joy Carvajal-Morita), Business Partner (Tsuyoshi Morita), Assistant; permissions enforced in the UI.

## Single places to edit
`script.js`: `ROLES` (roles, names, access), `PROCEDURES` (procedure list + prices), `PAY_OPTIONS`, `HOURS` (clinic time slots).

## Final UI/UX refinements
- **Calendar:** toolbar is fixed (fixed-width title, Daily / Weekly / Monthly switch); Next/Previous only repaint the grid. New Monthly view (six-week grid, click a day to open it). Booking, past-date and conflict rules unchanged.
- **Patients panel:** removed the redundant "+ New Patient" button; registration form is always visible and sectioned (Personal, Contact, Address, Medical). Name order is First, Middle, Last. Birthdate is required; age is computed. Everything entered at registration (address, emergency contact, medical details) shows in the patient record and Edit dialog. Directory has filters: search, balance status, last visit, age group (balance/visit filters follow role permissions).
- **Announcements:** one toast format (bold action title + one detail line) with success / warning / error / info styles, shown only after the action completes: New Patient Added!, New Booking Created!, Patient Record Updated!, Treatment Record Updated!, Payment Recorded Successfully!, Note Added!, User Added!, plus warnings and errors.
- **Billing tooth logic:** Procedure now comes before Tooth. PROCEDURES in script.js carries a `scope` per procedure: Consultation and Cleaning = Full Mouth (locked); Filling and Extraction = one tooth (#1 to #32) required; X-ray = Full Mouth (panoramic) or one tooth. Changing the procedure updates or clears the tooth, invalid combinations are rejected on save, and it works on every row of a multi-procedure visit. Procedure names and prices are unchanged.
- **Assistant:** sample name "Jasmine Rivera" (role label stays "Assistant"), shown in the top bar, Users list and permission matrix.

## Final refinement round (workflow, search, installments, logout)
- **Patients:** the panel opens on the Patient Records table with one **+ New Patient** button. The registration form is its own view with a "< Patient Records" link back.
- **Duplicate detection (live):** while typing First/Middle/Last name the form compares against existing records (ignores case, accents, punctuation, extra spaces; middle initial counts as a match). A red warning appears under the name fields with an "Open record" link, and **Register Patient** is disabled. The separate "Check records" step is gone. Editing a patient into another patient's name is also blocked. A shared phone number only shows a soft note (relatives share numbers).
- **Register Patient** replaces "Create Account". After success: confirmation with **Book Appointment** (opens New Booking with the patient preselected) and **Back to Patient Records**.
- **One search:** the top-bar search is the only patient search. It filters Patient Records, or the Billing patient picker when you are on Billing. The duplicate search boxes in Patients and Billing were removed. Menu clicks start each module with the search cleared; the Patients "Clear" button also clears it.
- **Installments:** each installment plan stays attached to its treatment visit. New **Installments** tab in Billing (opens by default for a patient with an active plan) shows, per plan: total cost, duration, monthly amount, installments paid / remaining, total paid, balance, next due date, status, a month-by-month schedule (Paid / Partially Paid / Due / Overdue / Upcoming) and payment history. Billing summary shows "Next installment due"; the Billing patient list shows each patient's next installment status.
- **Recording payments:** "Record payment" on a schedule row, the header button, or a visit card all open one dialog, preselected to the next unpaid installment. An installment cannot be paid beyond what it still owes, so it cannot be recorded twice. Payments are appended (history is preserved) and totals, balance and statuses update immediately.
- **Logout:** native `confirm("Are you sure you want to log out?")`; Cancel keeps the session.
- **Sample data:** P-004 (Tumanan) has a demo plan matching the charter example (PHP 12,000, 6 months, PHP 2,000 monthly) with one paid, one partly paid and past due, and one due next. Existing records are unchanged.

## Final addendum (layout, multi-procedure booking, Billing integration)
- **Fixed layout:** header and sidebar stay in place; only the page content scrolls (one scrollbar, the window itself never scrolls). On phones the header and menu stay fixed and the content area scrolls beneath them.
- **New Booking:** a (+) beside Procedure adds another dropdown; each added one has a (−) to remove it. A procedure already chosen is disabled in the other dropdowns, and empty rows are rejected. A booking now stores a list of procedures (no tooth). The Calendar shows all of them.
- **Billing imports the appointment:** the Treatment tab has an Appointment selector (today's booking, else the latest earlier one, else the next upcoming). Its procedures appear as separate rows tagged **Booked**. Whole-mouth procedures (Cleaning, Consultation) get Full Mouth automatically; tooth-based ones (Extraction, Filling) start with the tooth unselected and the dropdown follows the existing procedure-to-tooth rules.
- **Additional procedures:** the (+) in Treatment adds a row tagged **Additional** with its own Procedure and Tooth fields and a (−) to remove it. Costs fill in automatically and the total updates on every change. Identical procedure and tooth entries are blocked.
- **Billing accuracy:** each booked row has a **Performed** box. Unticked procedures are not charged and are kept on the record as "Booked, not performed". Only performed procedures are saved and counted. Installment and payment logic is unchanged.
- **No duplicates:** saving marks the appointment as treated (shown as "✓ Treated" in the Calendar) so it is not imported again. The visit record shows booked vs additional procedures.
- **Demo data:** P-004 has a booking today (Cleaning, Extraction) and P-002 one tomorrow (Filling, X-ray), so the flow can be shown immediately.
