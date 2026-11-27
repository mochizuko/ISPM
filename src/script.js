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
    { id: "P-002", name: "Trishia Maralit", phone: "09xx xxx xxxx", birth: "2006-11-02", last: "Nov 02", tx: [row("10/28", "#14", "Filling", 1500, 1500), row("11/02", "#26", "Extraction", 2000, 800), row("11/28", "#11", "Cleaning", 800, 800), row("12/15", "#12", "Cleaning", 800, 0)], notes: [], fixture: true },
    { id: "P-003", name: "Lysa Joy", phone: "09xx xxx xxxx", last: "May 05", tx: [row("05/05", "#26", "Extraction", 2000, 800)], notes: [], fixture: true },
    { id: "P-004", name: "Lanz Amwel", phone: "09xx xxx xxxx", last: "Dec 21", tx: [row("12/21", "#8", "Consultation", 500, 0)], notes: [], fixture: true },
    { id: "P-005", name: "Grace Dela Cruz", phone: "09xx xxx xxxx", last: "June 13", tx: [row("06/13", "#3", "X-ray", 200, 0)], notes: [], fixture: true },
    { id: "P-006", name: "Andrea Kaye", phone: "09xx xxx xxxx", last: "Aug 19", tx: [row("08/19", "#14", "Filling", 1500, 500)], notes: [], fixture: true }
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
    storageError = "Saved local data could not be read (" + error.message + "). The app is read-only to protect it. Restore the recovery snapshot in Settings or export/clear this site's storage only after saving a copy.";
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
var cleanClinic = Boolean(storedState && storedState.cleanClinic);
var supplies = storedState && Array.isArray(storedState.supplies) ? storedState.supplies : [
    ["Gloves (boxes)", "12", "In stock"], ["Masks (boxes)", "8", "In stock"], ["Dental bibs", "2", "Reorder soon"]
];
var hours = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30", "4:00", "4:30"];
var bal = function (p) { return p.tx.reduce(function (a, t) { return a + t.cost - (t.discount || 0) - t.paid; }, 0); };
function notice(message) { $("#appNotice").textContent = message; }
function updateNotificationCount() {
    var count = bookings.filter(function (b) { return (b.status || "pending") === "pending"; }).length;
    var badge = $("#notificationCount");
    if (badge) {
        badge.textContent = count ? String(count) : "";
        $("#notificationBtn").setAttribute("aria-label", count ? "Show notifications, " + count + " pending appointments" : "Show notifications, none pending");
    }
}
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
        bufferMinutes: bufferMinutes, supplies: supplies, cleanClinic: cleanClinic
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
    cleanClinic = Boolean(state.cleanClinic);
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
            bufferMinutes: bufferMinutes, supplies: supplies, cleanClinic: cleanClinic
        }));
        return true;
    } catch (error) {
        storageReady = false;
        var quota = error.name === "QuotaExceededError" || /quota/i.test(error.message);
        storageError = quota
            ? "Browser storage is full or restricted. Export a backup, free site data, and try again. The app is read-only until storage is available."
            : "Could not save local data (" + error.message + "). Browser restrictions or corrupt storage may prevent saving; export or restore a recovery snapshot, then retry.";
        updateNetworkState();
        return false;
    }
}
function updateNetworkState() {
    if (!storageReady) notice(storageError);
    else if (!navigator.onLine) notice("Offline mode: recently stored records are read-only. Reconnect before saving.");
    else notice("Saved locally — changes are stored in this browser only. Export a backup regularly.");
    updateNotificationCount();
    var setupStatus = $("#clinicSetupStatus");
    if (setupStatus) setupStatus.textContent = cleanClinic
        ? "Clean clinic mode: seeded patient and appointment fixtures are not loaded."
        : "Demo mode: seeded patient and appointment fixtures are clearly marked. Use Start clean clinic to remove them.";
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
    var calendarDay = e.target.closest("[data-calendar-day]");
    if (calendarDay) {
        selectedDay = new Date(calendarDay.dataset.calendarDay + "T00:00");
        ws = monday(selectedDay);
        calendarView = "day";
        renderCal();
        return;
    }
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
var ws = monday(new Date()), selectedDay = new Date(), calendarView = "week";
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
    var today = ymd(new Date());
    if (calendarView === "month") {
        var first = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1);
        var gridStart = new Date(first);
        gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7));
        var h = '<caption class="sr-only">Month appointment calendar</caption><thead><tr>';
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (day) { h += "<th scope='col'>" + day + "</th>"; });
        h += "</tr></thead><tbody>";
        for (var week = 0; week < 6; week++) {
            h += "<tr>";
            for (var col = 0; col < 7; col++) {
                var d = new Date(gridStart);
                d.setDate(gridStart.getDate() + week * 7 + col);
                var date = ymd(d);
                var dayBookings = bookings.filter(function (b) { return b.date === date; });
                var eventNames = dayBookings.map(function (b) { return currentRole === "assistant" ? "Scheduled appointment" : b.name; }).join(", ");
                h += "<td><button type='button' class='month-day-button " + (d.getMonth() !== selectedDay.getMonth() ? "outside" : "") + "' data-calendar-day='" + date + "' aria-label='" + esc(d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })) + (eventNames ? ", " + esc(dayBookings.length) + " appointments" : ", no appointments") + "'>";
                h += "<span class='month-day-number'>" + d.getDate() + "</span>";
                if (dayBookings.length) h += "<span class='month-event-list'>" + esc(dayBookings.length) + " " + (dayBookings.length === 1 ? "appointment" : "appointments") + "</span>";
                h += "</button></td>";
            }
            h += "</tr>";
        }
        $("#calGrid").className = "calendar calendar-month-grid";
        $("#calGrid").innerHTML = h + "</tbody>";
        $("#calMonth").textContent = selectedDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        $("#calPrev").setAttribute("aria-label", "Previous month");
        $("#calNext").setAttribute("aria-label", "Next month");
    } else {
        var cols = [0, 1, 2, 3, 4, 5];
        if (calendarView === "day") cols = [Math.round((new Date(ymd(selectedDay) + "T00:00") - ws) / 864e5)];
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
                    ev += '<div class="event" tabindex="0" aria-label="' + esc(name + ", " + t + ", " + (b.status || "pending")) + '"><b>' + esc(name) + "</b>" + proc + '<span class="badge ' + (b.status == "completed" ? "ok" : b.status == "confirmed" ? "ok" : "warn") + '">' + esc(b.status || "pending") + "</span>";
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
        $("#calGrid").className = "calendar";
        $("#calGrid").innerHTML = h + "</tbody>";
        $("#calMonth").textContent = (calendarView === "day" ? selectedDay : ws).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        $("#calPrev").setAttribute("aria-label", calendarView === "day" ? "Previous day" : "Previous week");
        $("#calNext").setAttribute("aria-label", calendarView === "day" ? "Next day" : "Next week");
    }
    ["week", "day", "month"].forEach(function (view) {
        var button = $("#view" + view.charAt(0).toUpperCase() + view.slice(1));
        button.classList.toggle("gray", calendarView !== view);
        button.setAttribute("aria-pressed", String(calendarView === view));
    });
    updateNotificationCount();
}
function moveCalendar(direction) {
    if (calendarView === "month") selectedDay.setMonth(selectedDay.getMonth() + direction);
    else selectedDay.setDate(selectedDay.getDate() + direction * (calendarView === "day" ? 1 : 7));
    ws = calendarView === "day" ? monday(selectedDay) : monday(selectedDay);
    renderCal();
}
on("#calPrev", function () { moveCalendar(-1); });
on("#calNext", function () { moveCalendar(1); });
on("#calToday", function () { selectedDay = new Date(); ws = monday(selectedDay); renderCal(); });
on("#viewWeek", function () { calendarView = "week"; ws = monday(selectedDay); renderCal(); });
on("#viewDay", function () { calendarView = "day"; ws = monday(selectedDay); renderCal(); });
on("#viewMonth", function () { calendarView = "month"; renderCal(); });
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
$("#npForm").addEventListener("input", function () {
    var name = $("#npName").value.trim();
    var birth = $("#npBirth").value;
    if (name && birth) {
        var duplicate = findDuplicate(name, birth);
        if (duplicate) {
            npMsg('<p class="form-error"><b>Possible duplicate:</b> ' + esc(duplicate.patient.id + " " + duplicate.patient.name) + ' (same birthdate and matching normalized name).</p><a href="#patient" class="action-btn open-btn" data-open="' + duplicate.patient.id + '">Open record</a>');
            $("#npCheck").disabled = true;
            return;
        }
    }
    $("#npCheck").disabled = false;
    npMsg("<p>Check the name and birthdate first. Any matching record appears here.</p>");
});
function normalizeName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function duplicateMatch(patient, name, birthdate) {
    if (!patient.birth || !birthdate || patient.birth !== birthdate) return null;
    var existing = normalizeName(patient.name).split(" ").filter(Boolean);
    var entered = normalizeName(name).split(" ").filter(Boolean);
    if (!entered.length) return null;
    var exact = normalizeName(patient.name) === normalizeName(name);
    var existingCore = existing.filter(function (part) { return part.length > 1; });
    var enteredCore = entered.filter(function (part) { return part.length > 1; });
    var firstLast = existingCore.length && enteredCore.length &&
        existingCore[0] === enteredCore[0] &&
        existingCore[existingCore.length - 1] === enteredCore[enteredCore.length - 1];
    return exact || firstLast ? { exact: exact, patient: patient } : null;
}
function findDuplicate(name, birthdate, excludeId) {
    var match = null;
    patients.forEach(function (patient) {
        if (excludeId && patient.id === excludeId) return;
        var candidate = duplicateMatch(patient, name, birthdate);
        if (candidate && (!match || candidate.exact)) match = candidate;
    });
    return match;
}
on("#npCheck", function () {
    var n = $("#npName").value.trim(), b = $("#npBirth").value;
    if (!normalizeName(n) || !b) return npMsg('<p class="form-error">Enter the full name and birthdate to check for an existing record.</p>');
    if (b > ymd(new Date()) || isNaN(new Date(b + "T00:00"))) return npMsg('<p class="form-error">Enter a valid birthdate that is not in the future.</p>');
    var m = findDuplicate(n, b);
    if (m) npMsg("<b>Possible existing record</b><p>" + m.patient.id + " " + esc(m.patient.name) + "<br>Born " + (m.patient.birth || "not recorded") + '</p><a href="#patient" class="action-btn open-btn" data-open="' + m.patient.id + '">Open record</a>');
    else npMsg("<b>No existing record found</b><p>It is safe to create a record for " + esc($("#npName").value.trim()) + '.</p><button type="button" class="action-btn open-btn" data-act="create">Create patient</button>');
});
function createPatient() {
    if (!canMutate()) return;
    var birth = $("#npBirth").value;
    var name = $("#npName").value.trim();
    if (!name || !birth) { npMsg('<p class="form-error">Enter the full name and birthdate.</p>'); return; }
    if (birth > ymd(new Date())) { npMsg('<p class="form-error">Birthdate cannot be in the future.</p>'); return; }
    if (findDuplicate(name, birth)) { npMsg('<p class="form-error">A possible duplicate record exists. Open it or correct the name/birthdate before creating.</p>'); return; }
    var phone = $("#npPhone").value.trim();
    if (phone && phone.replace(/\D/g, "").length < 7) { npMsg('<p class="form-error">Enter a valid phone number with at least 7 digits.</p>'); return; }
    var nextNumber = patients.reduce(function (max, patient) {
        var match = /^P-(\d+)$/i.exec(patient.id || "");
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    var id = "P-" + String(nextNumber).padStart(3, "0");
    var p = {
        id: id,
        name: name,
        phone: phone || "—",
        birth: birth,
        address: $("#npAddress").value.trim(),
        emergency: $("#npEmergency").value.trim(),
        conditions: $("#npConditions").value.trim(),
        allergies: "",
        meds: "",
        dnote: "",
        last: "—",
        tx: [],
        notes: [],
        payments: [],
        health: {}
    };
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
    if (!cur) {
        $("#pName").textContent = "";
        $("#pId").textContent = "";
        $("#tabBody").innerHTML = '<div class="box"><h3>No patient selected</h3><p>Add or import a patient to open a record.</p></div>';
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
    if (!p) {
        $("#ledgerName").textContent = "No patient selected";
        $("#ledgerTable").innerHTML = "<tbody><tr><td>No patient ledger yet.</td></tr></tbody>";
        $("#paymentTable").innerHTML = "<tbody><tr><td>No payments yet.</td></tr></tbody>";
        $("#balTotal").textContent = peso(0);
        return;
    }
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
    if (!cur) { notice("Select or add a patient first."); return; }
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
        if (v[1] && findDuplicate(v[0], v[1], patient.id)) return "This edit matches another patient. Review the duplicate-record match policy.";
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
    if (!cur) { notice("Select or add a patient before adding a treatment."); return; }
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
    if (!cur) { notice("Select or add a patient before recording payment."); return; }
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
    var patient = cur;
    $("#receiptPatient").textContent = patient ? patient.name : "—";
    $("#receiptPatientId").textContent = patient ? patient.id : "—";
    $("#receiptDate").textContent = new Date().toLocaleString("en-US");
    $("#receiptBalance").textContent = patient ? peso(bal(patient)) : peso(0);
    var ledger = "<table><thead><tr><th>Date</th><th>Procedure</th><th>Cost</th><th>Paid</th><th>Balance</th></tr></thead><tbody>";
    if (patient) {
        patient.tx.forEach(function (t) {
            ledger += "<tr><td>" + esc(t.date) + "</td><td>" + esc(t.proc) + "</td><td>" + peso(t.cost - (t.discount || 0)) + "</td><td>" + peso(t.paid) + "</td><td>" + peso(t.cost - (t.discount || 0) - t.paid) + "</td></tr>";
        });
    }
    ledger += patient && patient.tx.length ? "" : '<tr><td colspan="5">No treatment records</td></tr>';
    $("#receiptLedger").innerHTML = ledger + "</tbody></table>";
    var payments = "<table><thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead><tbody>";
    var paymentRows = patient && patient.payments ? patient.payments : [];
    paymentRows.forEach(function (payment) {
        payments += "<tr><td>" + esc(payment.date) + "</td><td>" + peso(payment.amount) + "</td><td>" + esc(payment.method) + "</td></tr>";
    });
    payments += paymentRows.length ? "" : '<tr><td colspan="3">No payments recorded</td></tr>';
    $("#receiptPayments").innerHTML = payments + "</tbody></table>";
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

function backupState(reason) {
    try {
        localStorage.setItem("dentsync-recovery-v1", JSON.stringify({
            createdAt: new Date().toISOString(),
            reason: reason,
            state: captureLocalState()
        }));
        return true;
    } catch (error) {
        notice("Recovery snapshot could not be created: " + error.message);
        return false;
    }
}
on("#cleanClinicBtn", function () {
    if (!confirm("Remove all seeded/demo patients and appointments and start with an empty clinic? A recovery snapshot will be kept.")) return;
    if (!canMutate()) return;
    if (!backupState("clean-clinic")) return;
    var previous = captureLocalState();
    patients = [];
    bookings = [];
    cur = null;
    cleanClinic = true;
    if (!saveData()) {
        restoreLocalState(previous);
        return;
    }
    sessionStorage.removeItem("dentsyncCurrentPatient");
    renderCal();
    renderPatients("");
    renderBilling();
    renderTab();
    notice("Clean clinic started. Seeded patients and appointments were removed; accounts and settings were kept.");
});
on("#exportDataBtn", function () {
    if (!storageReady) { notice(storageError); return; }
    var payload = {
        app: "DentSync",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        state: JSON.parse(captureLocalState())
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "dentsync-backup-" + ymd(new Date()) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notice("Backup exported successfully.");
});
function validateBackup(payload) {
    if (!payload || payload.app !== "DentSync" || payload.schemaVersion !== 1 || !payload.state) return "This is not a supported DentSync backup.";
    var state = payload.state;
    if (!Array.isArray(state.patients) || !Array.isArray(state.users) || !Array.isArray(state.accounts) ||
        !Array.isArray(state.bookings) || !Array.isArray(state.supplies)) return "The backup is missing required records.";
    state.patients.forEach(function (patient) {
        if (!patient || typeof patient.id !== "string" || typeof patient.name !== "string") throw new Error("A patient record is invalid.");
        if (patient.birth && (patient.birth > ymd(new Date()) || isNaN(new Date(patient.birth + "T00:00")))) throw new Error("A patient has an invalid birthdate.");
        if (!Array.isArray(patient.tx)) patient.tx = [];
        if (!Array.isArray(patient.notes)) patient.notes = [];
        if (!Array.isArray(patient.payments)) patient.payments = [];
    });
    state.bookings.forEach(function (booking) {
        if (!booking || typeof booking.date !== "string" || !Number.isInteger(booking.h)) throw new Error("An appointment record is invalid.");
    });
    return "";
}
on("#importDataBtn", function () { $("#importDataFile").click(); });
$("#importDataFile").addEventListener("change", function () {
    var file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notice("Backup import failed: file exceeds 5 MB."); this.value = ""; return; }
    var reader = new FileReader();
    reader.onload = function () {
        var payload;
        try { payload = JSON.parse(String(reader.result)); }
        catch (error) { modal("Import blocked", [], "Close", function () {}, true); $("#dlgErr").textContent = "Backup is not valid JSON."; return; }
        var validationError = "";
        try { validationError = validateBackup(payload); } catch (error) { validationError = error.message; }
        if (validationError) { notice("Backup import blocked: " + validationError); this.value = ""; return; }
        var state = payload.state;
        modal("Import DentSync backup", [
            { l: "Validation", v: state.patients.length + " patients, " + state.bookings.length + " appointments" }
        ], "Replace local data", function () {
            if (!canMutate()) return saveFailureMessage();
            if (!backupState("backup-import")) return "A recovery snapshot could not be created.";
            var previousState = captureLocalState();
            try { restoreLocalState(JSON.stringify(state)); }
            catch (error) { restoreLocalState(previousState); return "Import failed: " + error.message; }
            if (!saveData()) { restoreLocalState(previousState); return saveFailureMessage(); }
            notice("Backup imported successfully. The previous data is available in the local recovery snapshot.");
        });
        $("#dlgBody").innerHTML = '<div class="import-preview"><b>Backup validated</b><p>' + esc(state.patients.length + " patients, " + state.bookings.length + " appointments, " + state.users.length + " users") + '</p><p>Importing replaces current browser data after a recovery snapshot is created.</p></div>';
    }.bind(this);
    reader.readAsText(file);
    this.value = "";
});
on("#restoreRecoveryBtn", function () {
    if (!confirm("Restore the most recent recovery snapshot? Current unsaved browser state may be replaced.")) return;
    var raw = localStorage.getItem("dentsync-recovery-v1");
    if (!raw) { notice("No recovery snapshot is available."); return; }
    try {
        var snapshot = JSON.parse(raw);
        var state = typeof snapshot.state === "string" ? JSON.parse(snapshot.state) : snapshot.state;
        if (!state || !Array.isArray(state.patients) || !Array.isArray(state.bookings)) throw new Error("Recovery snapshot format is invalid.");
        restoreLocalState(JSON.stringify(state));
        if (!saveData()) { notice(saveFailureMessage()); return; }
        notice("Recovery snapshot restored successfully.");
    } catch (error) {
        notice("Recovery snapshot could not be restored: " + error.message);
    }
});
var pendingPdaImport = [];
function parseCsv(text) {
    var rows = [], row = [], value = "", quoted = false;
    text = text.replace(/^\uFEFF/, "");
    for (var i = 0; i < text.length; i++) {
        var char = text[i];
        if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
        else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && text[i + 1] === "\n") i++;
            row.push(value.trim());
            if (row.some(function (cell) { return cell !== ""; })) rows.push(row);
            row = []; value = "";
        } else value += char;
    }
    if (value !== "" || row.length) { row.push(value.trim()); rows.push(row); }
    if (!rows.length) return [];
    var headers = rows.shift().map(function (header) { return normalizeName(header); });
    return rows.map(function (cells) {
        var record = {};
        headers.forEach(function (header, index) { record[header] = cells[index] || ""; });
        return record;
    });
}
function normalizePdaRecord(raw) {
    return {
        name: raw.name || raw.fullname || raw["full name"] || raw.patient || raw["patient name"] || "",
        birth: raw.birthdate || raw["birth date"] || raw.birth || raw.birth_date || raw.dob || "",
        phone: raw.phone || raw.telephone || raw.mobile || "",
        address: raw.address || "",
        emergency: raw.emergency || raw["emergency contact"] || "",
        conditions: raw.conditions || raw.condition || "",
        allergies: raw.allergies || raw.allergy || "",
        medications: raw.medications || raw.meds || "",
        dnote: raw.notes || raw["notes for dentist"] || ""
    };
}
function validatePdaRecord(record, index) {
    var errors = [];
    if (!record.name) errors.push("name is required");
    if (!record.birth) errors.push("birthdate is required");
    else if (record.birth > ymd(new Date()) || isNaN(new Date(record.birth + "T00:00"))) errors.push("birthdate is invalid");
    if (record.phone && record.phone.replace(/\D/g, "").length < 7) errors.push("phone is invalid");
    if (!errors.length && findDuplicate(record.name, record.birth)) errors.push("possible duplicate record");
    return { index: index, record: record, valid: !errors.length, errors: errors };
}
$("#pdaImportFile").addEventListener("change", function () {
    var file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { $("#pdaReport").innerHTML = '<p class="invalid">Import blocked: the file exceeds 5 MB.</p>'; return; }
    var reader = new FileReader();
    reader.onload = function () {
        var rawRecords;
        try {
            if (/\.json$/i.test(file.name)) {
                var payload = JSON.parse(String(reader.result));
                rawRecords = Array.isArray(payload) ? payload : (Array.isArray(payload.patients) ? payload.patients : null);
                if (!rawRecords) throw new Error("JSON must contain an array or a patients array.");
            } else rawRecords = parseCsv(String(reader.result));
        } catch (error) {
            $("#pdaReport").innerHTML = '<p class="invalid">Import blocked: ' + esc(error.message) + "</p>";
            pendingPdaImport = [];
            $("#commitPdaImport").disabled = true;
            return;
        }
        pendingPdaImport = rawRecords.map(normalizePdaRecord).map(validatePdaRecord);
        var validCount = pendingPdaImport.filter(function (item) { return item.valid; }).length;
        var h = "<table><thead><tr><th>Row</th><th>Patient</th><th>Birthdate</th><th>Status</th></tr></thead><tbody>";
        pendingPdaImport.forEach(function (item) {
            h += "<tr><td>" + (item.index + 1) + "</td><td>" + esc(item.record.name || "—") + "</td><td>" + esc(item.record.birth || "—") + '</td><td class="' + (item.valid ? "valid" : "invalid") + '">' + (item.valid ? "Ready" : esc(item.errors.join("; "))) + "</td></tr>";
        });
        h += "</tbody></table><p>" + validCount + " of " + pendingPdaImport.length + " records verified.</p>";
        $("#pdaReport").innerHTML = h;
        $("#commitPdaImport").disabled = validCount === 0;
    };
    reader.readAsText(file);
    this.value = "";
});
on("#commitPdaImport", function () {
    if (!canMutate()) return;
    var approved = pendingPdaImport.filter(function (item) { return item.valid; });
    if (!approved.length) return;
    if (!backupState("pda-import")) return;
    approved.forEach(function (item) {
        var record = item.record;
        var nextNumber = patients.reduce(function (max, patient) {
            var match = /^P-(\d+)$/i.exec(patient.id || "");
            return match ? Math.max(max, Number(match[1])) : max;
        }, 0) + 1;
        patients.push({
            id: "P-" + String(nextNumber).padStart(3, "0"),
            name: record.name,
            phone: record.phone || "—",
            birth: record.birth,
            address: record.address,
            emergency: record.emergency,
            conditions: record.conditions,
            allergies: record.allergies,
            meds: record.medications,
            dnote: record.dnote,
            last: "—",
            tx: [],
            notes: [],
            payments: [],
            health: {}
        });
    });
    if (!saveData()) { notice(saveFailureMessage()); return; }
    pendingPdaImport = [];
    $("#commitPdaImport").disabled = true;
    $("#pdaReport").innerHTML = '<p class="valid">' + approved.length + " chart records imported successfully. Rejected rows were not committed.</p>";
    renderPatients($("#search").value);
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
