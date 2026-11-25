/* ---- helpers (defined first so the login/session code below can use them) ---- */
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var peso = function (n) { n = Number(n) || 0; return "₱ " + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
function on(sel, fn) { $(sel).addEventListener("click", function (e) { e.preventDefault(); fn(e); }); }
function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function parseYmd(s) { return new Date(s + "T00:00"); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(s) { return parseYmd(s).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); }
function fmtLong(d) { return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
function hourLabel(h) { return (h % 12 || 12) + ":00 " + (h < 12 ? "AM" : "PM"); }
function money(n) { return Math.round(n * 100) / 100; }

var TOAST_ICON = { ok: "✓", warn: "!", err: "✕", info: "i" };
function notify(kind, title, detail) {
    var box = document.getElementById("toasts"), t = document.createElement("div");
    t.className = "toast " + kind;
    t.setAttribute("role", kind == "err" || kind == "warn" ? "alert" : "status");
    t.innerHTML = '<span class="toast-ic" aria-hidden="true">' + TOAST_ICON[kind] + '</span><div class="toast-tx"><b>' + esc(title) + "</b>" + (detail ? "<span>" + esc(detail) + "</span>" : "") + '</div><button type="button" class="toast-x" aria-label="Dismiss announcement">×</button>';
    function close() { if (t.parentNode) t.parentNode.removeChild(t); }
    t.querySelector(".toast-x").onclick = close;
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(close, kind == "err" || kind == "warn" ? 8000 : 5000);
}

var ROLES = {
    dentist: {
        label: "Dentist", name: "Dr. Mary Joy Carvajal-Morita", initials: "MJ", level: "Full",
        desc: "Clinic owner. Full access to every module, including Users and Roles.",
        pages: ["calendar", "patients", "patient", "billing", "settings"],
        can: { book: true, managePatients: true, clinical: true, billing: true },
        matrix: ["Full", "Full", "Full", "Full"]
    },
    partner: {
        label: "Business Partner", name: "Tsuyoshi Morita", initials: "TM", level: "Broad",
        desc: "Oversees clinic finances and records. Cannot manage users and roles.",
        pages: ["calendar", "patients", "patient", "billing"],
        can: { book: true, managePatients: true, clinical: true, billing: true },
        matrix: ["Full", "Full", "Full", "No"]
    },
    assistant: {
        label: "Assistant", name: "Jasmine Rivera", initials: "JR", level: "Restricted",
        desc: "Logistics only: views the schedule and basic patient contact details. No medical, treatment or billing data.",
        pages: ["calendar", "patients", "patient"],
        can: { book: false, managePatients: false, clinical: false, billing: false },
        matrix: ["View", "Contact", "No", "No"]
    }
};
var loginBox = document.getElementById("login");
var app = document.getElementById("app");
var pages = document.querySelectorAll(".page");
var navLinks = document.querySelectorAll(".nav a");
var pageLinks = document.querySelectorAll("[data-page]");
var currentRole = sessionStorage.getItem("dentsyncRole");
if (!ROLES[currentRole]) currentRole = null;
function can(action) { return !!(currentRole && ROLES[currentRole].can[action]); }

function applyRolePermissions() {
    var r = currentRole ? ROLES[currentRole] : null, allowed = r ? r.pages : [];
    navLinks.forEach(function (link) { link.hidden = allowed.indexOf(link.dataset.page) === -1; });
    if (r) {
        $(".u-name").textContent = r.name;
        $(".u-role").textContent = r.label;
        $(".avatar").textContent = r.initials;
    }
    $("#newBooking").hidden = !can("book");
    $("#bookBtn").hidden = !can("book");
    $("#newPatientBtn").hidden = !can("managePatients");
    $("#npMedical").hidden = !can("clinical");
    $("#fbBalance").hidden = !can("billing");
    $("#fbVisit").hidden = !can("clinical");
    $("#editPatientBtn").hidden = !can("managePatients");
}

function showPage(name) {
    if (!currentRole) return;
    if (ROLES[currentRole].pages.indexOf(name) === -1) name = "calendar";
    if (name == "patient" && !cur) name = "patients"; /* never open a patient nobody chose */
    loginBox.style.display = "none";
    app.style.display = "flex";

    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove("active");
    }
    document.getElementById(name).classList.add("active");
    if (name == "patients") setPatView("list");
    document.getElementById(name).scrollTop = 0;

    var navName = name;
    if (name == "patient") {
        navName = "patients";
    }

    for (var j = 0; j < navLinks.length; j++) {
        navLinks[j].classList.remove("active");
        navLinks[j].removeAttribute("aria-current");
        if (navLinks[j].dataset.page == navName) {
            navLinks[j].classList.add("active");
            navLinks[j].setAttribute("aria-current", "page");
        }
    }
    if (name == "billing") renderBilling();
}

for (var i = 0; i < pageLinks.length; i++) {
    pageLinks[i].addEventListener("click", function (e) {
        e.preventDefault();
        if (this.closest(".nav")) { $("#search").value = ""; renderPatients(); renderBillPatients(""); } /* the one shared search starts empty in each module */
        if (this.dataset.page == "billing") billPatient = null; /* opening Billing from the menu always starts at the patient list */
        showPage(this.dataset.page);
    });
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var roleSelect = $("#role");
    if (!roleSelect.value) {
        $("#loginStatus").textContent = "Please select a role.";
        roleSelect.focus();
        return;
    }
    currentRole = roleSelect.value;
    sessionStorage.setItem("dentsyncRole", currentRole);
    applyRolePermissions();
    renderAll();
    var allowed = ROLES[currentRole].pages;
    var hashName = location.hash ? location.hash.slice(1) : "";
    showPage(allowed.indexOf(hashName) !== -1 ? hashName : "calendar");
});

var PROCEDURES = [
    { name: "Consultation", price: 500, scope: "whole" },
    { name: "X-ray", price: 200, scope: "either" },
    { name: "Cleaning", price: 800, scope: "whole" },
    { name: "Filling", price: 1500, scope: "tooth" },
    { name: "Extraction", price: 2000, scope: "tooth" }
];
var FULL_MOUTH = "Full Mouth";
function scopeOf(name) { var p = PROCEDURES.filter(function (x) { return x.name == name; })[0]; return p ? p.scope : null; }
function isToothNo(t) { var m = /^#(\d{1,2})$/.exec(t || ""); return !!m && +m[1] >= 1 && +m[1] <= 32; }
function toothFits(proc, tooth) {
    var sc = scopeOf(proc);
    if (sc == "whole") return tooth == FULL_MOUTH;
    if (sc == "tooth") return isToothNo(tooth);
    if (sc == "either") return tooth == FULL_MOUTH || isToothNo(tooth);
    return false;
}
function priceOf(name) { var p = PROCEDURES.filter(function (x) { return x.name == name; })[0]; return p ? p.price : 0; }
var DENTIST = "Dr. Mary Joy Carvajal-Morita";
var PAY_OPTIONS = ["Full Payment", "Installment"];
var MAX_ROWS = 10;
var HOURS = [9, 10, 11, 12, 13, 14, 15];

var visitSeq = 0;
function mkVisit(ago, items, option, months, paid) {
    var date = ymd(addDays(new Date(), -ago)), total = 0;
    var its = items.map(function (i) { var c = priceOf(i[1]); total += c; return { tooth: i[0], proc: i[1], cost: c }; });
    var v = { id: "V-" + (++visitSeq), date: date, dentist: DENTIST, items: its, option: option, months: months || 0, monthly: 0, payments: paid ? [{ date: date, amount: paid, inst: 0 }] : [], note: "" };
    if (option == "Installment") v.monthly = money((total - paid) / months);
    return v;
}
var patients = [
    { id: "P-002", last: "Maralit", first: "Trishia Anne", middle: "M.", age: 20, birth: "2006-11-02", phone: "0917 100 0002", address: "Sampaloc, Manila", emergency: "Parent · 0917 200 0002", notes: [],
      visits: [mkVisit(58, [["#14", "Filling"]], "Full Payment", 0, 1500), mkVisit(23, [["#26", "Extraction"]], "Installment", 3, 800), mkVisit(2, [["Full Mouth", "Cleaning"], ["Full Mouth", "X-ray"]], "Full Payment", 0, 1000)] },
    { id: "P-003", last: "Pido", first: "Lysa Joy", middle: "T.", age: 21, birth: "2005-03-14", phone: "0917 100 0003", address: "Ermita, Manila", emergency: "Parent · 0917 200 0003", notes: [],
      visits: [mkVisit(200, [["#26", "Extraction"]], "Installment", 6, 800)] },
    { id: "P-004", last: "Tumanan", first: "Lance Amwel", middle: "B.", age: 22, birth: "2004-08-09", phone: "0917 100 0004", address: "Tondo, Manila", emergency: "Parent · 0917 200 0004", notes: [],
      visits: [mkVisit(30, [["Full Mouth", "Consultation"]], "Full Payment", 0, 500)] },
    { id: "P-005", last: "Dela Cruz", first: "Grace", middle: "R.", age: 21, birth: "2005-06-21", phone: "0917 100 0005", address: "Paco, Manila", emergency: "Parent · 0917 200 0005", notes: [],
      visits: [mkVisit(120, [["#3", "X-ray"]], "Full Payment", 0, 200)] },
    { id: "P-006", last: "Nieves", first: "Andrea Kaye", middle: "P.", age: 21, birth: "2005-01-30", phone: "0917 100 0006", address: "Malate, Manila", emergency: "Parent · 0917 200 0006", notes: [],
      visits: [mkVisit(98, [["#14", "Filling"]], "Installment", 2, 500)] }
];

(function seedPlan() {
    var v = mkVisit(75, [["#1", "Extraction"], ["#16", "Extraction"], ["#17", "Extraction"], ["#9", "Filling"], ["#10", "Filling"], ["#11", "Filling"], ["#12", "Filling"]], "Installment", 6, 0);
    v.payments.push({ date: ymd(addDays(new Date(), -45)), amount: 2000, inst: 1 });
    v.payments.push({ date: ymd(addDays(new Date(), -14)), amount: 800, inst: 2 });
    patients[2].visits.push(v);
})();
var users = [[ROLES.dentist.name, ROLES.dentist.label, "Active"], [ROLES.partner.name, ROLES.partner.label, "Active"], [ROLES.assistant.name, ROLES.assistant.label, "Active"]];
var cur = null, tab = "overview";

/* ---- patient helpers ---- */
function initial(m) { m = (m || "").trim(); return m ? m.charAt(0).toUpperCase() + "." : ""; }
function fullName(p) { return p.last + ", " + p.first + (p.middle ? " " + initial(p.middle) : ""); }
function patientById(id) { return patients.filter(function (p) { return p.id == id; })[0]; }
function sortedPatients() {
    return patients.slice().sort(function (a, b) { return (a.last + a.first).toLowerCase() < (b.last + b.first).toLowerCase() ? -1 : 1; });
}
function matchPatient(p, q) {
    var hay = [p.id, p.last, p.first, p.middle, p.last + " " + p.first, p.first + " " + p.last, p.phone, (p.phone || "").replace(/\s/g, "")].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (t) { return !t || hay.indexOf(t) > -1; });
}
function ageFromBirth(b) { var d = parseYmd(b), n = new Date(), a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }
function ageOf(p) { return p.birth ? ageFromBirth(p.birth) : p.age; }

