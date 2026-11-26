var loginBox = document.getElementById("login");
var app = document.getElementById("app");
var $ = function (s) { return document.querySelector(s); };
var pages = document.querySelectorAll(".page");
var navLinks = document.querySelectorAll(".nav a");
var pageLinks = document.querySelectorAll("[data-page]");
var currentRole = null;
var currentUserName = "";
var roleLabels = {
    owner: "Dentist / Owner",
    secretary: "Business Partner / Secretary",
    assistant: "Dental Assistant"
};
var rolePermissions = {
    owner: ["calendar", "patients", "patient", "billing", "settings"],
    secretary: ["calendar", "patients", "patient", "billing"],
    assistant: ["calendar", "logistics"]
};
var readyAccounts = [
    { email: "owner@dentsync.local", password: "DentSyncOwner!2026", name: "Clinic Owner", role: "owner" },
    { email: "secretary@dentsync.local", password: "DentSyncSecretary!2026", name: "Clinic Secretary", role: "secretary" },
    { email: "assistant@dentsync.local", password: "DentSyncAssistant!2026", name: "Dental Assistant", role: "assistant" }
];
function applyRolePermissions() {
    var allowed = currentRole ? rolePermissions[currentRole] : [];
    navLinks.forEach(function (link) {
        link.hidden = allowed.indexOf(link.dataset.page) === -1;
    });
    $("#newBooking").hidden = !canManageAppointments();
    $("#bookBtn").hidden = !canManageAppointments();
    if (currentRole) {
        $(".user-name").textContent = currentUserName + " (" + roleLabels[currentRole] + ")";
        $(".avatar").textContent = currentRole === "owner" ? "DR" : currentRole === "secretary" ? "BP" : "DA";
    }
}
function canManageAppointments() {
    return currentRole === "owner" || currentRole === "secretary";
}

function showPage(name) {
    if (!currentRole) return;
    if (rolePermissions[currentRole].indexOf(name) === -1) {
        name = "calendar";
    }
    history.replaceState(null, "", location.pathname + location.search + "#" + name);
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

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!this.reportValidity()) return;
    var email = $("#email").value.trim().toLowerCase();
    var password = $("#password").value;
    var selectedRole = $("#role").value;
    try {
        if (!storageReady) throw new Error(storageError);
        var account = accounts.filter(function (candidate) { return candidate.email === email; })[0];
        if (!account || account.role !== selectedRole || account.status !== "Active" || !await verifyPassword(password, account)) {
            throw new Error("Email, password, and selected role must match an active account.");
        }
        currentRole = account.role;
        currentUserName = account.name;
        sessionStorage.setItem("dentsyncRole", currentRole);
        sessionStorage.setItem("dentsyncUser", currentUserName);
        sessionStorage.setItem("dentsyncEmail", account.email);
        $("#password").value = "";
        $("#loginStatus").textContent = "";
        applyRolePermissions();
        renderCal();
        renderPatients($("#search").value);
        renderBilling();
        renderTab();
        renderUsers();
        var allowed = rolePermissions[currentRole];
        var hashName = location.hash ? location.hash.slice(1) : "";
        showPage(allowed.indexOf(hashName) !== -1 ? hashName : "calendar");
    } catch (error) {
        $("#loginStatus").textContent = error.message || "Sign-in failed.";
    }
});

/* ===== Browser-persisted local records. ===== */
var peso = function (n) { return "₱ " + Number(n).toLocaleString("en-US"); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
function on(sel, fn) { $(sel).addEventListener("click", function (e) { e.preventDefault(); fn(e); }); }
function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function bytesToHex(bytes) { return Array.from(new Uint8Array(bytes)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
function hexToBytes(hex) { return new Uint8Array(hex.match(/.{2}/g).map(function (byte) { return parseInt(byte, 16); })); }
async function derivePassword(password, salt) {
    if (!crypto.subtle) throw new Error("Secure password hashing is unavailable. Open DentSync over HTTPS or localhost.");
    var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: 310000, hash: "SHA-256" }, key, 256);
}
async function makePasswordHash(password) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return { salt: bytesToHex(salt), hash: bytesToHex(await derivePassword(password, salt)) };
}
async function verifyPassword(password, account) {
    var actual = new Uint8Array(await derivePassword(password, hexToBytes(account.salt)));
    var expected = hexToBytes(account.passwordHash), difference = actual.length ^ expected.length;
    for (var i = 0; i < Math.min(actual.length, expected.length); i++) difference |= actual[i] ^ expected[i];
    return difference === 0;
}
function row(d, t, p, c, paid) { return { date: d, tooth: t, proc: p, dentist: "Dr. [Name]", cost: c, paid: paid }; }

