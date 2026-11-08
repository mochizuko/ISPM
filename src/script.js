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
        if (navLinks[j].dataset.page == navName) {
            navLinks[j].classList.add("active");
        }
    }
}

for (var i = 0; i < pageLinks.length; i++) {
    pageLinks[i].addEventListener("click", function (e) {
        e.preventDefault();
        showPage(this.dataset.page);
    });
}

document.querySelector(".forgot-link").addEventListener("click", function (e) {
    e.preventDefault();
});

if (location.hash) {
    showPage(location.hash.slice(1));
}

//.