/* ---- visit / billing helpers ---- */
function vTotal(v) { return money(v.items.reduce(function (a, i) { return a + i.cost; }, 0)); }
function vPaid(v) { return money(v.payments.reduce(function (a, x) { return a + x.amount; }, 0)); }
function vBal(v) { return money(vTotal(v) - vPaid(v)); }
function visitsAsc(p) { return p.visits.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return a[0].date == b[0].date ? a[1] - b[1] : a[0].date < b[0].date ? -1 : 1; }).map(function (x) { return x[0]; }); }
function bal(p) { return money(p.visits.reduce(function (a, v) { return a + vBal(v); }, 0)); }
function billed(p) { return money(p.visits.reduce(function (a, v) { return a + vTotal(v); }, 0)); }
function lastVisit(p) { var a = visitsAsc(p); return a.length ? fmtDate(a[a.length - 1].date) : "—"; }
function toothLabel(t) { return t; }
function procSummary(v) { return v.items.map(function (i) { return (i.tooth == "Full Mouth" ? "" : i.tooth + " ") + i.proc; }).join(", "); }
function statusOf(v) { var b = vBal(v), p = vPaid(v); return !b ? ["ok", "Paid"] : p ? ["warn", "Partial"] : ["err", "Unpaid"]; }

/* ---- installment plans ---- */
function addMonths(dateStr, n) {
    var d = parseYmd(dateStr), t = new Date(d.getFullYear(), d.getMonth() + n, 1), dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d.getDate(), dim)); return ymd(t);
}
function isPlan(v) { return v.option == "Installment" && v.months > 0; }
function downPaid(v) { return money(v.payments.reduce(function (a, x) { return a + (x.inst ? 0 : x.amount); }, 0)); }
function instAmount(v, n) { return n < v.months ? v.monthly : money(vTotal(v) - downPaid(v) - v.monthly * (v.months - 1)); }
function instRows(v) {
    var rows = [], today = ymd(new Date()), soon = ymd(addDays(new Date(), 30));
    for (var n = 1; n <= v.months; n++) {
        var amt = instAmount(v, n), due = addMonths(v.date, n), paid = money(v.payments.reduce(function (a, x) { return a + (x.inst == n ? x.amount : 0); }, 0)), left = money(amt - paid), over = left > 0 && due < today, st;
        st = left <= 0 ? ["ok", "Paid"] : paid > 0 ? ["warn", "Partially Paid"] : over ? ["err", "Overdue"] : due <= soon ? ["warn", "Due"] : ["muted", "Upcoming"];
        rows.push({ n: n, amount: amt, due: due, paid: paid, bal: left, status: st, overdue: over });
    }
    return rows;
}
function planInfo(v) {
    var rows = instRows(v), paidN = rows.filter(function (r) { return r.bal <= 0; }).length, next = rows.filter(function (r) { return r.bal > 0; })[0] || null, over = rows.some(function (r) { return r.overdue; });
    return { rows: rows, paidN: paidN, left: v.months - paidN, next: next, active: vBal(v) > 0, overdue: over,
        status: !next ? ["ok", "Completed"] : over ? ["err", "Overdue"] : next.status[1] == "Due" ? ["warn", "Due"] : next.status[1] == "Partially Paid" ? ["warn", "Partially Paid"] : ["muted", "On track"] };
}
function plansOf(p) { return visitsAsc(p).filter(isPlan); }
function nextDueOf(p) { /* the earliest unpaid installment across the patient's active plans */
    var best = null;
    plansOf(p).forEach(function (v) { var i = planInfo(v); if (i.next && (!best || i.next.due < best.row.due)) best = { v: v, row: i.next, overdue: i.overdue }; });
    return best;
}
function hasActivePlan(p) { return plansOf(p).some(function (v) { return vBal(v) > 0; }); }

/* ---- bookings ---- */
function openDay(d) { return d.getDay() === 0 ? addDays(d, 1) : new Date(d); }
var bookSeq = 0;

function seedBooking(offset, hour, pid, procs) { return { id: "B-" + (++bookSeq), date: ymd(openDay(addDays(new Date(), offset))), hour: hour, pid: pid, procs: [].concat(procs), visitId: null }; }
var bookings = [seedBooking(0, 14, "P-004", ["Cleaning", "Extraction"]), seedBooking(1, 10, "P-002", ["Filling", "X-ray"]), seedBooking(1, 13, "P-006", "Cleaning"), seedBooking(2, 9, "P-005", "X-ray"), seedBooking(3, 11, "P-003", "Extraction"), seedBooking(4, 15, "P-004", "Cleaning")];

/* ---- modal ---- */
var dlg = $("#dlg");
function optHtml(o) {
    var obj = typeof o == "object";
    return "<option value='" + esc(obj ? o.value : o) + "'" + (obj && o.disabled ? " disabled" : "") + ">" + esc(obj ? o.label : o) + "</option>";
}
function setOpts(sel, opts, keep) {
    var old = sel.value;
    sel.innerHTML = "<option value=''>" + esc(sel.dataset.ph || "Select") + "</option>" + opts.map(optHtml).join("");
    sel.value = keep ? old : "";
    if (sel.value !== (keep ? old : "")) sel.value = "";
}
/* fields */
function modal(title, fields, cta, ok) {
    $("#dlgTitle").textContent = title; $("#dlgErr").textContent = ""; $("#dlgOk").textContent = cta;
    $("#dlgBody").innerHTML = fields.map(function (f, i) {
        var req = f.req ? " required" : "", c;
        if (f.opts) {
            c = "<select id='f" + i + "' data-ph='" + esc(f.ph || "Select") + "'" + req + ">" + (f.ph ? "<option value=''>" + esc(f.ph) + "</option>" : "") + f.opts.map(optHtml).join("") + "</select>";
            if (f.multi) c = "<div class='multi-row'>" + c + "<button type='button' class='icon-btn add' data-multi-add aria-label='Add another procedure' title='Add another procedure'>+</button></div><div id='multiList'></div>";
        }
        else c = "<input id='f" + i + "' type='" + (f.t || "text") + "' placeholder='" + esc(f.ph || "") + "' value='" + esc(f.v || "") + "'" + req +
            (f.t == "number" ? " min='" + (f.min != null ? f.min : 0) + "' step='" + (f.step || "any") + "'" + (f.max != null ? " max='" + f.max + "'" : "") : (f.min != null ? " min='" + f.min + "'" : "") + (f.max != null ? " max='" + f.max + "'" : "")) + ">";
        return "<label for='f" + i + "'>" + f.l + (f.req ? " *" : "") + "</label>" + c + (f.hint ? "<small class='field-hint'>" + esc(f.hint) + "</small>" : "");
    }).join("");
    var els = fields.map(function (f, i) { return $("#f" + i); });
    fields.forEach(function (f, i) {
        if (f.opts && f.v) els[i].value = f.v;
        els[i].addEventListener("input", function () { els[i].removeAttribute("aria-invalid"); });
        if (f.change) els[i].addEventListener("change", function () { f.change(els); });
    });
    fields.forEach(function (f, i) { if (f.multi) wireMulti(els[i], f.opts); });
    fields.forEach(function (f) { if (f.run) f.change(els); });
    $("#dlgForm").onsubmit = function (e) {
        e.preventDefault();
        $("#dlgErr").textContent = "";
        if (!this.reportValidity()) return;
        var r = ok(els.map(function (el) { return el.value.trim(); }));
        if (!r) { dlg.close(); return; }
        if (typeof r == "object") { $("#dlgErr").textContent = r.msg; els[r.i].setAttribute("aria-invalid", "true"); els[r.i].focus(); }
        else $("#dlgErr").textContent = r;
    };
    dlg.showModal(); $("#f0").focus();
}
$("#dlgCancel").onclick = function () { dlg.close(); };

function wireMulti(first, opts) {
    var list = $("#multiList"), add = $("#dlgBody [data-multi-add]");
    function sels() { return [first].concat($$("#multiList select")); }
    function sync() {
        var all = sels(), chosen = all.map(function (x) { return x.value; }).filter(Boolean);
        all.forEach(function (x) { Array.prototype.forEach.call(x.options, function (o) { o.disabled = !!o.value && o.value != x.value && chosen.indexOf(o.value) > -1; }); });
        add.disabled = all.length >= opts.length;
    }
    add.onclick = function () {
        var row = document.createElement("div"); row.className = "multi-row";
        row.innerHTML = "<select aria-label='Additional procedure'><option value=''>Select a procedure</option>" + opts.map(optHtml).join("") + "</select><button type='button' class='icon-btn' aria-label='Remove this procedure' title='Remove this procedure'>−</button>";
        list.appendChild(row);
        var sel = row.querySelector("select");
        sel.addEventListener("change", sync); sel.addEventListener("input", function () { sel.removeAttribute("aria-invalid"); });
        row.querySelector("button").onclick = function () { list.removeChild(row); sync(); add.focus(); };
        sync(); sel.focus();
    };
    first.addEventListener("change", sync);
}

function setErr(el, msg) {
    var id = el.id + "-err", s = document.getElementById(id);
    if (!s) { s = document.createElement("span"); s.id = id; s.className = "field-err"; el.insertAdjacentElement("afterend", s); }
    s.textContent = msg || "";
    if (msg) { el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", id); }
    else { el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); }
}

on(".forgot-link", function () {
    modal("Sign-in help", [{ l: "Email", t: "email", v: $("#email").value }], "Show instructions", function (v) {
        if (!v[0]) return "Enter your email address.";
        $("#email").value = v[0];
        $("#loginStatus").textContent = "This is a demo: no password or reset email is needed. Click Sign In to continue. For a real clinic account, contact your administrator.";
    });
});

function closeProfileDropdown() {
    $("#profileDropdown").hidden = true;
    $("#profileBtn").setAttribute("aria-expanded", "false");
}
on("#profileBtn", function () {
    var open = $("#profileDropdown").hidden;
    $("#profileDropdown").hidden = !open;
    $("#profileBtn").setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", function (e) {
    if (!e.target.closest(".profile-menu")) closeProfileDropdown();
});
$(".profile-menu").addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeProfileDropdown();
        $("#profileBtn").focus();
    }
});
$(".profile-menu").addEventListener("focusout", function (e) {
    if (!this.contains(e.relatedTarget)) closeProfileDropdown();
});
on("#reloadBtn", function () {
    history.replaceState(null, "", location.pathname + location.search + "#calendar");
    window.location.reload();
});