var patients = [
    { id: "P-002", name: "Trishia Maralit", phone: "09xx xxx xxxx", birth: "2006-11-02", last: "Nov 02", tx: [row("10/28", "#14", "Filling", 1500, 1500), row("11/02", "#26", "Extraction", 2000, 800), row("11/28", "#11", "Cleaning", 800, 800), row("12/15", "#12", "Cleaning", 800, 0)], notes: [] },
    { id: "P-003", name: "Lysa Joy", phone: "09xx xxx xxxx", last: "May 05", tx: [row("05/05", "#26", "Extraction", 2000, 800)], notes: [] },
    { id: "P-004", name: "Lanz Amwel", phone: "09xx xxx xxxx", last: "Dec 21", tx: [row("12/21", "#8", "Consultation", 500, 0)], notes: [] },
    { id: "P-005", name: "Grace Dela Cruz", phone: "09xx xxx xxxx", last: "June 13", tx: [row("06/13", "#3", "X-ray", 200, 0)], notes: [] },
    { id: "P-006", name: "Andrea Kaye", phone: "09xx xxx xxxx", last: "Aug 19", tx: [row("08/19", "#14", "Filling", 1500, 500)], notes: [] }
];
var users = [["Dr. [Name]", "Dentist / Owner", "Active"], ["[Name]", "Business partner / Secretary", "Active"], ["[Name]", "Dental assistant", "Active"]];
var accounts = [];
var storageKey = "dentsync-demo-v1", storedState = null, storageReady = true, storageError = "";
try {
    var saved = localStorage.getItem(storageKey);
    if (saved) {
        storedState = JSON.parse(saved);
        if (!Array.isArray(storedState.patients) || !Array.isArray(storedState.users) || !Array.isArray(storedState.bookings)) {
            throw new Error("Saved local data has an unsupported format.");
        }
        patients = storedState.patients;
        users = storedState.users;
        accounts = Array.isArray(storedState.accounts) ? storedState.accounts : [];
    }
} catch (error) {
    storageReady = false;
    storedState = null;
    storageError = "Saved local data could not be read (" + error.message + "). The app is read-only to protect it; export or clear this site's storage only if you understand the consequences.";
}
patients.forEach(function (p) {
    if (!Array.isArray(p.tx)) p.tx = [];
    if (!Array.isArray(p.notes)) p.notes = [];
    if (!Array.isArray(p.payments)) p.payments = [];
});
var savedPatientId = sessionStorage.getItem("dentsyncCurrentPatient");
var cur = patients.filter(function (p) { return p.id === savedPatientId; })[0] || patients[0];
var tab = "overview", bookings = storedState ? storedState.bookings : [];
var bufferMinutes = storedState && Number.isFinite(storedState.bufferMinutes) ? storedState.bufferMinutes : 30;
var supplies = storedState && Array.isArray(storedState.supplies) ? storedState.supplies : [
    ["Gloves (boxes)", "12", "In stock"], ["Masks (boxes)", "8", "In stock"], ["Dental bibs", "2", "Reorder soon"]
];
var hours = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30", "4:00", "4:30"];
var bal = function (p) { return p.tx.reduce(function (a, t) { return a + t.cost - (t.discount || 0) - t.paid; }, 0); };
function notice(message) { $("#appNotice").textContent = message; }
function canMutate() {
    if (!storageReady) { notice(storageError); return false; }
    if (!navigator.onLine) { notice("Offline mode is read-only. Reconnect to make changes."); return false; }
    return true;
}
function saveFailureMessage() {
    return storageError || (!navigator.onLine ? "Offline mode is read-only. Reconnect to save changes." : "Changes could not be saved.");
}
function captureLocalState() {
    return JSON.stringify({
        patients: patients, users: users, accounts: accounts, bookings: bookings,
        bufferMinutes: bufferMinutes, supplies: supplies
    });
}
function restoreLocalState(snapshot) {
    var patientId = cur && cur.id;
    var state = JSON.parse(snapshot);
    patients = state.patients;
    users = state.users;
    accounts = state.accounts;
    bookings = state.bookings;
    bufferMinutes = state.bufferMinutes;
    supplies = state.supplies;
    cur = patients.filter(function (patient) { return patient.id === patientId; })[0] || patients[0];
    renderCal();
    renderPatients($("#search").value);
    renderUsers();
    renderSupplies();
    renderBilling();
    renderTab();
    $("#bufferMinutes").value = bufferMinutes;
}
function saveData() {
    if (!canMutate()) return false;
    try {
        localStorage.setItem(storageKey, JSON.stringify({
            patients: patients, users: users, accounts: accounts, bookings: bookings,
            bufferMinutes: bufferMinutes, supplies: supplies
        }));
        return true;
    } catch (error) {
        storageReady = false;
        storageError = "Could not save local data (" + error.message + "). Changes will not persist; the app is now read-only.";
        updateNetworkState();
        return false;
    }
}
function updateNetworkState() {
    if (!storageReady) notice(storageError);
    else if (!navigator.onLine) notice("Offline mode: recently stored records are read-only.");
    else notice("Local mode — changes are saved in this browser only. Data is not encrypted or backed up; use test data.");
    document.querySelectorAll("#newBooking, #bookBtn, #editPatientBtn, #addTx, #recordPay, #addUser, #saveBuffer, #npCheck").forEach(function (button) {
        button.disabled = !navigator.onLine || !storageReady;
    });
}
function updateAuthSetup() {
    $("#authHelp").textContent = "Choose the role for this sign-in. The selected role must match the account.";
    $("#signinBtn").textContent = "Sign In";
    $("#password").setAttribute("autocomplete", "current-password");
}
async function initializeLocalAccounts() {
    if (!accounts.length) {
        var seededAccounts = await Promise.all(readyAccounts.map(async function (ready) {
            var credentials = await makePasswordHash(ready.password);
            return {
                email: ready.email, name: ready.name, role: ready.role, status: "Active",
                salt: credentials.salt, passwordHash: credentials.hash, isReadyMade: true
            };
        }));
        accounts = seededAccounts;
        users = seededAccounts.map(function (account) {
            return [account.name, roleLabels[account.role], account.status, account.email];
        });
        if (!saveData()) throw new Error(storageError || "Ready-made accounts could not be saved.");
    } else {
        var renamed = false;
        accounts.forEach(function (account) {
            var ready = readyAccounts.filter(function (candidate) { return candidate.email === account.email; })[0];
            var user = users.filter(function (candidate) { return candidate[3] === account.email; })[0];
            if (!account.isReadyMade || !ready) return;
            if (account.name !== ready.name) {
                account.name = ready.name;
                renamed = true;
            }
            if (user && user[0] !== ready.name) {
                user[0] = ready.name;
                renamed = true;
            }
        });
        if (renamed && !saveData()) throw new Error(storageError || "Local account names could not be updated.");
    }
    updateAuthSetup();
    restoreSession();
    renderUsers();
    renderCal();
    renderPatients($("#search").value);
    renderSupplies();
    renderBilling();
    renderTab();
}
function restoreSession() {
    var email = sessionStorage.getItem("dentsyncEmail");
    var account = accounts.filter(function (candidate) { return candidate.email === email && candidate.status === "Active"; })[0];
    if (!account || sessionStorage.getItem("dentsyncRole") !== account.role) {
        sessionStorage.removeItem("dentsyncRole");
        sessionStorage.removeItem("dentsyncUser");
        sessionStorage.removeItem("dentsyncEmail");
        currentRole = null;
        currentUserName = "";
        applyRolePermissions();
        return;
    }
    currentRole = account.role;
    currentUserName = account.name;
    applyRolePermissions();
    var pageName = location.hash ? location.hash.slice(1) : "calendar";
    showPage(rolePermissions[currentRole].indexOf(pageName) !== -1 ? pageName : "calendar");
}
window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);
updateNetworkState();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function (error) {
        notice("Offline app cache could not be installed: " + error.message);
    });
}

