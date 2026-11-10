var loginBox = document.getElementById("login");
var app = document.getElementById("app");
var pages = document.querySelectorAll(".page");
var navLinks = document.querySelectorAll(".nav a");
var pageLinks = document.querySelectorAll("[data-page]");

function showPage(name) {
    loginBox.style.display = "none";
    app.style.display = "flex";

    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove("active");
    }
    document.getElementById(name).classList.add("active");

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
}

for (var i = 0; i < pageLinks.length; i++) {
    pageLinks[i].addEventListener("click", function (e) {
        e.preventDefault();
        showPage(this.dataset.page);
    });
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    showPage("calendar");
});

if (location.hash) {
    showPage(location.hash.slice(1));
}

//.
/* ===== DentSync interactions (in-memory demo data, resets on refresh) ===== */
var $ = function (s) { return document.querySelector(s); };
var peso = function (n) { return "₱ " + Number(n).toLocaleString("en-US"); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
function on(sel, fn) { $(sel).addEventListener("click", function (e) { e.preventDefault(); fn(e); }); }
function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function row(d, t, p, c, paid) { return { date: d, tooth: t, proc: p, dentist: "Dr. [Name]", cost: c, paid: paid }; }

var patients = [
    { id: "P-002", name: "Trishia Maralit", phone: "09xx xxx xxxx", birth: "2006-11-02", last: "Nov 02", tx: [row("10/28", "#14", "Filling", 1500, 1500), row("11/02", "#26", "Extraction", 2000, 800), row("11/28", "#11", "Cleaning", 800, 800), row("12/15", "#12", "Cleaning", 800, 0)], notes: [] },
    { id: "P-003", name: "Lysa Joy", phone: "09xx xxx xxxx", last: "May 05", tx: [row("05/05", "#26", "Extraction", 2000, 800)], notes: [] },
    { id: "P-004", name: "Lanz Amwel", phone: "09xx xxx xxxx", last: "Dec 21", tx: [row("12/21", "#8", "Consultation", 500, 0)], notes: [] },
    { id: "P-005", name: "Grace Dela Cruz", phone: "09xx xxx xxxx", last: "June 13", tx: [row("06/13", "#3", "X-ray", 200, 0)], notes: [] },
    { id: "P-006", name: "Andrea Kaye", phone: "09xx xxx xxxx", last: "Aug 19", tx: [row("08/19", "#14", "Filling", 1500, 500)], notes: [] }
];
var users = [["Dr. [Name]", "Dentist / Owner", "Active"], ["[Name]", "Business partner / Secretary", "Active"], ["[Name]", "Dental assistant", "Active"]];
var cur = patients[0], tab = "overview", bookings = [];
var hours = ["9:00", "10:00", "11:00", "12:00", "1:00", "2:00", "3:00"];
var bal = function (p) { return p.tx.reduce(function (a, t) { return a + t.cost - t.paid; }, 0); };

/* page hook: refresh the ledger whenever Billing opens */
var baseShow = showPage;
showPage = function (n) { baseShow(n); if (n == "billing") renderBilling(); };

/* ---- modal ---- */
var dlg = $("#dlg");
function modal(title, fields, cta, ok) {
    $("#dlgTitle").textContent = title; $("#dlgErr").textContent = ""; $("#dlgOk").textContent = cta;
    $("#dlgBody").innerHTML = fields.map(function (f, i) {
        var c = f.opts ? "<select id='f" + i + "'>" + f.opts.map(function (o) { return "<option>" + esc(o) + "</option>"; }).join("") + "</select>"
            : "<input id='f" + i + "' type='" + (f.t || "text") + "' placeholder='" + esc(f.ph || "") + "' value='" + esc(f.v || "") + "'" + (f.t == "number" ? " min='0' step='any'" : "") + ">";
        return "<label for='f" + i + "'>" + f.l + "</label>" + c;
    }).join("");
    fields.forEach(function (f, i) { if (f.opts && f.v) $("#f" + i).value = f.v; });
    $("#dlgForm").onsubmit = function (e) {
        e.preventDefault();
        if (!this.reportValidity()) return;
        var err = ok(fields.map(function (f, i) { return $("#f" + i).value.trim(); }));
        if (err) $("#dlgErr").textContent = err; else dlg.close();
    };
    dlg.showModal(); $("#f0").focus();
}
$("#dlgCancel").onclick = function () { dlg.close(); };

/* This front-end demo has no account server or email delivery service. */
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
    if (dlg.open) dlg.close();
    app.style.display = "none";
    loginBox.style.display = "flex";
    $("#loginForm").reset();
    $("#loginStatus").textContent = "You have been logged out.";
    $("#search").value = "";
    renderPatients();
    pages.forEach(function (page) { page.classList.remove("active"); });
    navLinks.forEach(function (link) {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
    });
    history.replaceState(null, "", location.pathname + location.search);
    $("#email").focus();
});