on("#logoutBtn", function () {
    closeProfileDropdown();
    if (!confirm("Are you sure you want to log out?")) return; /* Cancel: stay signed in on the current page */
    if (dlg.open) dlg.close();
    currentRole = null; cur = null; billPatient = null;
    sessionStorage.removeItem("dentsyncRole");
    navLinks.forEach(function (link) { link.hidden = false; });
    app.style.display = "none";
    loginBox.style.display = "flex";
    $("#loginForm").reset();
    $("#loginStatus").textContent = "You have been logged out.";
    resetPatientFilters();
    pages.forEach(function (page) { page.classList.remove("active"); });
    navLinks.forEach(function (link) {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
    });
    history.replaceState(null, "", location.pathname + location.search);
    $("#email").focus();
    notify("info", "Signed Out", "You have been logged out of DentSync.");
});

/* ---- calendar: Daily, Weekly and Monthly views ----*/
function monday(d) { d = new Date(d); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
var selectedDay = openDay(new Date()), ws = monday(selectedDay), view = "week";
function bookingAt(k, h) { return bookings.filter(function (b) { return b.date == k && b.hour == h; })[0]; }
function slotPassed(d, h) { var t = new Date(d); t.setHours(h, 0, 0, 0); return t < new Date(); }
function shortHour(h) { return (h % 12 || 12) + (h < 12 ? "am" : "pm"); }
var VIEW_WORD = { day: "day", week: "week", month: "month" };

function renderTimeGrid(todayKey, canBook) {
    var dayView = view == "day", count = 0;
    var days = dayView ? [selectedDay] : [0, 1, 2, 3, 4, 5].map(function (c) { return addDays(ws, c); });
    var h = "<caption class=sr-only>" + (dayView ? "Daily appointment schedule for " + fmtLong(days[0]) : "Weekly appointment schedule") + "</caption><thead><tr><th scope=col>Time</th>";
    days.forEach(function (d) {
        var k = ymd(d), label = dayView ? "Appointments" : d.toLocaleDateString("en-US", { weekday: "short" }) + " " + d.getDate();
        var cls = k == todayKey ? "today" : k < todayKey ? "past" : "";
        h += "<th scope=col" + (cls ? ' class="' + cls + '"' : "") + (k == todayKey ? ' aria-current="date"' : "") + ">";
        h += !dayView && k >= todayKey ? '<button type="button" class="day-link" data-day="' + k + '" title="Open daily view" aria-label="Open daily view for ' + esc(fmtLong(d)) + '">' + label + "</button>" : label;
        h += "</th>";
    });
    h += "</tr></thead><tbody>";
    HOURS.forEach(function (hr) {
        h += '<tr><th scope="row" class="time">' + hourLabel(hr) + "</th>";
        days.forEach(function (d) {
            var k = ymd(d), b = bookingAt(k, hr), past = k < todayKey || slotPassed(d, hr), p;
            if (b) {
                count++; p = patientById(b.pid);
                h += '<td><div class="event' + (past ? " done" : "") + '"><b>' + esc(p ? fullName(p) : "Unknown patient") + "</b><span>" + esc(b.procs.join(", ")) + "</span>" + (b.visitId ? "<small>✓ Treated</small>" : "") + (dayView ? "<small>" + hourLabel(hr) + " – " + hourLabel(hr + 1) + "</small>" : "") + "</div></td>";
            } else if (past) h += '<td class="disabled" aria-disabled="true"><span class="sr-only">Unavailable, time has passed</span></td>';
            else if (canBook) h += '<td><button type="button" class="slot" data-slot-date="' + k + '" data-slot-hour="' + hr + '" aria-label="Book ' + esc(fmtLong(d)) + " at " + hourLabel(hr) + '"><span aria-hidden="true">+ Book</span></button></td>';
            else h += "<td></td>";
        });
        h += "</tr>";
    });
    $("#calGrid").innerHTML = h + "</tbody>";
    $("#calGrid").classList.toggle("daily", dayView);
    return count;
}

function renderMonthGrid(todayKey) {
    var first = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1), mon = first.getMonth(), start = monday(first), count = 0;
    var h = '<div class="mg-row mg-head" role="row">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function (n) { return '<div role="columnheader">' + n + "</div>"; }).join("") + "</div>";
    for (var w = 0; w < 6; w++) { /* always six weeks, so the grid keeps the same height from month to month */
        h += '<div class="mg-row" role="row">';
        for (var c = 0; c < 6; c++) {
            var d = addDays(start, w * 7 + c), k = ymd(d), inMonth = d.getMonth() == mon;
            var items = bookings.filter(function (b) { return b.date == k; }).sort(function (a, b) { return a.hour - b.hour; });
            if (inMonth) count += items.length;
            var cls = "mg-cell" + (inMonth ? "" : " out") + (k == todayKey ? " today" : k < todayKey ? " past" : "");
            h += '<button type="button" role="gridcell" class="' + cls + '" data-day="' + k + '"' + (k == todayKey ? ' aria-current="date"' : "") + ' aria-label="' + esc(fmtLong(d)) + ", " + (items.length ? items.length + (items.length == 1 ? " appointment" : " appointments") : "no appointments") + '. Open daily view"><span class="mg-num">' + d.getDate() + "</span>";
            items.slice(0, 3).forEach(function (b) { var p = patientById(b.pid); h += '<span class="mg-ev"><i>' + shortHour(b.hour) + "</i> " + esc(p ? p.last : "Unknown") + "</span>"; });
            if (items.length > 3) h += '<span class="mg-more">+' + (items.length - 3) + " more</span>";
            h += "</button>";
        }
        h += "</div>";
    }
    $("#calMonthGrid").innerHTML = h;
    return count;
}

function renderCal() {
    var todayKey = ymd(new Date()), count, title, tail;
    $("#calGrid").hidden = view == "month"; $("#calMonthGrid").hidden = view != "month";
    if (view == "month") {
        count = renderMonthGrid(todayKey);
        title = selectedDay.toLocaleDateString("en-US", { month: "long", year: "numeric" }); tail = "this month.";
    } else {
        count = renderTimeGrid(todayKey, can("book"));
        var end = addDays(ws, 5);
        title = view == "day" ? fmtLong(selectedDay) : ws.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + (ws.getMonth() == end.getMonth() ? end.getDate() : end.toLocaleDateString("en-US", { month: "short", day: "numeric" })) + ", " + end.getFullYear();
        tail = view == "day" ? "on this day." : "this week.";
    }
    $("#calMonth").textContent = title;
    $("#calSummary").textContent = count + (count == 1 ? " appointment " : " appointments ") + tail;
    [["viewDay", "day"], ["viewWeek", "week"], ["viewMonth", "month"]].forEach(function (x) {
        $("#" + x[0]).classList.toggle("current", view == x[1]); $("#" + x[0]).setAttribute("aria-pressed", String(view == x[1]));
    });
    $("#calPrev").setAttribute("aria-label", "Previous " + VIEW_WORD[view]);
    $("#calNext").setAttribute("aria-label", "Next " + VIEW_WORD[view]);
    var stage = $("#calStage"); stage.classList.remove("swap"); void stage.offsetWidth; stage.classList.add("swap");
}
function moveCalendar(direction) {
    if (view == "day") { do { selectedDay = addDays(selectedDay, direction); } while (selectedDay.getDay() === 0); }
    else if (view == "week") selectedDay = addDays(selectedDay, direction * 7);
    else {
        var y = selectedDay.getFullYear(), m = selectedDay.getMonth() + direction, dim = new Date(y, m + 1, 0).getDate();
        selectedDay = new Date(y, m, Math.min(selectedDay.getDate(), dim));
        if (selectedDay.getDay() === 0) selectedDay = addDays(selectedDay, -1);
    }
    ws = monday(selectedDay); renderCal();
}
on("#calPrev", function () { moveCalendar(-1); });
on("#calNext", function () { moveCalendar(1); });
on("#calToday", function () { selectedDay = openDay(new Date()); ws = monday(selectedDay); renderCal(); });
on("#viewDay", function () { view = "day"; renderCal(); });
on("#viewWeek", function () { view = "week"; renderCal(); });
on("#viewMonth", function () { view = "month"; renderCal(); });

/* time options for a date: hours that already passed or are taken are shown but disabled */
function timeOpts(dateStr) {
    var d = dateStr ? parseYmd(dateStr) : null;
    if (!d || isNaN(d) || d.getDay() === 0 || dateStr < ymd(new Date())) return [];
    return HOURS.map(function (h) {
        var taken = bookingAt(dateStr, h), gone = slotPassed(d, h);
        return { value: String(h), label: hourLabel(h) + (taken ? " (booked)" : gone ? " (passed)" : ""), disabled: !!(taken || gone) };
    });
}
function firstBookableDate() {
    var d = openDay(new Date());
    for (var n = 0; n < 14; n++, d = openDay(addDays(d, 1))) if (timeOpts(ymd(d)).some(function (o) { return !o.disabled; })) return ymd(d);
    return ymd(new Date());
}
function bookModal(pre) {
    pre = pre || {};
    var date = pre.date || firstBookableDate();
    modal("New booking", [
        { l: "Patient", ph: "Select a patient", req: true, opts: sortedPatients().map(function (p) { return { value: p.id, label: fullName(p) + " (" + p.id + ")" }; }), v: pre.pid || "" },
        { l: "Procedure", ph: "Select a procedure", req: true, multi: true, hint: "Add every procedure planned for this visit.", opts: PROCEDURES.map(function (p) { return p.name; }) },
        {
            l: "Date", t: "date", req: true, min: ymd(new Date()), v: date, run: true, change: function (els) {
                var d = parseYmd(els[2].value || "x"), opts = timeOpts(els[2].value);
                setOpts(els[3], opts, true);
                $("#dlgErr").textContent = !els[2].value || isNaN(d) ? "" : d.getDay() === 0 ? "The calendar runs Monday to Saturday. Pick another day." :
                    els[2].value < ymd(new Date()) ? "That date has already passed." : opts.every(function (o) { return o.disabled; }) ? "No time slots are left on this date. Pick another day." : "";
            }
        },
        { l: "Time", ph: "Select a time", req: true, opts: timeOpts(date), v: pre.hour != null ? String(pre.hour) : "" }
    ], "Save booking", function (v) {
        var d = parseYmd(v[2]), hr = Number(v[3]);
        var extras = $$("#multiList select"), procs = [v[1]];
        for (var k = 0; k < extras.length; k++) {
            if (!extras[k].value) { extras[k].setAttribute("aria-invalid", "true"); extras[k].focus(); return { msg: "Select a procedure for each added row, or remove the empty row.", i: 1 }; }
            if (procs.indexOf(extras[k].value) > -1) return { msg: extras[k].value + " is listed twice.", i: 1 };
            procs.push(extras[k].value);
        }
        if (isNaN(d)) return { msg: "Choose a date.", i: 2 };
        if (v[2] < ymd(new Date())) return { msg: "Past dates cannot be booked.", i: 2 };
        if (d.getDay() === 0) return { msg: "The calendar runs Monday to Saturday. Pick another day.", i: 2 };
        if (slotPassed(d, hr)) return { msg: "That time has already passed. Choose a later slot.", i: 3 };
        if (bookingAt(v[2], hr)) return { msg: "That time is already booked. Choose another slot.", i: 3 };
        var p = patientById(v[0]);
        bookings.push({ id: "B-" + (++bookSeq), date: v[2], hour: hr, pid: v[0], procs: procs, visitId: null });
        selectedDay = d; ws = monday(d);
        renderCal(); showPage("calendar");
        notify("ok", "New Booking Created!", fullName(p) + " · " + procs.join(", ") + " · " + fmtLong(d) + " at " + hourLabel(hr));
    });
}
on("#newBooking", function () { bookModal(); });
on("#bookBtn", function () { bookModal({ pid: cur.id }); });