/* page hook: refresh the ledger whenever Billing opens */
var baseShow = showPage;
showPage = function (n) { baseShow(n); if (n == "billing") renderBilling(); };

/* ---- modal ---- */
var dlg = $("#dlg");
function modal(title, fields, cta, ok, readOnly) {
    $("#dlgTitle").textContent = title; $("#dlgErr").textContent = ""; $("#dlgOk").textContent = cta;
    $("#dlgBody").innerHTML = fields.map(function (f, i) {
        var required = f.required ? " required" : "";
        var c = f.opts ? "<select id='f" + i + "'>" + f.opts.map(function (o) {
            var value = typeof o === "string" ? o : o.value;
            var label = typeof o === "string" ? o : o.label;
            return "<option value='" + esc(value) + "'>" + esc(label) + "</option>";
        }).join("") + "</select>"
            : "<input id='f" + i + "' type='" + (f.t || "text") + "' placeholder='" + esc(f.ph || "") + "' value='" + esc(f.v || "") + "'" + (f.t == "number" ? " min='0' step='any'" : "") + (f.minLength ? " minlength='" + f.minLength + "'" : "") + required + ">";
        return "<label for='f" + i + "'>" + esc(f.l) + "</label>" + c;
    }).join("");
    fields.forEach(function (f, i) { if (f.opts && f.v) $("#f" + i).value = f.v; });
    $("#dlgForm").onsubmit = function (e) {
        e.preventDefault();
        if (!this.reportValidity()) return;
        if (!readOnly && !canMutate()) return;
        var previousState = captureLocalState();
        var result;
        try {
            result = ok(fields.map(function (f, i) { return $("#f" + i).value.trim(); }));
        } catch (error) {
            restoreLocalState(previousState);
            $("#dlgErr").textContent = error.message || "The action could not be completed.";
            return;
        }
        if (result && typeof result.then === "function") {
            $("#dlgOk").disabled = true;
            result.then(function (err) {
                if (err) {
                    if (!storageReady || !navigator.onLine) restoreLocalState(previousState);
                    $("#dlgErr").textContent = err;
                }
                else dlg.close();
            }).catch(function (error) {
                restoreLocalState(previousState);
                $("#dlgErr").textContent = error.message || "The action could not be completed.";
            }).finally(function () { $("#dlgOk").disabled = false; });
        } else if (result) {
            if (!storageReady || !navigator.onLine) restoreLocalState(previousState);
            $("#dlgErr").textContent = result;
        }
        else dlg.close();
    };
    dlg.showModal(); $("#f0").focus();
}
$("#dlgCancel").onclick = function () { dlg.close(); };