/* ---- calendar (auto-built week, sample events are mockup only) ---- */
function monday(d) { d = new Date(d); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
var ws = monday(new Date()), selectedDay = new Date(), dayView = false, mock = [[0, 0], [2, 0], [1, 1], [5, 1], [3, 2], [4, 3]];
function renderCal() {
    var today = ymd(new Date()), cols = [0, 1, 2, 3, 4, 5];
    if (dayView) cols = [Math.round((new Date(ymd(selectedDay) + "T00:00") - ws) / 864e5)];
    function dt(c) { var d = new Date(ws); d.setDate(d.getDate() + c); return d; }
    var h = "<caption class=sr-only>Appointment schedule</caption><thead><tr><th scope=col>Time</th>";
    cols.forEach(function (c) { var d = dt(c); h += "<th scope=col" + (ymd(d) == today ? ' class="today"' : "") + ">" + d.toLocaleDateString("en-US", { weekday: "short" }) + " " + d.getDate() + "</th>"; });
    h += "</tr></thead><tbody>";
    hours.forEach(function (t, r) {
        h += '<tr><th scope="row" class="time">' + t + "</th>";
        cols.forEach(function (c) {
            var ev = "", k = ymd(dt(c));
            mock.forEach(function (m) { if (m[0] == c && m[1] == r) ev += '<div class="event"><b>Patient Name</b>Procedure</div>'; });
            bookings.forEach(function (b) { if (b.date == k && b.h == r) ev += '<div class="event"><b>' + esc(b.name) + "</b>" + esc(b.proc) + "</div>"; });
            h += "<td>" + ev + "</td>";
        });
        h += "</tr>";
    });
    $("#calGrid").innerHTML = h + "</tbody>";
    $("#calMonth").textContent = (dayView ? selectedDay : ws).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    $("#viewWeek").classList.toggle("gray", !dayView); $("#viewDay").classList.toggle("gray", dayView);
    $("#viewWeek").setAttribute("aria-pressed", String(!dayView));
    $("#viewDay").setAttribute("aria-pressed", String(dayView));
    $("#calPrev").setAttribute("aria-label", dayView ? "Previous day" : "Previous week");
    $("#calNext").setAttribute("aria-label", dayView ? "Next day" : "Next week");
}
function moveCalendar(direction) {
    selectedDay.setDate(selectedDay.getDate() + direction * (dayView ? 1 : 7));
    ws = monday(selectedDay); renderCal();
}
on("#calPrev", function () { moveCalendar(-1); });
on("#calNext", function () { moveCalendar(1); });
on("#calToday", function () { selectedDay = new Date(); ws = monday(selectedDay); renderCal(); });
on("#viewWeek", function () { dayView = false; renderCal(); });
on("#viewDay", function () { dayView = true; renderCal(); });
function bookModal(preset) {
    modal("New booking", [{ l: "Patient", opts: patients.map(function (p) { return p.name; }), v: preset ? cur.name : "" }, { l: "Procedure", ph: "e.g. Cleaning" }, { l: "Date", t: "date", v: ymd(new Date()) }, { l: "Time", opts: hours }], "Save booking", function (v) {
        if (!v[1]) return "Enter the procedure.";
        var d = new Date(v[2] + "T00:00");
        if (isNaN(d)) return "Choose a date.";
        if (d.getDay() === 0) return "The calendar runs Monday to Saturday. Pick another day.";
        bookings.push({ date: v[2], h: hours.indexOf(v[3]), name: v[0], proc: v[1] });
        selectedDay = d; ws = monday(d); renderCal(); showPage("calendar");
    });
}
on("#newBooking", function () { bookModal(false); });
on("#bookBtn", function () { bookModal(true); });

/* ---- search ---- */
$("#search").addEventListener("input", function () { renderPatients(this.value); if (this.value.trim()) showPage("patients"); });

/* ---- patients ---- */
function renderPatients(q) {
    q = (q || "").trim().toLowerCase();
    var h = "<caption class=sr-only>Patient directory</caption><thead><tr><th scope=col>ID</th><th scope=col>Name</th><th scope=col>Phone</th><th scope=col>Last Visit</th><th scope=col>Balance</th></tr></thead><tbody>", n = 0;
    patients.forEach(function (p) {
        if (q && (p.id + p.name + p.phone).toLowerCase().indexOf(q) < 0) return;
        n++;
        h += '<tr><td>' + p.id + '</td><td><a href="#patient" data-open="' + p.id + '">' + esc(p.name) + "</a></td><td>" + esc(p.phone) + "</td><td>" + esc(p.last) + '</td><td class="' + (bal(p) ? "warn" : "ok") + '">' + peso(bal(p)) + "</td></tr>";
    });
    if (!n) h += '<tr><td colspan="5">No patients match “' + esc(q) + "”. Try a name, ID, or phone number.</td></tr>";
    $("#patientTable").innerHTML = h + "</tbody>";
}
function npMsg(h) { $("#npResult").innerHTML = h; }
on("#newPatientBtn", function () { $("#npName").scrollIntoView({ behavior: "smooth", block: "center" }); $("#npName").focus(); });
$("#npForm").addEventListener("submit", function (e) { e.preventDefault(); $("#npCheck").click(); });
$("#npForm").addEventListener("input", function () { npMsg("<p>Check the name and birthdate first. Any matching record appears here.</p>"); });
on("#npCheck", function () {
    var n = $("#npName").value.trim().toLowerCase(), b = $("#npBirth").value;
    if (!n || !b) return npMsg('<p class="form-error">Enter the full name and birthdate to check for an existing record.</p>');
    var m = patients.filter(function (p) { return p.name.toLowerCase() == n || (p.birth == b && p.name.toLowerCase().indexOf(n.split(" ")[0]) > -1); })[0];
    if (m) npMsg("<b>Possible existing record</b><p>" + m.id + " " + esc(m.name) + "<br>Born " + (m.birth || "not recorded") + '</p><a href="#patient" class="action-btn open-btn" data-open="' + m.id + '">Open record</a>');
    else npMsg("<b>No existing record found</b><p>It is safe to create a record for " + esc($("#npName").value.trim()) + '.</p><button type="button" class="action-btn open-btn" data-act="create">Create patient</button>');
});
function createPatient() {
    var nums = patients.map(function (p) { return parseInt(p.id.slice(2), 10); }), id = "P-" + ("00" + (Math.max.apply(null, nums) + 1)).slice(-3);
    var p = { id: id, name: $("#npName").value.trim(), phone: $("#npPhone").value.trim() || "—", birth: $("#npBirth").value, last: "—", tx: [], notes: [] };
    patients.push(p); renderPatients($("#search").value);
    $("#npForm").reset();
    npMsg('<b class="ok">Patient added</b><p>' + id + " " + esc(p.name) + ' is now in the list.</p><a href="#patient" class="action-btn open-btn" data-open="' + id + '">Open record</a>');
}

/* ---- patient record tabs ---- */
function openPatient(id) { cur = patients.filter(function (p) { return p.id == id; })[0]; tab = "overview"; renderTab(); showPage("patient"); }
function age(b) { if (!b) return "—"; var d = new Date(b), n = new Date(), a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a + " yrs (" + b + ")"; }
function fld(l, v) { return "<p><b>" + l + ":</b> " + esc(v || "—") + "</p>"; }
function renderTab() {
    var p = cur, h = "";
    $("#pName").textContent = p.name; $("#pId").textContent = p.id;
    document.querySelectorAll("[data-tab]").forEach(function (a) { a.classList.toggle("current", a.dataset.tab == tab); a.setAttribute("aria-pressed", String(a.dataset.tab == tab)); });
    var contact = '<div class="box"><h3>Contact details</h3>' + fld("Age / birthdate", age(p.birth)) + fld("Phone", p.phone) + fld("Address", p.address) + fld("Emergency contact", p.emergency) + "</div>";
    var med = '<div class="box"><h3>Medical condition</h3>' + fld("Conditions", p.conditions) + fld("Allergies", p.allergies) + fld("Medications", p.meds) + fld("Notes for dentist", p.dnote) + "</div>";
    if (tab == "overview") {
        h = '<div class="boxes">' + contact + med + '</div><div class="box visits"><h3>Recent visits and post-op notes</h3>';
        p.tx.slice().reverse().forEach(function (t) { h += '<div class="visit"><span>' + t.date + "</span><span>" + esc(t.tooth + " " + t.proc) + "</span><span>" + esc(t.dentist) + "</span><small>" + (t.note ? esc(t.note) : "No post-op note recorded.") + "</small></div>"; });
        if (!p.tx.length) h += '<div class="visit"><small>No visits yet. Use Book to schedule the first appointment.</small></div>';
        h += "</div>";
    } else if (tab == "medical") {
        h = '<div class="boxes">' + med + '<div class="box sum"><h3>Emergency contact</h3>' + fld("Name and phone", p.emergency) + "</div></div>";
    } else if (tab == "treatments") {
        h = '<div class="table-scroll"><table class="data"><caption class="sr-only">Patient treatments</caption><thead><tr><th scope=col>Date</th><th scope=col>Tooth</th><th scope=col>Procedure</th><th scope=col>Dentist</th><th scope=col>Status</th></tr></thead><tbody>';
        p.tx.forEach(function (t) { var b = t.cost - t.paid; h += "<tr><td>" + t.date + "</td><td>" + esc(t.tooth) + "</td><td>" + esc(t.proc) + "</td><td>" + esc(t.dentist) + '</td><td><span class="badge ' + (!b ? "ok" : t.paid ? "warn" : "err") + '">' + (!b ? "Paid" : t.paid ? "Partial" : "Unpaid") + "</span></td></tr>"; });
        if (!p.tx.length) h += '<tr><td colspan="5">No treatments recorded yet.</td></tr>';
        h += "</tbody></table></div>";
    } else if (tab == "billing") {
        var cost = p.tx.reduce(function (a, t) { return a + t.cost; }, 0);
        h = '<div class="boxes"><div class="box sum"><h3>Total billed</h3><p class="big">' + peso(cost) + '</p></div><div class="box sum"><h3>Outstanding balance</h3><p class="big ' + (bal(p) ? "warn" : "ok") + '">' + peso(bal(p)) + '</p></div></div><p style="margin-top:20px"><a href="#billing" class="btn gray" data-go="billing">Open full ledger</a></p>';
    } else {
        h = '<div class="box"><h3>Notes</h3>';
        p.notes.forEach(function (n) { h += "<p><b>" + n.date + ":</b> " + esc(n.text) + "</p>"; });
        if (!p.notes.length) h += "<p>No notes yet. Add the first one below.</p>";
        h += '<div class="note-form"><input id="noteIn" type="text" placeholder="Write a note about this patient" aria-label="New note"><button type="button" class="btn gray" data-act="note">Add note</button></div></div>';
    }
    $("#tabBody").innerHTML = h;
}

/* ---- billing ---- */
function renderBilling() {
    var p = cur;
    $("#ledgerName").textContent = p.name;
    var h = "<caption class=sr-only>Patient ledger</caption><thead><tr><th scope=col>Date</th><th scope=col>Tooth</th><th scope=col>Procedure</th><th scope=col>Dentist</th><th scope=col>Cost</th><th scope=col>Paid</th><th scope=col>Balance</th></tr></thead><tbody>";
    p.tx.forEach(function (t) { var b = t.cost - t.paid; h += "<tr><td>" + t.date + "</td><td>" + esc(t.tooth) + "</td><td>" + esc(t.proc) + "</td><td>" + esc(t.dentist) + "</td><td>" + peso(t.cost) + "</td><td>" + peso(t.paid) + '</td><td class="' + (b ? "warn" : "ok") + '">' + peso(b) + "</td></tr>"; });
    if (!p.tx.length) h += '<tr><td colspan="7">No treatments yet. Choose Add treatment to start this ledger.</td></tr>';
    $("#ledgerTable").innerHTML = h + "</tbody>"; $("#balTotal").textContent = peso(bal(p));
}
function refreshAll() { renderBilling(); renderPatients($("#search").value); renderTab(); }
on("#editPatientBtn", function () {
    var patient = cur;
    var fields = [
        { l: "Full name", v: patient.name }, { l: "Birthdate", t: "date", v: patient.birth },
        { l: "Phone", t: "tel", v: patient.phone }, { l: "Address", v: patient.address },
        { l: "Emergency contact", v: patient.emergency }, { l: "Conditions", v: patient.conditions },
        { l: "Allergies", v: patient.allergies }, { l: "Medications", v: patient.meds },
        { l: "Notes for dentist", v: patient.dnote }
    ];
    modal("Edit patient", fields, "Save changes", function (v) {
        if (!v[0]) return "Enter the patient's full name.";
        if (v[1] && v[1] > ymd(new Date())) return "Birthdate cannot be in the future.";
        var keys = ["name", "birth", "phone", "address", "emergency", "conditions", "allergies", "meds", "dnote"];
        // Keep existing appointments in sync with a changed patient name.
        bookings.forEach(function (b) { if (b.name === patient.name) b.name = v[0]; });
        keys.forEach(function (key, i) { patient[key] = v[i]; });
        refreshAll(); renderCal();
    });
});
on("#addTx", function () {
    modal("Add treatment", [{ l: "Date", t: "date", v: ymd(new Date()) }, { l: "Tooth", ph: "e.g. #14" }, { l: "Procedure", ph: "e.g. Filling" }, { l: "Dentist", v: "Dr. [Name]" }, { l: "Cost (₱)", t: "number" }, { l: "Paid now (₱)", t: "number", v: "0" }], "Add treatment", function (v) {
        var c = parseFloat(v[4]), pd = parseFloat(v[5] || 0);
        if (!v[0] || !v[1] || !v[2]) return "Fill in the date, tooth, and procedure.";
        if (!Number.isFinite(c) || !(c > 0)) return "Enter a cost greater than zero.";
        if (!Number.isFinite(pd) || pd < 0 || pd > c) return "Paid amount must be between ₱ 0 and the cost.";
        cur.tx.push({ date: v[0].slice(5).replace("-", "/"), tooth: v[1], proc: v[2], dentist: v[3] || "Dr. [Name]", cost: c, paid: pd });
        cur.last = new Date(v[0] + "T00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" });
        refreshAll();
    });
});
on("#recordPay", function () {
    modal("Record payment", [{ l: "Amount (₱)", t: "number", ph: "Outstanding: " + peso(bal(cur)) }, { l: "Method", opts: ["Cash", "GCash", "Card", "Bank transfer"] }], "Record payment", function (v) {
        var a = parseFloat(v[0]);
        if (!bal(cur)) return "This ledger has no outstanding balance.";
        if (!Number.isFinite(a) || !(a > 0)) return "Enter an amount greater than zero.";
        if (a > bal(cur)) return "Amount is more than the outstanding balance of " + peso(bal(cur)) + ".";
        cur.tx.forEach(function (t) { var take = Math.min(t.cost - t.paid, a); t.paid += take; a -= take; });
        refreshAll();
    });
});
on("#printBtn", function () { window.print(); });