/* ---- search ---- */
/* One search for the whole system (top bar). It filters whichever list is on screen: Billing's patient picker on Billing,
   otherwise the Patient Records table (typing from another page takes you to Patient Records). */
function activePageId() { var a = document.querySelector(".page.active"); return a ? a.id : ""; }
$("#search").addEventListener("input", function () {
    var pg = activePageId();
    if (pg == "billing") { billPatient = null; renderBilling(); return; }
    renderPatients();
    if (pg != "patients" || !$("#patListView") || $("#patListView").hidden) showPage("patients");
});

/* ---- patients: directory with filters ---- */
function daysSinceVisit(p) { var a = visitsAsc(p); return a.length ? Math.floor((parseYmd(ymd(new Date())) - parseYmd(a[a.length - 1].date)) / 864e5) : null; }
function passFilters(p, f) {
    if (f.q && !matchPatient(p, f.q)) return false;
    if (f.status && can("billing")) {
        var has = p.visits.length > 0, owes = bal(p) > 0;
        if (f.status == "none" ? has : f.status == "owing" ? !owes : (!has || owes)) return false;
    }
    if (f.visit && can("clinical")) {
        var d = daysSinceVisit(p);
        if (f.visit == "never" ? d !== null : (d === null || (f.visit == "old" ? d <= 90 : d > Number(f.visit)))) return false;
    }
    if (f.age) { var a = ageOf(p); if (f.age == "child" ? a >= 18 : f.age == "adult" ? (a < 18 || a > 59) : a < 60) return false; }
    return true;
}
function renderPatients() {
    var f = { q: $("#search").value.trim(), status: $("#fStatus").value, visit: $("#fVisit").value, age: $("#fAge").value };
    var clin = can("clinical"), bil = can("billing"), cols = 4 + (clin ? 1 : 0) + (bil ? 1 : 0);
    var h = "<caption class=sr-only>Patient directory</caption><thead><tr><th scope=col>ID</th><th scope=col>Name</th><th scope=col>Age</th><th scope=col>Phone</th>" + (clin ? "<th scope=col>Last Visit</th>" : "") + (bil ? "<th scope=col>Balance</th>" : "") + "</tr></thead><tbody>", n = 0;
    sortedPatients().forEach(function (p) {
        if (!passFilters(p, f)) return;
        n++;
        h += '<tr><td>' + p.id + '</td><td><a href="#patient" data-open="' + p.id + '">' + esc(fullName(p)) + "</a></td><td>" + esc(ageOf(p)) + "</td><td>" + esc(p.phone) + "</td>" +
            (clin ? "<td>" + esc(lastVisit(p)) + "</td>" : "") + (bil ? '<td class="' + (bal(p) ? "warn" : "ok") + '">' + peso(bal(p)) + "</td>" : "") + "</tr>";
    });
    var filtered = !!(f.q || (bil && f.status) || (clin && f.visit) || f.age);
    if (!n) h += '<tr><td colspan="' + cols + '">' + (filtered ? "No patients match these filters. Try a different name, ID or phone number, or press Clear." : "No patients registered yet.") + "</td></tr>";
    $("#patientTable").innerHTML = h + "</tbody>";
    $("#patCount").textContent = "Showing " + n + " of " + patients.length + (patients.length == 1 ? " patient" : " patients");
}
function resetPatientFilters() { ["#search", "#fStatus", "#fVisit", "#fAge"].forEach(function (s) { $(s).value = ""; }); renderPatients(); renderBillPatients(""); }
["#fStatus", "#fVisit", "#fAge"].forEach(function (s) { $(s).addEventListener("change", renderPatients); });
on("#fClear", resetPatientFilters);