/* Password recovery is managed locally by the clinic owner. */
on(".forgot-link", function () {
    modal("Sign-in help", [{ l: "Email", t: "email", v: $("#email").value }], "Show instructions", function (v) {
        if (!v[0]) return "Enter your email address.";
        $("#email").value = v[0];
        $("#loginStatus").textContent = "No reset email is sent. Ask the clinic owner to reset this local account in Settings.";
    }, true);
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
    currentRole = null;
    sessionStorage.removeItem("dentsyncRole");
    sessionStorage.removeItem("dentsyncUser");
    sessionStorage.removeItem("dentsyncEmail");
    sessionStorage.removeItem("dentsyncCurrentPatient");
    currentUserName = "";
    navLinks.forEach(function (link) { link.hidden = false; });
    app.style.display = "none";
    loginBox.style.display = "flex";
    $("#loginForm").reset();
    updateAuthSetup();
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

/* ---- calendar ---- */
function monday(d) { d = new Date(d); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
var ws = monday(new Date()), selectedDay = new Date(), dayView = false;
if (!storedState) {
    var tuesday = new Date(ws);
    tuesday.setDate(tuesday.getDate() + 1);
    bookings = [
        { date: ymd(ws), h: 0, patientId: patients[0].id, name: patients[0].name, proc: "Consultation", status: "confirmed" },
        { date: ymd(tuesday), h: 2, patientId: patients[1].id, name: patients[1].name, proc: "Cleaning", status: "pending" }
    ];
    if (storageReady) saveData();
}
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
            bookings.forEach(function (b, i) {
                if (b.date != k || b.h != r) return;
                var name = currentRole === "assistant" ? "Scheduled appointment" : b.name;
                var proc = currentRole === "assistant" ? "" : esc(b.proc);
                ev += '<div class="event"><b>' + esc(name) + "</b>" + proc + '<span class="badge ' + (b.status == "completed" ? "ok" : b.status == "confirmed" ? "ok" : "warn") + '">' + esc(b.status || "pending") + "</span>";
                if (currentRole !== "assistant") {
                    ev += '<div class="event-actions">';
                    if ((b.status || "pending") === "pending") ev += '<button type="button" data-book-action="confirm" data-book-index="' + i + '">Confirm</button>';
                    if (b.status !== "completed") ev += '<button type="button" data-book-action="reschedule" data-book-index="' + i + '">Reschedule</button><button type="button" data-book-action="complete" data-book-index="' + i + '">Complete</button>';
                    ev += "</div>";
                }
                ev += "</div>";
            });
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
function bookModal(preset, editing) {
    if (!canManageAppointments()) return;
    if (!patients.length) {
        notice("Add a patient before creating an appointment.");
        return;
    }
    var booking = typeof editing == "number" ? bookings[editing] : null;
    var selectedPatient = preset ? cur.id : booking ? booking.patientId : patients[0].id;
    var fields = [
        { l: "Patient", opts: patients.map(function (p) { return { value: p.id, label: p.name + " (" + p.id + ")" }; }), v: selectedPatient },
        { l: "Procedure", ph: "e.g. Cleaning", v: booking ? booking.proc : "" },
        { l: "Date", t: "date", v: booking ? booking.date : ymd(new Date()) },
        { l: "Time", opts: hours, v: booking ? hours[booking.h] : hours[0] }
    ];
    modal(booking ? "Reschedule appointment" : "New booking", fields, booking ? "Save changes" : "Save booking", function (v) {
        if (!v[1]) return "Enter the procedure.";
        var d = new Date(v[2] + "T00:00");
        if (isNaN(d)) return "Choose a date.";
        if (d.getDay() === 0) return "The calendar runs Monday to Saturday. Pick another day.";
        var patient = patients.filter(function (candidate) { return candidate.id === v[0]; })[0];
        if (!patient) return "Choose a patient.";
        var target = { date: v[2], h: hours.indexOf(v[3]), name: patient.name, proc: v[1], patientId: patient.id, status: "pending" };
        var interval = 30 + bufferMinutes;
        var conflict = bookings.some(function (other, i) {
            return i !== editing && other.date === target.date && Math.abs(other.h - target.h) * 30 < interval;
        });
        if (conflict) return "This appointment conflicts with another booking or the " + bufferMinutes + "-minute buffer. Choose another time.";
        if (booking) bookings[editing] = target;
        else bookings.push(target);
        if (!saveData()) return saveFailureMessage();
        selectedDay = d; ws = monday(d); renderCal(); showPage("calendar");
        notice("Appointment saved. Confirmation is recorded locally; no patient message was sent.");
    });
}
on("#newBooking", function () { bookModal(false); });
on("#bookBtn", function () { bookModal(true); });
on("#notificationBtn", function () {
    var count = bookings.filter(function (b) { return b.status === "pending"; }).length;
    notice(count ? count + " appointment(s) need confirmation. Notifications are local to this browser." : "No appointment notifications.");
});

/* ---- search ---- */
$("#search").addEventListener("input", function () { renderPatients(this.value); if (this.value.trim()) showPage("patients"); });

/* ---- patients ---- */
function renderPatients(q) {
    if (currentRole === "assistant") {
        $("#patientTable").innerHTML = "<caption class=sr-only>Patient directory</caption><tbody><tr><td>Patient records are not available to this role.</td></tr></tbody>";
        return;
    }
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
    if (b > ymd(new Date()) || isNaN(new Date(b + "T00:00"))) return npMsg('<p class="form-error">Enter a valid birthdate that is not in the future.</p>');
    var m = patients.filter(function (p) { return p.name.toLowerCase() == n || (p.birth == b && p.name.toLowerCase().indexOf(n.split(" ")[0]) > -1); })[0];
    if (m) npMsg("<b>Possible existing record</b><p>" + m.id + " " + esc(m.name) + "<br>Born " + (m.birth || "not recorded") + '</p><a href="#patient" class="action-btn open-btn" data-open="' + m.id + '">Open record</a>');
    else npMsg("<b>No existing record found</b><p>It is safe to create a record for " + esc($("#npName").value.trim()) + '.</p><button type="button" class="action-btn open-btn" data-act="create">Create patient</button>');
});
function createPatient() {
    if (!canMutate()) return;
    var nextNumber = patients.reduce(function (max, patient) {
        var match = /^P-(\d+)$/i.exec(patient.id || "");
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    var id = "P-" + String(nextNumber).padStart(3, "0");
    var p = { id: id, name: $("#npName").value.trim(), phone: $("#npPhone").value.trim() || "—", birth: $("#npBirth").value, last: "—", tx: [], notes: [], payments: [], health: {} };
    patients.push(p);
    if (!saveData()) {
        patients.pop();
        renderPatients($("#search").value);
        npMsg('<p class="form-error">' + esc(saveFailureMessage()) + "</p>");
        return;
    }
    renderPatients($("#search").value);
    $("#npForm").reset();
    npMsg('<b class="ok">Patient added</b><p>' + id + " " + esc(p.name) + ' is now in the list.</p><a href="#patient" class="action-btn open-btn" data-open="' + id + '">Open record</a>');
}

/* ---- patient record tabs ---- */
function openPatient(id) {
    var patient = patients.filter(function (p) { return p.id == id; })[0];
    if (!patient) return;
    cur = patient;
    sessionStorage.setItem("dentsyncCurrentPatient", cur.id);
    tab = "overview"; renderTab(); showPage("patient");
}
function age(b) { if (!b) return "—"; var d = new Date(b), n = new Date(), a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a + " yrs (" + b + ")"; }
function fld(l, v) { return "<p><b>" + l + ":</b> " + esc(v || "—") + "</p>"; }
function renderTab() {
    if (currentRole === "assistant") {
        $("#pName").textContent = "";
        $("#pId").textContent = "";
        $("#tabBody").textContent = "";
        return;
    }
    var p = cur, h = "";
    $("#pName").textContent = p.name; $("#pId").textContent = p.id;
    document.querySelectorAll("[data-tab]").forEach(function (a) {
        a.hidden = currentRole === "secretary" && ["medical", "treatments", "notes"].indexOf(a.dataset.tab) !== -1;
        if (a.hidden && a.dataset.tab === tab) tab = "overview";
        a.classList.toggle("current", a.dataset.tab == tab);
        a.setAttribute("aria-pressed", String(a.dataset.tab == tab));
    });
    var contact = '<div class="box"><h3>Contact details</h3>' + fld("Age / birthdate", age(p.birth)) + fld("Phone", p.phone) + fld("Address", p.address) + fld("Emergency contact", p.emergency) + "</div>";
    var health = p.health || {};
    var med = '<div class="box"><h3>Medical condition and health questionnaire</h3>' + fld("Conditions", p.conditions) + fld("Allergies", p.allergies) + fld("Medications", p.meds) + fld("Notes for dentist", p.dnote) + fld("Current/recent treatment", health.treatment) + fld("Pregnant (if applicable)", health.pregnant) + fld("Tobacco use", health.tobacco) + fld("Blood pressure / other concerns", health.concerns) + "</div>";
    if (tab == "overview") {
        h = '<div class="boxes">' + contact + (currentRole === "owner" ? med : "") + "</div>";
        if (currentRole === "owner") {
            h += '<div class="box visits"><h3>Recent visits and post-op notes</h3>';
            p.tx.slice().reverse().forEach(function (t) { h += '<div class="visit"><span>' + esc(t.date) + "</span><span>" + esc(t.tooth + " " + t.proc) + "</span><span>" + esc(t.dentist) + "</span><small>" + (t.note ? esc(t.note) : "No post-op note recorded.") + "</small></div>"; });
            if (!p.tx.length) h += '<div class="visit"><small>No visits yet. Use Book to schedule the first appointment.</small></div>';
            h += "</div>";
        }
    } else if (tab == "medical") {
        h = '<div class="boxes">' + med + '<div class="box sum"><h3>Emergency contact</h3>' + fld("Name and phone", p.emergency) + "</div></div>";
    } else if (tab == "treatments") {
        h = '<div class="table-scroll"><table class="data"><caption class="sr-only">Patient treatments</caption><thead><tr><th scope=col>Date</th><th scope=col>Tooth</th><th scope=col>Procedure</th><th scope=col>Dentist</th><th scope=col>Status</th></tr></thead><tbody>';
        p.tx.forEach(function (t) { var b = t.cost - (t.discount || 0) - t.paid; h += "<tr><td>" + esc(t.date) + "</td><td>" + esc(t.tooth) + "</td><td>" + esc(t.proc) + "</td><td>" + esc(t.dentist) + '</td><td><span class="badge ' + (!b ? "ok" : t.paid ? "warn" : "err") + '">' + (!b ? "Paid" : t.paid ? "Partial" : "Unpaid") + "</span></td></tr>"; });
        if (!p.tx.length) h += '<tr><td colspan="5">No treatments recorded yet.</td></tr>';
        h += "</tbody></table></div>";
    } else if (tab == "billing") {
        var cost = p.tx.reduce(function (a, t) { return a + t.cost - (t.discount || 0); }, 0);
        h = '<div class="boxes"><div class="box sum"><h3>Total billed</h3><p class="big">' + peso(cost) + '</p></div><div class="box sum"><h3>Outstanding balance</h3><p class="big ' + (bal(p) ? "warn" : "ok") + '">' + peso(bal(p)) + '</p></div></div><p style="margin-top:20px"><a href="#billing" class="btn gray" data-go="billing">Open full ledger</a></p>';
    } else {
        h = '<div class="box"><h3>Notes</h3>';
        p.notes.forEach(function (n) { h += "<p><b>" + esc(n.date) + ":</b> " + esc(n.text) + "</p>"; });
        if (!p.notes.length) h += "<p>No notes yet. Add the first one below.</p>";
        h += '<div class="note-form"><input id="noteIn" type="text" placeholder="Write a note about this patient" aria-label="New note"><button type="button" class="btn gray" data-act="note">Add note</button></div></div>';
    }
    $("#tabBody").innerHTML = h;
}

/* ---- billing ---- */
function renderBilling() {
    if (currentRole === "assistant") {
        $("#ledgerName").textContent = "";
        $("#balanceTable").textContent = "";
        $("#clinicBalTotal").textContent = "";
        $("#ledgerTable").textContent = "";
        $("#paymentTable").textContent = "";
        $("#balTotal").textContent = "";
        return;
    }
    var clinicBalance = patients.reduce(function (total, patient) { return total + bal(patient); }, 0);
    var balances = "<caption class=sr-only>Patient balances</caption><thead><tr><th scope=col>Patient ID</th><th scope=col>Patient</th><th scope=col>Outstanding</th><th scope=col>Ledger</th></tr></thead><tbody>";
    patients.forEach(function (patient) {
        balances += "<tr><td>" + esc(patient.id) + "</td><td>" + esc(patient.name) + "</td><td>" + peso(bal(patient)) + '</td><td><button type="button" class="action-btn open-btn" data-billing-patient="' + esc(patient.id) + '">View ledger</button></td></tr>';
    });
    if (!patients.length) balances += '<tr><td colspan="4">No patient balances yet.</td></tr>';
    $("#balanceTable").innerHTML = balances + "</tbody>";
    $("#clinicBalTotal").textContent = peso(clinicBalance);
    var p = cur;
    $("#ledgerName").textContent = p.name;
    var h = "<caption class=sr-only>Patient ledger</caption><thead><tr><th scope=col>Date</th><th scope=col>Tooth</th><th scope=col>Procedure</th><th scope=col>Dentist</th><th scope=col>Cost</th><th scope=col>Discount</th><th scope=col>Paid</th><th scope=col>Balance</th></tr></thead><tbody>";
    p.tx.forEach(function (t) { var b = t.cost - (t.discount || 0) - t.paid; h += "<tr><td>" + esc(t.date) + "</td><td>" + esc(t.tooth) + "</td><td>" + esc(t.proc) + "</td><td>" + esc(t.dentist) + "</td><td>" + peso(t.cost) + "</td><td>" + peso(t.discount || 0) + "</td><td>" + peso(t.paid) + '</td><td class="' + (b ? "warn" : "ok") + '">' + peso(b) + "</td></tr>"; });
    if (!p.tx.length) h += '<tr><td colspan="8">No treatments yet. Choose Add treatment to start this ledger.</td></tr>';
    $("#ledgerTable").innerHTML = h + "</tbody>";
    var payments = "<caption class=sr-only>Payment history</caption><thead><tr><th scope=col>Date</th><th scope=col>Amount</th><th scope=col>Method</th><th scope=col>Status</th></tr></thead><tbody>";
    (p.payments || []).forEach(function (payment) { payments += "<tr><td>" + esc(payment.date) + "</td><td>" + peso(payment.amount) + "</td><td>" + esc(payment.method) + '</td><td><span class="badge ok">' + esc(payment.status) + "</span></td></tr>"; });
    if (!(p.payments || []).length) payments += '<tr><td colspan="4">No payments recorded.</td></tr>';
    $("#paymentTable").innerHTML = payments + "</tbody>";
    $("#balTotal").textContent = peso(bal(p));
}
function refreshAll() { renderBilling(); renderPatients($("#search").value); renderTab(); }
on("#editPatientBtn", function () {
    var patient = cur;
    var fields = [
        { l: "Full name", v: patient.name }, { l: "Birthdate", t: "date", v: patient.birth },
        { l: "Phone", t: "tel", v: patient.phone }, { l: "Address", v: patient.address },
        { l: "Emergency contact", v: patient.emergency }
    ];
    var keys = ["name", "birth", "phone", "address", "emergency"];
    if (currentRole === "owner") {
        patient.health = patient.health || {};
        fields = fields.concat([
            { l: "Conditions", v: patient.conditions }, { l: "Allergies", v: patient.allergies },
            { l: "Medications", v: patient.meds }, { l: "Notes for dentist", v: patient.dnote },
            { l: "Current/recent treatment", v: patient.health.treatment },
            { l: "Pregnant (if applicable)", v: patient.health.pregnant },
            { l: "Tobacco use", v: patient.health.tobacco },
            { l: "Blood pressure / other concerns", v: patient.health.concerns }
        ]);
        keys = keys.concat(["conditions", "allergies", "meds", "dnote"]);
    }
    modal("Edit patient", fields, "Save changes", function (v) {
        if (!v[0]) return "Enter the patient's full name.";
        if (v[1] && v[1] > ymd(new Date())) return "Birthdate cannot be in the future.";
        // Keep existing appointments in sync with a changed patient name.
        bookings.forEach(function (b) {
            if (b.patientId === patient.id || (!b.patientId && b.name === patient.name)) b.name = v[0];
        });
        keys.forEach(function (key, i) { patient[key] = v[i]; });
        if (currentRole === "owner") {
            patient.health.treatment = v[9];
            patient.health.pregnant = v[10];
            patient.health.tobacco = v[11];
            patient.health.concerns = v[12];
        }
        if (!saveData()) return saveFailureMessage();
        refreshAll(); renderCal();
    });
});
on("#addTx", function () {
    modal("Add treatment", [{ l: "Date", t: "date", v: ymd(new Date()) }, { l: "Tooth", ph: "e.g. #14" }, { l: "Procedure", ph: "e.g. Filling" }, { l: "Dentist", v: "Dr. [Name]" }, { l: "Cost (₱)", t: "number" }, { l: "Discount (₱)", t: "number", v: "0" }, { l: "Paid now (₱)", t: "number", v: "0" }, { l: "Post-op note", ph: "Optional note for this visit" }], "Add treatment", function (v) {
        var c = parseFloat(v[4]), discount = parseFloat(v[5] || 0), pd = parseFloat(v[6] || 0);
        if (!v[0] || !v[1] || !v[2]) return "Fill in the date, tooth, and procedure.";
        if (!Number.isFinite(c) || !(c > 0)) return "Enter a cost greater than zero.";
        if (!Number.isFinite(discount) || discount < 0 || discount > c) return "Discount must be between ₱ 0 and the cost.";
        if (!Number.isFinite(pd) || pd < 0 || pd > c - discount) return "Paid amount must be between ₱ 0 and the discounted cost.";
        cur.tx.push({ date: v[0], tooth: v[1], proc: v[2], dentist: v[3] || "Dr. [Name]", cost: c, discount: discount, paid: pd, note: v[7] });
        cur.last = new Date(v[0] + "T00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" });
        if (!saveData()) return saveFailureMessage();
        refreshAll();
    });
});
on("#recordPay", function () {
    modal("Record payment", [{ l: "Amount (₱)", t: "number", ph: "Outstanding: " + peso(bal(cur)) }, { l: "Method", opts: ["Cash", "GCash", "Card", "Bank transfer"] }], "Record payment", function (v) {
        var a = parseFloat(v[0]);
        if (!bal(cur)) return "This ledger has no outstanding balance.";
        if (!Number.isFinite(a) || !(a > 0)) return "Enter an amount greater than zero.";
        if (a > bal(cur)) return "Amount is more than the outstanding balance of " + peso(bal(cur)) + ".";
        var amount = parseFloat(v[0]);
        cur.tx.forEach(function (t) { var take = Math.min(t.cost - (t.discount || 0) - t.paid, a); t.paid += take; a -= take; });
        cur.payments = cur.payments || [];
        cur.payments.unshift({
            date: ymd(new Date()), amount: amount, method: v[1], status: "Completed"
        });
        if (!saveData()) return saveFailureMessage();
        refreshAll();
    });
});
on("#printBtn", function () {
    document.body.classList.add("print-receipt");
    window.addEventListener("afterprint", function () { document.body.classList.remove("print-receipt"); }, { once: true });
    window.print();
});

/* ---- settings ---- */
function renderUsers() {
    var h = "<caption class=sr-only>Clinic users</caption><thead><tr><th scope=col>Name</th><th scope=col>Role</th><th scope=col>Status</th><th scope=col>Account</th></tr></thead><tbody>";
    users.forEach(function (u) {
        var email = u[3] || "";
        var reset = email ? '<button type="button" class="user-reset" data-user-reset="' + esc(email) + '">Reset password</button>' : "—";
        h += "<tr><td>" + esc(u[0]) + "</td><td>" + esc(u[1]) + '</td><td><span class="badge ' + (u[2] == "Active" ? "ok" : "warn") + '">' + esc(u[2]) + "</span></td><td>" + reset + "</td></tr>";
    });
    $("#usersTable").innerHTML = h + "</tbody>";
}
function renderSupplies() {
    var h = "<caption class=sr-only>Clinic supply status</caption><thead><tr><th scope=col>Item</th><th scope=col>Quantity</th><th scope=col>Status</th></tr></thead><tbody>";
    supplies.forEach(function (item) { h += "<tr><td>" + esc(item[0]) + "</td><td>" + esc(item[1]) + "</td><td>" + esc(item[2]) + "</td></tr>"; });
    $("#supplyTable").innerHTML = h + "</tbody>";
}
on("#addUser", function () {
    modal("Add user", [
        { l: "Full name", ph: "e.g. Ana Reyes", required: true },
        { l: "Email", t: "email", required: true },
        { l: "Role", opts: ["Dentist / Owner", "Business Partner / Secretary", "Dental Assistant"] },
        { l: "Temporary password (10+ characters)", t: "password", minLength: 10, required: true },
        { l: "Status", opts: ["Active", "Inactive"] }
    ], "Create account", async function (v) {
        if (!v[0]) return "Enter the user's full name.";
        var email = v[1].toLowerCase();
        if (accounts.some(function (account) { return account.email === email; })) return "An account already uses this email.";
        var credentials = await makePasswordHash(v[3]);
        var role = v[2] === "Dentist / Owner" ? "owner" : v[2] === "Business Partner / Secretary" ? "secretary" : "assistant";
        accounts.push({ email: email, name: v[0], role: role, status: v[4], salt: credentials.salt, passwordHash: credentials.hash });
        users.push([v[0], v[2], v[4], email]);
        if (!saveData()) return saveFailureMessage();
        renderUsers();
    });
});
$("#bufferMinutes").value = bufferMinutes;
on("#saveBuffer", function () {
    var value = Number($("#bufferMinutes").value);
    if (!Number.isInteger(value) || value < 0 || value > 180 || value % 5) {
        notice("Set a buffer from 0 to 180 minutes in 5-minute increments.");
        return;
    }
    var previousValue = bufferMinutes;
    bufferMinutes = value;
    if (!saveData()) {
        bufferMinutes = previousValue;
        $("#bufferMinutes").value = previousValue;
        return;
    }
    notice("Appointment buffer set to " + bufferMinutes + " minutes.");
});
document.querySelectorAll(".perms-table td:not(:first-child)").forEach(function (td) {
    var t = td.textContent.trim(), c = t == "Full" ? "ok" : t == "No" ? "err" : "warn";
    td.innerHTML = '<span class="badge ' + c + '">' + t + "</span>";
});

/* ---- shared click handling for generated links/buttons ---- */
document.addEventListener("click", function (e) {
    var billingPatient = e.target.closest("[data-billing-patient]");
    if (billingPatient) {
        if (currentRole === "assistant") return;
        var selectedPatient = patients.filter(function (patient) {
            return patient.id === billingPatient.dataset.billingPatient;
        })[0];
        if (!selectedPatient) return;
        cur = selectedPatient;
        sessionStorage.setItem("dentsyncCurrentPatient", cur.id);
        renderBilling();
        return;
    }
    var resetButton = e.target.closest("[data-user-reset]");
    if (resetButton) {
        e.preventDefault();
        if (currentRole !== "owner") return;
        var targetAccount = accounts.filter(function (account) { return account.email === resetButton.dataset.userReset; })[0];
        if (!targetAccount) return;
        modal("Reset local password", [{ l: "New password (10+ characters)", t: "password", minLength: 10, required: true }], "Save password", async function (v) {
            var credentials = await makePasswordHash(v[0]);
            targetAccount.salt = credentials.salt;
            targetAccount.passwordHash = credentials.hash;
            if (!saveData()) return saveFailureMessage();
        });
        return;
    }
    var bookingAction = e.target.closest("[data-book-action]");
    if (bookingAction) {
        e.preventDefault();
        if (!canManageAppointments() || !canMutate()) return;
        var index = Number(bookingAction.dataset.bookIndex), booking = bookings[index];
        if (!booking) return;
        if (bookingAction.dataset.bookAction === "reschedule") {
            bookModal(false, index);
            return;
        }
        if (bookingAction.dataset.bookAction === "confirm") {
            var oldStatus = booking.status;
            booking.status = "confirmed";
            notice("Appointment confirmed. No patient message was sent.");
        } else if (bookingAction.dataset.bookAction === "complete") {
            var oldCompletedDate = booking.completedDate;
            var oldStatus = booking.status;
            booking.status = "completed";
            booking.completedDate = ymd(new Date());
            var patient = patients.filter(function (p) { return p.id === booking.patientId; })[0];
            var oldLastVisit = patient && patient.last;
            if (patient) patient.last = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" });
            notice("Appointment marked completed.");
        }
        if (!saveData()) {
            booking.status = oldStatus;
            if (bookingAction.dataset.bookAction === "complete") {
                if (oldCompletedDate === undefined) delete booking.completedDate;
                else booking.completedDate = oldCompletedDate;
                if (patient) patient.last = oldLastVisit;
            }
            renderCal(); renderPatients($("#search").value);
            return;
        }
        renderCal(); renderPatients($("#search").value);
        return;
    }
    var a = e.target.closest("[data-open],[data-tab],[data-go],[data-act]");
    if (!a) return;
    e.preventDefault();
    if (a.dataset.open) openPatient(a.dataset.open);
    else if (a.dataset.tab) { tab = a.dataset.tab; renderTab(); }
    else if (a.dataset.go) showPage(a.dataset.go);
    else if (a.dataset.act == "create") createPatient();
    else if (a.dataset.act == "note") {
        if (!canMutate()) return;
        var t = $("#noteIn").value.trim();
        if (t) {
            cur.notes.unshift({ date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }), text: t });
            if (!saveData()) {
                cur.notes.shift();
                return;
            }
            renderTab();
        }
    }
});

document.querySelectorAll(".data").forEach(function (t) { var w = document.createElement("div"); w.className = "table-scroll"; t.parentNode.insertBefore(w, t); w.appendChild(t); });
$("#signinBtn").disabled = true;
initializeLocalAccounts().then(function () {
    $("#signinBtn").disabled = false;
}).catch(function (error) {
    $("#authHelp").textContent = "Local accounts could not be initialized.";
    $("#loginStatus").textContent = error.message || "Account initialization failed.";
});