/* ---- settings ---- */
function renderUsers() {
    var h = "<caption class=sr-only>Clinic users</caption><thead><tr><th scope=col>Name</th><th scope=col>Role</th><th scope=col>Status</th></tr></thead><tbody>";
    users.forEach(function (u) { h += "<tr><td>" + esc(u[0]) + "</td><td>" + esc(u[1]) + '</td><td><span class="badge ' + (u[2] == "Active" ? "ok" : "warn") + '">' + u[2] + "</span></td></tr>"; });
    $("#usersTable").innerHTML = h + "</tbody>";
}
on("#addUser", function () {
    modal("Add user", [{ l: "Full name", ph: "e.g. Ana Reyes" }, { l: "Role", opts: ["Dentist / Owner", "Business partner / Secretary", "Dental assistant"] }, { l: "Status", opts: ["Active", "Inactive"] }], "Add user", function (v) {
        if (!v[0]) return "Enter the user's full name.";
        users.push([v[0], v[1], v[2]]); renderUsers();
    });
});
document.querySelectorAll(".perms-table td:not(:first-child)").forEach(function (td) {
    var t = td.textContent.trim(), c = t == "Full" ? "ok" : t == "No" ? "err" : "warn";
    td.innerHTML = '<span class="badge ' + c + '">' + t + "</span>";
});

/* ---- shared click handling for generated links/buttons ---- */
document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-open],[data-tab],[data-go],[data-act]");
    if (!a) return;
    e.preventDefault();
    if (a.dataset.open) openPatient(a.dataset.open);
    else if (a.dataset.tab) { tab = a.dataset.tab; renderTab(); }
    else if (a.dataset.go) showPage(a.dataset.go);
    else if (a.dataset.act == "create") createPatient();
    else if (a.dataset.act == "note") {
        var t = $("#noteIn").value.trim();
        if (t) { cur.notes.unshift({ date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }), text: t }); renderTab(); }
    }
});

document.querySelectorAll(".data").forEach(function (t) { var w = document.createElement("div"); w.className = "table-scroll"; t.parentNode.insertBefore(w, t); w.appendChild(t); });
renderCal(); renderPatients(); renderUsers(); renderBilling(); renderTab();