/* shared patient-field validation (New Patient panel and Edit patient dialog) */
var NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'’-]*$/;
function cleanName(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
function normPhone(s) {
    var d = String(s || "").replace(/[\s\-().]/g, "");
    if (/^\+639\d{9}$/.test(d)) d = "0" + d.slice(3); else if (/^639\d{9}$/.test(d)) d = "0" + d.slice(2);
    return /^09\d{9}$/.test(d) ? d.slice(0, 4) + " " + d.slice(4, 7) + " " + d.slice(7) : null;
}
function validatePatient(v) {
    var e = {}, c = { last: cleanName(v.last), first: cleanName(v.first), middle: cleanName(v.middle), birth: v.birth || "",
        address: cleanName(v.address), emergency: cleanName(v.emergency), conditions: cleanName(v.conditions), allergies: cleanName(v.allergies), meds: cleanName(v.meds), dnote: cleanName(v.dnote) };
    if (!c.first) e.first = "Enter the first name."; else if (c.first.length < 2 || !NAME_RE.test(c.first)) e.first = "Use letters only (spaces, hyphens and apostrophes are fine).";
    if (c.middle && !NAME_RE.test(c.middle)) e.middle = "Use letters only, or leave blank if none.";
    if (!c.last) e.last = "Enter the last name."; else if (c.last.length < 2 || !NAME_RE.test(c.last)) e.last = "Use letters only (spaces, hyphens and apostrophes are fine).";
    if (!c.birth) e.birth = "Enter the birthdate.";
    else if (isNaN(parseYmd(c.birth))) e.birth = "Enter a valid date.";
    else if (c.birth > ymd(new Date())) e.birth = "Birthdate cannot be in the future.";
    else if (ageFromBirth(c.birth) > 120) e.birth = "Check the birthdate: the age would be over 120.";
    c.age = e.birth ? null : ageFromBirth(c.birth); /* age is always computed from the birthdate */
    if (!String(v.phone || "").trim()) e.phone = "Enter a phone number."; else { c.phone = normPhone(v.phone); if (!c.phone) e.phone = "Enter a valid mobile number, e.g. 0917 123 4567."; }
    return { errors: e, clean: c };
}
var NP = [["first", "npFirst"], ["middle", "npMiddle"], ["last", "npLast"], ["birth", "npBirth"], ["phone", "npPhone"], ["emergency", "npEmergency"], ["address", "npAddress"], ["conditions", "npConditions"], ["allergies", "npAllergies"], ["meds", "npMeds"], ["dnote", "npDnote"]];
function syncAge(birthEl, ageEl) {
    var ok = birthEl.value && !isNaN(parseYmd(birthEl.value)) && birthEl.value <= ymd(new Date());
    ageEl.value = ok ? ageFromBirth(birthEl.value) + (ageFromBirth(birthEl.value) == 1 ? " year" : " years") : "";
}
$("#npBirth").max = ymd(new Date());
$("#npBirth").addEventListener("input", function () { syncAge($("#npBirth"), $("#npAge")); });

function setPatView(v) {
    $("#patListView").hidden = v != "list"; $("#patFormView").hidden = v == "list";
    $("#npForm").hidden = v != "form"; $("#npDone").hidden = v != "done";
}
var lastRegistered = null;
function resetNpForm() {
    $("#npForm").reset(); NP.forEach(function (x) { setErr($("#" + x[1]), ""); }); syncAge($("#npBirth"), $("#npAge"));
    $("#npPhoneNote").textContent = ""; checkDup();
}
function openNewPatient() {
    if (!can("managePatients")) return;
    resetNpForm(); setPatView("form"); $("#npFirst").focus();
}
on("#newPatientBtn", openNewPatient);

function normName(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.'’]/g, "").replace(/[-\s]+/g, " ").trim(); }
function sameMiddle(a, b) {
    a = normName(a); b = normName(b);
    if (!a || !b || a == b) return true;
    return (a.length == 1 || b.length == 1) && a.charAt(0) == b.charAt(0);
}
function findDuplicates(first, middle, last, exceptId) {
    var f = normName(first), l = normName(last);
    if (!f || !l) return [];
    return patients.filter(function (p) { return p.id != exceptId && normName(p.first) == f && normName(p.last) == l && sameMiddle(p.middle, middle); });
}
function checkDup() {
    var hits = findDuplicates($("#npFirst").value, $("#npMiddle").value, $("#npLast").value), box = $("#npDup");
    ["#npFirst", "#npMiddle", "#npLast"].forEach(function (s) { $(s).classList.toggle("dup", hits.length > 0); });
    if (hits.length) {
        box.innerHTML = "<b>This patient already exists. Please check the existing patient records before proceeding.</b>" +
            hits.map(function (p) { return '<span>' + p.id + " · " + esc(fullName(p)) + (p.birth ? " · born " + fmtDate(p.birth) : "") + ' · <a href="#patient" data-open="' + p.id + '">Open record</a></span>'; }).join("");
        box.hidden = false;
    } else { box.hidden = true; box.innerHTML = ""; }
    $("#npSubmit").disabled = hits.length > 0;
    return hits.length > 0;
}
function phoneNote() { 
    var n = normPhone($("#npPhone").value), hit = n ? patients.filter(function (p) { return p.phone == n; })[0] : null;
    $("#npPhoneNote").textContent = hit ? "This number is also on record for " + fullName(hit) + " (" + hit.id + "). Fine for family members." : "";
}
$("#npForm").addEventListener("input", function (e) {
    if (e.target.id) setErr(e.target, "");
    if (e.target.id == "npFirst" || e.target.id == "npMiddle" || e.target.id == "npLast") checkDup();
    if (e.target.id == "npPhone") phoneNote();
});
$("#npForm").addEventListener("submit", function (e) { e.preventDefault(); registerPatient(); });
function registerPatient() {
    var vals = {}; NP.forEach(function (x) { vals[x[0]] = $("#" + x[1]).value; });
    var r = validatePatient(vals), firstBad = null;
    NP.forEach(function (x) { var el = $("#" + x[1]); setErr(el, r.errors[x[0]]); if (r.errors[x[0]] && !firstBad) firstBad = el; });
    if (firstBad) { firstBad.focus(); notify("err", "Patient Not Registered", "Please correct the highlighted fields."); return; }
    var c = r.clean;
    if (checkDup()) { $("#npFirst").focus(); notify("err", "Patient Not Registered", "This patient already exists. Open the existing record instead."); return; }
    var nums = patients.map(function (p) { return parseInt(p.id.slice(2), 10); }), id = "P-" + ("00" + (Math.max.apply(null, nums) + 1)).slice(-3);
    var p = { id: id, last: c.last, first: c.first, middle: c.middle, age: c.age, birth: c.birth, phone: c.phone, address: c.address, emergency: c.emergency,
        conditions: c.conditions, allergies: c.allergies, meds: c.meds, dnote: c.dnote, visits: [], notes: [] };
    patients.push(p); lastRegistered = p;
    renderPatients(); renderBillPatients($("#search").value);
    $("#npDoneText").textContent = id + " · " + fullName(p) + " · " + p.phone + " is now in Patient Records and available in Billing and the Calendar.";
    $("#npBook").hidden = !can("book");
    setPatView("done"); $("#npBook").hidden ? $("#npToList").focus() : $("#npBook").focus();
    notify("ok", "New Patient Added!", id + " · " + fullName(p) + " is now registered.");
}
on("#npBook", function () { if (!lastRegistered || !can("book")) return; showPage("calendar"); bookModal({ pid: lastRegistered.id }); });
on("#npToList", function () { showPage("patients"); });

/* ---- patient record tabs ---- */
function openPatient(id) { cur = patientById(id); tab = "overview"; renderTab(); showPage("patient"); }
function fld(l, v) { return "<p><b>" + l + ":</b> " + esc(v || "—") + "</p>"; }
function renderTab() {
    var p = cur, h = "";
    if (!p) return;
    var allowedTabs = ["overview"];
    if (can("clinical")) allowedTabs.push("medical", "treatments");
    if (can("billing")) allowedTabs.push("billing");
    if (can("clinical")) allowedTabs.push("notes");
    if (allowedTabs.indexOf(tab) < 0) tab = "overview";
    $("#pName").textContent = fullName(p); $("#pId").textContent = p.id;
    document.querySelectorAll("[data-tab]").forEach(function (a) { a.hidden = allowedTabs.indexOf(a.dataset.tab) < 0; a.classList.toggle("current", a.dataset.tab == tab); a.setAttribute("aria-pressed", String(a.dataset.tab == tab)); });
    var contact = '<div class="box"><h3>Contact details</h3>' + fld("Age", ageOf(p) + " yrs") + fld("Birthdate", p.birth ? fmtDate(p.birth) : "") + fld("Phone", p.phone) + fld("Address", p.address) + fld("Emergency contact", p.emergency) + "</div>";
    var med = '<div class="box"><h3>Medical condition</h3>' + fld("Conditions", p.conditions) + fld("Allergies", p.allergies) + fld("Medications", p.meds) + fld("Notes for dentist", p.dnote) + "</div>";
    if (tab == "overview") {
        h = '<div class="boxes">' + contact + (can("clinical") ? med : "") + "</div>";
        if (can("clinical")) {
            h += '<div class="box visits"><h3>Recent visits and post-op notes</h3>';
            visitsAsc(p).reverse().forEach(function (v) { h += '<div class="visit"><span>' + fmtDate(v.date) + "</span><span>" + esc(procSummary(v)) + "</span><span>" + esc(v.dentist) + "</span><small>" + (v.note ? esc(v.note) : "No post-op note recorded.") + "</small></div>"; });
            if (!p.visits.length) h += '<div class="visit"><small>No visits yet. Use Book to schedule the first appointment.</small></div>';
            h += "</div>";
        }
    } else if (tab == "medical") {
        h = '<div class="boxes">' + med + '<div class="box sum"><h3>Emergency contact</h3>' + fld("Name and phone", p.emergency) + "</div></div>";
    } else if (tab == "treatments") {
        h = '<div class="table-scroll"><table class="data"><caption class="sr-only">Patient treatments by visit</caption><thead><tr><th scope=col>Date</th><th scope=col>Tooth and procedure</th><th scope=col>Dentist</th><th scope=col>Status</th></tr></thead><tbody>';
        visitsAsc(p).reverse().forEach(function (v) { var s = statusOf(v); h += "<tr><td>" + fmtDate(v.date) + "</td><td>" + v.items.map(function (i) { return esc((i.tooth == "Full Mouth" ? "Full Mouth" : i.tooth) + " " + i.proc); }).join("<br>") + "</td><td>" + esc(v.dentist) + '</td><td><span class="badge ' + s[0] + '">' + s[1] + "</span></td></tr>"; });
        if (!p.visits.length) h += '<tr><td colspan="4">No treatments recorded yet.</td></tr>';
        h += "</tbody></table></div>";
    } else if (tab == "billing") {
        h = '<div class="boxes"><div class="box sum"><h3>Total billed</h3><p class="big">' + peso(billed(p)) + '</p></div><div class="box sum"><h3>Outstanding balance</h3><p class="big ' + (bal(p) ? "warn" : "ok") + '">' + peso(bal(p)) + '</p></div></div><p style="margin-top:20px"><a href="#billing" class="btn gray" data-go="billing">Open billing</a></p>';
    } else {
        h = '<div class="box"><h3>Notes</h3>';
        p.notes.forEach(function (n) { h += "<p><b>" + n.date + ":</b> " + esc(n.text) + "</p>"; });
        if (!p.notes.length) h += "<p>No notes yet. Add the first one below.</p>";
        h += '<div class="note-form"><input id="noteIn" type="text" placeholder="Write a note about this patient" aria-label="New note"><button type="button" class="btn gray" data-act="note">Add note</button></div></div>';
    }
    $("#tabBody").innerHTML = h;
}
on("#editPatientBtn", function () {
    var p = cur;
    modal("Edit patient", [
        { l: "First name", req: true, v: p.first }, { l: "Middle name", v: p.middle, ph: "Leave blank if none" }, { l: "Last name", req: true, v: p.last },
        { l: "Birthdate", t: "date", req: true, v: p.birth, max: ymd(new Date()) },
        { l: "Phone number", t: "tel", req: true, v: p.phone, ph: "e.g. 0917 123 4567" },
        { l: "Address", v: p.address }, { l: "Emergency contact", v: p.emergency }, { l: "Conditions", v: p.conditions },
        { l: "Allergies", v: p.allergies }, { l: "Medications", v: p.meds }, { l: "Notes for dentist", v: p.dnote }
    ], "Save changes", function (v) {
        var r = validatePatient({ first: v[0], middle: v[1], last: v[2], birth: v[3], phone: v[4], address: v[5], emergency: v[6], conditions: v[7], allergies: v[8], meds: v[9], dnote: v[10] }), keys = ["first", "middle", "last", "birth", "phone"];
        for (var i = 0; i < keys.length; i++) if (r.errors[keys[i]]) return { msg: r.errors[keys[i]], i: i };
        var c = r.clean;
        if (findDuplicates(c.first, c.middle, c.last, p.id).length) return { msg: "Another patient record already has this name.", i: 0 };
        p.first = c.first; p.middle = c.middle; p.last = c.last; p.birth = c.birth; p.age = c.age; p.phone = c.phone;
        p.address = c.address; p.emergency = c.emergency; p.conditions = c.conditions; p.allergies = c.allergies; p.meds = c.meds; p.dnote = c.dnote;
        refreshAll(); renderCal();
        notify("ok", "Patient Record Updated!", fullName(p) + " (" + p.id + ") was saved.");
    });
});

/* ---- billing: step 1, choose a patient ---- */
var billPatient = null, billTab = "treatment", visitOpen = {}, draft = newDraft();
function pendingBookings(p) { return bookings.filter(function (b) { return b.pid == p.id && !b.visitId; }).sort(function (a, b) { return a.date == b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1; }); }
function defaultBooking(p) { 
    var l = pendingBookings(p), t = ymd(new Date()), today = l.filter(function (b) { return b.date == t; })[0], past = l.filter(function (b) { return b.date < t; });
    return today || past[past.length - 1] || l[0] || null;
}
function blankRow() { return { tooth: "", proc: "", src: "extra", done: true }; }

function applyBooking(d, b) {
    var extras = d.rows.filter(function (r) { return r.src != "booked" && r.proc; }), today = ymd(new Date());
    d.bookingId = b ? b.id : "";
    var booked = b ? b.procs.map(function (n) { return { proc: n, tooth: scopeOf(n) == "whole" ? FULL_MOUTH : "", src: "booked", done: true }; }) : [];
    extras = extras.filter(function (r) { return !booked.some(function (x) { return x.proc == r.proc && x.tooth == r.tooth; }); });
    d.rows = booked.concat(extras);
    if (!d.rows.length) d.rows = [blankRow()];
    if (b) d.date = b.date < today ? b.date : today;
}
function newDraft() {
    var d = { date: ymd(new Date()), bookingId: "", rows: [blankRow()], option: "", months: "", paid: "" }, b = billPatient ? defaultBooking(billPatient) : null;
    if (b) applyBooking(d, b);
    return d;
}
function defaultBillTab(p, planTab) { return pendingBookings(p).length ? "treatment" : hasActivePlan(p) ? "installments" : planTab; }
function instCell(p) {
    var nx = nextDueOf(p);
    if (!nx) return "—";
    var st = nx.overdue ? ["err", "Overdue"] : nx.row.status;
    return '<span class="badge ' + st[0] + '">' + st[1] + "</span> <small>" + fmtDate(nx.row.due) + "</small>";
}
function renderBillPatients(q) {
    q = (q || "").trim();
    var h = "<caption class=sr-only>Registered patients</caption><thead><tr><th scope=col>ID</th><th scope=col>Name</th><th scope=col>Phone</th><th scope=col>Last Visit</th><th scope=col>Balance</th><th scope=col>Installment</th></tr></thead><tbody>", n = 0;
    sortedPatients().forEach(function (p) {
        if (q && !matchPatient(p, q)) return;
        n++;
        h += '<tr class="pick-row" data-bill="' + p.id + '"><td>' + p.id + '</td><td><a href="#billing" data-bill="' + p.id + '">' + esc(fullName(p)) + "</a></td><td>" + esc(p.phone) + "</td><td>" + esc(lastVisit(p)) + '</td><td class="' + (bal(p) ? "warn" : "ok") + '">' + peso(bal(p)) + "</td><td>" + instCell(p) + "</td></tr>";
    });
    if (!n) h += '<tr><td colspan="6">No patients match “' + esc(q) + "”. Try a name, ID, or phone number.</td></tr>";
    $("#billPatientTable").innerHTML = h + "</tbody>";
}
function selectBillPatient(id) {
    billPatient = patientById(id); draft = newDraft(); billTab = defaultBillTab(billPatient, "treatment"); visitOpen = {};
    renderBilling();
    $("#ledgerHead").focus();
}
function renderBilling() {
    var picking = !billPatient;
    $("#billPick").hidden = !picking; $("#billPanel").hidden = picking;
    if (picking) { renderBillPatients($("#search").value); return; }
    var p = billPatient, b = bal(p);
    $("#ledgerName").textContent = fullName(p); $("#ledgerId").textContent = p.id;
    var nx = nextDueOf(p), nxSt = nx ? (nx.overdue ? ["err", "Overdue"] : nx.row.status) : null;
    $("#billSum").classList.toggle("four", !!nx);
    $("#billSum").innerHTML = '<div class="box sum"><h3>Total billed</h3><p class="big">' + peso(billed(p)) + '</p></div><div class="box sum"><h3>Total paid</h3><p class="big">' + peso(billed(p) - b) + '</p></div><div class="box sum"><h3>Outstanding balance</h3><p class="big ' + (b ? "warn" : "ok") + '">' + peso(b) + "</p></div>" +
        (nx ? '<div class="box sum"><h3>Next installment due</h3><p class="big">' + fmtDate(nx.row.due) + '</p><p class="next-sub">' + peso(nx.row.bal) + ' · <span class="badge ' + nxSt[0] + '">' + nxSt[1] + "</span></p></div>" : "");
    $("#recordPay").disabled = !b; $("#recordPay").title = b ? "" : "This patient has no outstanding balance";
    $$("[data-btab]").forEach(function (a) { a.classList.toggle("current", a.dataset.btab == billTab); a.setAttribute("aria-pressed", String(a.dataset.btab == billTab)); });
    $$('[data-btab="treatment"]').forEach(function (a) { var n = pendingBookings(p).length; a.classList.toggle("pending", n > 0); a.title = n ? "A booked appointment is ready to bill" : ""; });
    var flag = plansOf(p).some(function (v) { return planInfo(v).overdue; });
    $$('[data-btab="installments"]').forEach(function (a) { a.classList.toggle("flag", flag); a.title = flag ? "This patient has an overdue installment" : ""; });
    if (billTab == "treatment") renderTxForm(); else if (billTab == "installments") renderInstallments(); else renderRecords();
}
function refreshAll() { renderBilling(); renderPatients(); renderBillPatients($("#search").value); renderTab(); }

/* ---- billing ---- */
function toothOptionsFor(proc, sel) {
    var sc = scopeOf(proc);
    if (!sc) return '<option value="">Select a procedure first</option>';
    if (sc == "whole") return '<option value="' + FULL_MOUTH + '" selected>' + FULL_MOUTH + "</option>";
    var h = '<option value="">Select tooth</option>';
    if (sc == "either") h += '<option value="' + FULL_MOUTH + '"' + (sel == FULL_MOUTH ? " selected" : "") + ">" + FULL_MOUTH + " (panoramic)</option>";
    [["Upper right", 1, 8], ["Upper left", 9, 16], ["Lower left", 17, 24], ["Lower right", 25, 32]].forEach(function (g) {
        h += '<optgroup label="' + g[0] + " (#" + g[1] + "–#" + g[2] + ')">';
        for (var n = g[1]; n <= g[2]; n++) h += '<option value="#' + n + '"' + (sel == "#" + n ? " selected" : "") + ">#" + n + "</option>";
        h += "</optgroup>";
    });
    return h;
}
var TOOTH_HINT = { whole: "Applies to the whole mouth", tooth: "Choose the tooth treated", either: "Full mouth film, or one tooth" };
function toothCell(r, i) {
    var sc = scopeOf(r.proc);
    return '<select id="txTooth' + i + '" data-tx="tooth" data-i="' + i + '" aria-label="Tooth, procedure ' + (i + 1) + '"' + (sc == "tooth" || sc == "either" ? (r.done === false ? " disabled" : "") : " disabled") + ">" + toothOptionsFor(r.proc, r.tooth) + "</select>" +
        (sc ? '<small class="tx-hint">' + TOOTH_HINT[sc] + "</small>" : "");
}
function procOptions(sel) {
    return '<option value="">Select procedure</option>' + PROCEDURES.map(function (p) { return "<option" + (sel == p.name ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("");
}
function bookingLabel(b) { return fmtDate(b.date) + " · " + hourLabel(b.hour) + " · " + b.procs.join(", "); }
function renderTxForm() {
    var pend = pendingBookings(billPatient);
    var rows = draft.rows.map(function (r, i) {
        var booked = r.src == "booked", skip = booked && !r.done;
        var proc = booked ? '<div class="tx-fixed">' + esc(r.proc) + '</div><span class="tag booked">Booked</span>'
            : '<select id="txProc' + i + '" data-tx="proc" data-i="' + i + '" aria-label="Procedure ' + (i + 1) + '">' + procOptions(r.proc) + '</select><span class="tag extra">Additional</span>';
        var act = booked ? '<label class="tx-perf"><input type="checkbox" data-tx="done" data-i="' + i + '"' + (r.done ? " checked" : "") + '> Performed</label>'
            : '<button type="button" class="icon-btn" data-act="tx-del" data-i="' + i + '" aria-label="Remove procedure ' + (i + 1) + '"' + (draft.rows.length == 1 ? " disabled" : "") + ">−</button>";
        return '<div class="tx-row' + (skip ? " skipped" : "") + '"><div class="tx-cell">' + proc + "</div>" +
            '<div class="tx-cell" id="txToothCell' + i + '">' + toothCell(r, i) + "</div>" +
            '<div class="tx-cell"><input class="tx-cost" id="txCost' + i + '" readonly tabindex="-1" aria-label="Cost, procedure ' + (i + 1) + '" placeholder="Cost"></div>' +
            '<div class="tx-actions">' + act + "</div></div>";
    }).join("");
    $("#billBody").innerHTML =
        '<form class="tx-form" id="txForm" novalidate aria-labelledby="txTitle"><h3 id="txTitle">Record a treatment visit</h3>' +
        '<div class="fld tx-appt"><label for="txBooking">Appointment</label><select id="txBooking" data-tx="booking"><option value="">' + (pend.length ? "None (walk-in, no appointment)" : "No booked appointment") + "</option>" +
        pend.map(function (b) { return '<option value="' + b.id + '"' + (draft.bookingId == b.id ? " selected" : "") + ">" + esc(bookingLabel(b)) + "</option>"; }).join("") + "</select>" +
        '<small class="tx-hint">' + (pend.length ? "Booked procedures are imported below. Tick Performed for what was actually done." : "Book the patient in the Calendar first to import procedures, or add them below.") + "</small></div>" +
        '<div class="tx-grid"><div class="fld"><label for="txDate">Visit date *</label><input id="txDate" type="date" data-tx="date" max="' + ymd(new Date()) + '" value="' + esc(draft.date) + '" required></div>' +
        '<div class="fld"><label for="txDentist">Attending dentist</label><input id="txDentist" value="' + esc(DENTIST) + '" readonly></div></div>' +
        '<fieldset class="tx-procs"><legend>Procedures for this visit *</legend><div class="tx-head" aria-hidden="true"><span>Procedure</span><span>Tooth</span><span>Cost</span><span></span></div>' + rows +
        '<div class="tx-addrow"><button type="button" class="icon-btn add" data-act="tx-add" aria-label="Add another procedure"' + (draft.rows.length >= MAX_ROWS ? " disabled" : "") + '>+</button><span>Add a procedure found during this visit</span></div></fieldset>' +
        '<p class="tx-total">Total treatment cost <strong id="txTotal">₱ 0</strong></p><p class="tx-count" id="txCount"></p>' +
        '<fieldset class="tx-pay"><legend>Payment</legend><div class="tx-grid three"><div class="fld"><label for="txOpt">Payment option *</label><select id="txOpt" data-tx="option" required><option value="">Select payment option</option>' +
        PAY_OPTIONS.map(function (o) { return "<option" + (draft.option == o ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></div>" +
        '<div class="fld" id="txMonthsWrap" hidden><label for="txMonths">Number of months *</label><input id="txMonths" type="number" data-tx="months" min="1" max="24" step="1" inputmode="numeric" placeholder="e.g. 6" value="' + esc(draft.months) + '"></div>' +
        '<div class="fld"><label for="txPaid">Paid now (₱)</label><input id="txPaid" type="number" data-tx="paid" min="0" step="0.01" inputmode="decimal" placeholder="0" value="' + esc(draft.paid) + '"></div></div>' +
        '<div class="plan-box" id="txPlan" aria-live="polite"></div></fieldset>' +
        '<p class="form-error" id="txErr" role="alert"></p><button type="submit" class="btn cta">Save treatment record</button></form>';
    updateTx();
}
function performedRows() { return draft.rows.filter(function (r) { return r.done && r.proc; }); }
function txTotal() { return performedRows().reduce(function (a, r) { return a + priceOf(r.proc); }, 0); }
function updateTx() {
    if (!$("#txForm")) return;
    var total = txTotal(), opt = draft.option, months = Number(draft.months), paidEl = $("#txPaid"), plan = $("#txPlan");
    draft.rows.forEach(function (r, i) { $("#txCost" + i).value = r.proc ? (r.done ? peso(priceOf(r.proc)) : "Not charged") : ""; });
    $("#txTotal").textContent = peso(total);
    var nb = performedRows().filter(function (r) { return r.src == "booked"; }).length, na = performedRows().filter(function (r) { return r.src != "booked"; }).length, ns = draft.rows.filter(function (r) { return r.src == "booked" && !r.done; }).length;
    $("#txCount").textContent = "Charged: " + nb + " booked, " + na + " additional" + (ns ? " · Not performed (not charged): " + ns : "");
    $("#txMonthsWrap").hidden = opt != "Installment";
    paidEl.readOnly = opt == "Full Payment";
    if (opt == "Full Payment") { draft.paid = total ? String(total) : ""; paidEl.value = draft.paid; }
    var paid = Number(draft.paid) || 0, h = "";
    if (!opt) h = "<p>Choose a payment option to continue.</p>";
    else if (!total) h = "<p>Confirm at least one performed procedure to see the payment details.</p>";
    else if (opt == "Full Payment") h = "<p>Paid in full on this visit.</p><p>Balance after this visit: <strong>" + peso(0) + "</strong></p>";
    else if (!(months >= 1 && months <= 24 && months % 1 === 0)) h = "<p>Enter the number of months (1 to 24) to compute the monthly payment.</p>";
    else if (paid >= total) h = "<p>For an installment plan, “Paid now” must be less than the total.</p>";
    else {
        var remaining = money(total - paid);
        h = '<p class="plan-label">Monthly payment</p><p class="plan-amt">' + peso(money(remaining / months)) + '</p><p class="plan-calc">' +
            (paid ? peso(total) + " total − " + peso(paid) + " paid now = " + peso(remaining) + " remaining" : peso(total) + " total") + " ÷ " + months + (months == 1 ? " month" : " months") + "</p>" +
            '<p class="plan-calc">First payment due ' + fmtDate(addMonths(draft.date || ymd(new Date()), 1)) + ", last payment due " + fmtDate(addMonths(draft.date || ymd(new Date()), months)) + ".</p>";
    }
    plan.innerHTML = h;
    setErr(paidEl, opt == "Installment" && total && paid >= total ? "Must be less than the total for an installment." : paid < 0 ? "Cannot be negative." : "");
}
function txInput(t) {
    var f = t.dataset.tx;
    if (f == "booking") {
        if (draft.bookingId == t.value) return;
        applyBooking(draft, t.value ? bookings.filter(function (x) { return x.id == t.value; })[0] : null);
        renderTxForm(); return;
    }
    if (f == "date") draft.date = t.value;
    else if (f == "proc") {
        var i = +t.dataset.i, r = draft.rows[i];
        r.proc = t.value; setErr(t, "");
        if (scopeOf(r.proc) == "whole") r.tooth = FULL_MOUTH; else if (!toothFits(r.proc, r.tooth)) r.tooth = "";
        $("#txToothCell" + i).innerHTML = toothCell(r, i);
    }
    else if (f == "done") {
        var j = +t.dataset.i, row = draft.rows[j];
        row.done = t.checked; t.closest(".tx-row").classList.toggle("skipped", !row.done);
        $("#txToothCell" + j).innerHTML = toothCell(row, j);
    }
    else if (f == "tooth") { draft.rows[+t.dataset.i].tooth = t.value; setErr(t, ""); }
    else if (f == "option") { draft.option = t.value; draft.paid = t.value == "Installment" ? "0" : ""; if (t.value == "Installment") $("#txPaid").value = "0"; setErr(t, ""); }
    else if (f == "months") draft.months = t.value;
    else if (f == "paid") draft.paid = t.value;
    updateTx();
}
function submitTx() {
    var first = null, total = txTotal(), opt = draft.option, months = Number(draft.months), paid = Number(draft.paid) || 0;
    function bad(el, msg) { setErr(el, msg); if (!first) first = el; }
    $$("#txForm .field-err").forEach(function (x) { x.textContent = ""; });
    $$("#txForm [aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    if (!draft.date) bad($("#txDate"), "Choose the visit date."); else if (draft.date > ymd(new Date())) bad($("#txDate"), "The visit date cannot be in the future.");
    var seen = {};
    draft.rows.forEach(function (r, i) {
        if (!r.done) return; 
        var tEl = $("#txTooth" + i), pEl = $("#txProc" + i) || tEl;
        if (!r.proc) bad(pEl, "Select a procedure.");
        else if (!r.tooth) bad(tEl, "Select the tooth for this procedure.");
        else if (!toothFits(r.proc, r.tooth)) bad(tEl, r.proc + " cannot be recorded for " + r.tooth + ".");
        else { var k = r.tooth + "|" + r.proc; if (seen[k]) bad(pEl, "This procedure is already listed for the same tooth."); seen[k] = 1; }
    });
    if (!performedRows().length && !first) { $("#txErr").textContent = "Confirm at least one performed procedure."; notify("err", "Treatment Record Not Saved", "Confirm at least one performed procedure."); return; }
    if (!opt) bad($("#txOpt"), "Select a payment option.");
    else if (opt == "Installment") {
        if (!(months >= 1 && months <= 24 && months % 1 === 0)) bad($("#txMonths"), "Enter whole months, 1 to 24.");
        if (total && (paid < 0 || paid >= total)) bad($("#txPaid"), "Must be less than the total for an installment.");
    }
    if (first) { $("#txErr").textContent = "Please fix the highlighted fields."; first.focus(); notify("err", "Treatment Record Not Saved", "Please fix the highlighted fields."); return; }
    $("#txErr").textContent = "";
    var done = performedRows(), skipped = draft.rows.filter(function (r) { return r.src == "booked" && !r.done; }).map(function (r) { return r.proc; });
    var v = { id: "V-" + (++visitSeq), date: draft.date, dentist: DENTIST, option: opt, months: opt == "Installment" ? months : 0, monthly: opt == "Installment" ? money((total - paid) / months) : 0, payments: paid > 0 ? [{ date: draft.date, amount: paid, inst: 0 }] : [], note: "",
        bookingId: draft.bookingId || null, skipped: skipped,
        items: done.map(function (r) { return { tooth: r.tooth, proc: r.proc, cost: priceOf(r.proc), booked: r.src == "booked" }; }) };
    billPatient.visits.push(v);
    var bk = draft.bookingId ? bookings.filter(function (x) { return x.id == draft.bookingId; })[0] : null;
    if (bk) bk.visitId = v.id; /* link the appointment to this one treatment record */
    draft = newDraft(); billTab = isPlan(v) ? "installments" : "records"; visitOpen = {}; visitOpen[v.id] = true; visitOpen["pl-" + v.id] = true;
    refreshAll(); renderCal();
    notify("ok", "Treatment Record Updated!", fmtDate(v.date) + " · " + v.items.length + (v.items.length == 1 ? " procedure · " : " procedures · ") + peso(vTotal(v)) + " total, " + peso(vPaid(v)) + " paid.");
}

/* ---- billing: per-visit treatment records ---- */
function visitCard(v, n, open) {
    var s = statusOf(v), b = vBal(v), linked = !!v.bookingId, rows = v.items.map(function (i) { return "<tr><td>" + esc(toothLabel(i.tooth)) + "</td><td>" + esc(i.proc) + "</td>" + (linked ? '<td><span class="tag ' + (i.booked ? "booked" : "extra") + '">' + (i.booked ? "Booked" : "Additional") + "</span></td>" : "") + "<td>" + peso(i.cost) + "</td></tr>"; }).join("");
    var plan = v.option == "Installment" ? "Installment, " + v.months + (v.months == 1 ? " month" : " months") + " at " + peso(v.monthly) + " per month" : v.option;
    var pays = v.payments.length ? "<ul>" + v.payments.map(function (x) { return "<li>" + fmtDate(x.date) + ": " + peso(x.amount) + (isPlan(v) ? (x.inst ? " (installment " + x.inst + ")" : " (paid at visit)") : "") + "</li>"; }).join("") + "</ul>" : "No payment yet";
    return '<details class="visit-card" data-v="' + v.id + '"' + (open ? " open" : "") + "><summary><span class=\"vc-title\">Visit " + n + " · " + fmtDate(v.date) + '</span><span class="vc-procs">' + esc(procSummary(v)) + "</span><span class=\"vc-total\">" + peso(vTotal(v)) + '</span><span class="badge ' + s[0] + '">' + s[1] + "</span></summary>" +
        '<div class="vc-body"><div class="table-scroll"><table class="data mini"><caption class="sr-only">Procedures in visit ' + n + '</caption><thead><tr><th scope=col>Tooth</th><th scope=col>Procedure</th>' + (linked ? "<th scope=col>Source</th>" : "") + '<th scope=col>Cost</th></tr></thead><tbody>' + rows +
        '</tbody><tfoot><tr><th scope="row" colspan="' + (linked ? 3 : 2) + '">Total treatment cost</th><td>' + peso(vTotal(v)) + "</td></tr></tfoot></table></div>" +
        '<dl class="vc-meta"><div><dt>Attending dentist</dt><dd>' + esc(v.dentist) + "</dd></div>" + (v.skipped && v.skipped.length ? "<div><dt>Booked, not performed (not charged)</dt><dd>" + esc(v.skipped.join(", ")) + "</dd></div>" : "") + "<div><dt>Payment option</dt><dd>" + esc(plan) + "</dd></div><div><dt>Payments</dt><dd>" + pays + "</dd></div><div><dt>Paid so far</dt><dd>" + peso(vPaid(v)) + '</dd></div><div><dt>Balance</dt><dd class="' + (b ? "warn" : "ok") + '">' + peso(b) + "</dd></div></dl>" +
        (b ? '<button type="button" class="btn gray vc-pay" data-act="pay" data-v="' + v.id + '">' + (isPlan(v) ? "Record installment payment" : "Record payment for this visit") + "</button>" : "") + "</div></details>";
}
function renderRecords() {
    var asc = visitsAsc(billPatient), h = "";
    if (!asc.length) { $("#billBody").innerHTML = h + '<div class="box"><p>No treatment visits yet. Use the Treatment tab to record the first visit.</p></div>'; return; }
    function open(v, def) { return visitOpen[v.id] == null ? def : visitOpen[v.id]; }
    var latest = asc[asc.length - 1];
    h += '<h3 class="rec-head">Current visit</h3>' + visitCard(latest, asc.length, open(latest, true));
    if (asc.length > 1) {
        h += '<h3 class="rec-head">Previous visits (' + (asc.length - 1) + ")</h3>";
        for (var i = asc.length - 2; i >= 0; i--) h += visitCard(asc[i], i + 1, open(asc[i], false));
    }
    $("#billBody").innerHTML = h;
}
$("#billBody").addEventListener("toggle", function (e) { if (e.target.dataset && e.target.dataset.v && e.target.tagName == "DETAILS") visitOpen[e.target.dataset.v] = e.target.open; }, true);
$("#billBody").addEventListener("input", function (e) { if (e.target.dataset.tx) txInput(e.target); });
$("#billBody").addEventListener("change", function (e) { if (e.target.dataset.tx) txInput(e.target); });
$("#billBody").addEventListener("submit", function (e) { e.preventDefault(); submitTx(); });

/* ---- billing: installments tab (schedule, history, status per plan) ---- */
function planCard(v, n, open) {
    var i = planInfo(v), nx = i.next, key = "pl-" + v.id;
    if (visitOpen[key] != null) open = visitOpen[key];
    var rows = i.rows.map(function (r) {
        var last = v.payments.filter(function (x) { return x.inst == r.n; }).map(function (x) { return x.date; }).sort().pop();
        return "<tr><td>" + r.n + "</td><td>" + fmtDate(r.due) + (r.overdue && r.status[1] != "Overdue" ? ' <span class="badge err">Past due</span>' : "") + "</td><td>" + peso(r.amount) + "</td><td>" + peso(r.paid) + '</td><td class="' + (r.bal ? "warn" : "ok") + '">' + peso(r.bal) + '</td><td><span class="badge ' + r.status[0] + '">' + r.status[1] + "</span></td><td>" +
            (r.bal > 0 ? '<button type="button" class="btn gray mini-btn" data-act="pay" data-v="' + v.id + '" data-n="' + r.n + '" aria-label="Record payment for installment ' + r.n + '">Record payment</button>' : (last ? "Paid " + fmtDate(last) : "—")) + "</td></tr>";
    }).join("");
    var hist = v.payments.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).map(function (x) {
        return "<tr><td>" + fmtDate(x.date) + "</td><td>" + (x.inst ? "Installment " + x.inst + " of " + v.months : "Paid at visit (down payment)") + "</td><td>" + peso(x.amount) + "</td></tr>";
    }).join("") || '<tr><td colspan="3">No payments recorded yet.</td></tr>';
    var meta = [
        ["Total treatment cost", peso(vTotal(v))], ["Installment duration", v.months + (v.months == 1 ? " month" : " months")], ["Monthly installment", peso(v.monthly)],
        ["Installments paid", i.paidN + " of " + v.months], ["Remaining installments", String(i.left)], ["Total amount paid", peso(vPaid(v))],
        ["Outstanding balance", '<span class="' + (vBal(v) ? "warn" : "ok") + '">' + peso(vBal(v)) + "</span>"],
        ["Next payment due", nx ? fmtDate(nx.due) + " · " + peso(nx.bal) : "None (fully paid)"], ["Payment status", '<span class="badge ' + i.status[0] + '">' + i.status[1] + "</span>"]
    ].map(function (m) { return "<div><dt>" + m[0] + "</dt><dd>" + m[1] + "</dd></div>"; }).join("");
    return '<details class="visit-card plan-card" data-v="' + key + '"' + (open ? " open" : "") + '><summary><span class="vc-title">Visit ' + n + " · " + fmtDate(v.date) + '</span><span class="vc-procs">' + esc(procSummary(v)) + '</span><span class="vc-total">' + peso(vTotal(v)) + '</span><span class="badge ' + i.status[0] + '">' + i.status[1] + "</span></summary>" +
        '<div class="vc-body"><dl class="vc-meta plan-meta">' + meta + "</dl>" +
        '<h4 class="plan-sub">Installment schedule</h4><div class="table-scroll"><table class="data mini"><caption class="sr-only">Installment schedule for visit ' + n + '</caption><thead><tr><th scope="col">#</th><th scope="col">Due date</th><th scope="col">Amount</th><th scope="col">Paid</th><th scope="col">Balance</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        '<h4 class="plan-sub">Payment history</h4><div class="table-scroll"><table class="data mini"><caption class="sr-only">Payment history for visit ' + n + '</caption><thead><tr><th scope="col">Date</th><th scope="col">Applied to</th><th scope="col">Amount</th></tr></thead><tbody>' + hist + "</tbody></table></div></div></details>";
}
function renderInstallments() {
    var asc = visitsAsc(billPatient), plans = asc.filter(isPlan), h = "";
    if (!plans.length) { $("#billBody").innerHTML = '<div class="box"><p>No installment plans for this patient. Choose <b>Installment</b> as the payment option when recording a treatment visit and the schedule appears here.</p></div>'; return; }
    var active = plans.filter(function (v) { return vBal(v) > 0; }).reverse(), done = plans.filter(function (v) { return vBal(v) <= 0; }).reverse();
    if (active.length) h += '<h3 class="rec-head">Active plans (' + active.length + ")</h3>" + active.map(function (v) { return planCard(v, asc.indexOf(v) + 1, true); }).join("");
    if (done.length) h += '<h3 class="rec-head">Completed plans (' + done.length + ")</h3>" + done.map(function (v) { return planCard(v, asc.indexOf(v) + 1, false); }).join("");
    $("#billBody").innerHTML = h;
}

/* ---- billing: record a payment (an installment, or the balance of a non-installment visit) ----*/
function payTargets(p) {
    var t = [];
    visitsAsc(p).forEach(function (v) {
        if (isPlan(v)) instRows(v).forEach(function (r) { if (r.bal > 0) t.push({ key: v.id + "|" + r.n, v: v, n: r.n, amt: r.bal, row: r }); });
        else if (vBal(v) > 0) t.push({ key: v.id + "|0", v: v, n: 0, amt: vBal(v) });
    });
    return t;
}
function payLabel(t) {
    var vd = "visit " + fmtDate(t.v.date);
    if (!t.n) return fmtDate(t.v.date) + ": " + procSummary(t.v) + " (balance " + peso(t.amt) + ")";
    return "Installment " + t.n + " of " + t.v.months + " · due " + fmtDate(t.row.due) + " · " + peso(t.amt) + " left · " + t.row.status[1] + " (" + vd + ")";
}
function payModal(preId, preN) {
    var targets = payTargets(billPatient);
    if (!targets.length) return;
    var def = targets.filter(function (t) { return t.v.id == preId && (!preN || t.n == preN); })[0] || targets.filter(function (t) { return t.row && t.row.overdue; })[0] || targets[0];
    function find(key) { return targets.filter(function (t) { return t.key == key; })[0]; }
    modal("Record payment", [
        { l: "Pay for", req: true, v: def.key, opts: targets.map(function (t) { return { value: t.key, label: payLabel(t) }; }),
          change: function (els) { var t = find(els[0].value); if (t) els[1].value = t.amt; } },
        { l: "Amount (₱)", t: "number", req: true, min: 0.01, step: "0.01", v: String(def.amt) }
    ], "Record payment", function (vals) {
        var t = find(vals[0]), a = parseFloat(vals[1]);
        if (!t) return { msg: "Choose what this payment is for.", i: 0 };
        if (!Number.isFinite(a) || !(a > 0)) return { msg: "Enter an amount greater than zero.", i: 1 };
        var v = t.v, left = t.n ? instRows(v)[t.n - 1].bal : vBal(v); /* re-read at save time */
        if (left <= 0) return { msg: (t.n ? "Installment " + t.n : "This visit") + " is already fully paid.", i: 0 };
        if (a > left + 0.001) return { msg: "Amount is more than the " + peso(left) + " still owed for " + (t.n ? "installment " + t.n : "this visit") + ".", i: 1 };
        v.payments.push({ date: ymd(new Date()), amount: money(a), inst: t.n });
        billTab = billTab == "treatment" ? (isPlan(v) ? "installments" : "records") : billTab; visitOpen[v.id] = true; visitOpen["pl-" + v.id] = true;
        refreshAll();
        notify("ok", "Payment Recorded Successfully!", peso(a) + " applied to " + (t.n ? "installment " + t.n + " of " + v.months : "the " + fmtDate(v.date) + " visit") + ". Balance: " + peso(vBal(v)) + ".");
    });
}
on("#recordPay", function () { payModal(); });
on("#printBtn", function () { billTab = "records"; renderBilling(); window.print(); });
window.addEventListener("beforeprint", function () { $$("details.visit-card").forEach(function (d) { d.open = true; }); });
window.addEventListener("afterprint", function () { if (billPatient) renderBilling(); });

/* ---- settings ---- */
function renderUsers() {
    var h = "<caption class=sr-only>Clinic users</caption><thead><tr><th scope=col>Name</th><th scope=col>Role</th><th scope=col>Status</th></tr></thead><tbody>";
    users.forEach(function (u) { h += "<tr><td>" + esc(u[0]) + "</td><td>" + esc(u[1]) + '</td><td><span class="badge ' + (u[2] == "Active" ? "ok" : "warn") + '">' + u[2] + "</span></td></tr>"; });
    $("#usersTable").innerHTML = h + "</tbody>";
}
function renderMatrix() {
    $("#permsBody").innerHTML = Object.keys(ROLES).map(function (k) {
        var r = ROLES[k];
        return "<tr><td><b>" + esc(r.label) + '</b><small class="role-name">' + esc(r.name) + '</small><small class="role-desc">' + esc(r.desc) + '</small></td><td><span class="badge ' + (r.level == "Full" ? "ok" : "warn") + '">' + r.level + "</span></td>" +
            r.matrix.map(function (t) { return '<td><span class="badge ' + (t == "Full" ? "ok" : t == "No" ? "err" : "warn") + '">' + t + "</span></td>"; }).join("") + "</tr>";
    }).join("");
}
on("#addUser", function () {
    modal("Add user", [{ l: "Full name", req: true, ph: "e.g. Ana Reyes" }, { l: "Role", req: true, opts: Object.keys(ROLES).map(function (k) { return ROLES[k].label; }), v: ROLES.assistant.label }, { l: "Status", opts: ["Active", "Inactive"], v: "Active" }], "Add user", function (v) {
        if (!v[0]) return { msg: "Enter the user's full name.", i: 0 };
        users.push([v[0], v[1], v[2]]); renderUsers();
        notify("ok", "User Added!", v[0] + " was added as " + v[1] + ".");
    });
});

/* ---- shared click handling for generated links/buttons ---- */
document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-open],[data-tab],[data-btab],[data-bill],[data-go],[data-act],[data-slot-date],[data-day]");
    if (!a) return;
    e.preventDefault();
    if (a.dataset.open) openPatient(a.dataset.open);
    else if (a.dataset.tab) { tab = a.dataset.tab; renderTab(); }
    else if (a.dataset.btab) { billTab = a.dataset.btab; renderBilling(); }
    else if (a.dataset.bill) selectBillPatient(a.dataset.bill);
    else if (a.dataset.go) { if (a.dataset.go == "billing") { billPatient = cur; draft = newDraft(); billTab = defaultBillTab(cur, "records"); visitOpen = {}; } showPage(a.dataset.go); }
    else if (a.dataset.slotDate) bookModal({ date: a.dataset.slotDate, hour: Number(a.dataset.slotHour) });
    else if (a.dataset.day) { selectedDay = parseYmd(a.dataset.day); ws = monday(selectedDay); view = "day"; renderCal(); }
    else if (a.dataset.act == "create") createPatient();
    else if (a.dataset.act == "bill-back") { billPatient = null; renderBilling(); $("#search").focus(); }
    else if (a.dataset.act == "tx-add") { if (draft.rows.length < MAX_ROWS) { draft.rows.push(blankRow()); renderTxForm(); var s = $$('[data-tx="proc"]'); s[s.length - 1].focus(); } }
    else if (a.dataset.act == "tx-del") { if (draft.rows.length > 1 && draft.rows[+a.dataset.i].src != "booked") { draft.rows.splice(+a.dataset.i, 1); renderTxForm(); } }
    else if (a.dataset.act == "pay") payModal(a.dataset.v, a.dataset.n ? Number(a.dataset.n) : 0);
    else if (a.dataset.act == "note") {
        var t = $("#noteIn").value.trim();
        if (!t) notify("warn", "Note Is Empty", "Write a note before adding it.");
        else { cur.notes.unshift({ date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }), text: t }); renderTab(); notify("ok", "Note Added!", "Saved to " + fullName(cur) + "'s record."); }
    }
});

document.querySelectorAll(".data").forEach(function (t) { var w = document.createElement("div"); w.className = "table-scroll"; t.parentNode.insertBefore(w, t); w.appendChild(t); });
function renderAll() { renderCal(); renderPatients(); renderBillPatients(); renderUsers(); renderMatrix(); renderBilling(); renderTab(); }
renderAll();
applyRolePermissions();
if (currentRole) {
    var startPage = location.hash ? location.hash.slice(1) : "";
    showPage(ROLES[currentRole].pages.indexOf(startPage) !== -1 ? startPage : "calendar");
}
