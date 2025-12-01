// Set current year in footer
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// Simple placeholder handler for newsletter form
const newsletterForm = document.getElementById("newsletterForm");
if (newsletterForm) {
  newsletterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("newsletterEmail");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) return;

    alert(
      "In production, this will send your email to Beehiiv / MailerLite / ConvertKit.\n\nFor now, just copy this email into your list:\n\n" +
        email
    );

    newsletterForm.reset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const links = document.querySelectorAll(".nav-link");

  links.forEach(link => {
    const href = link.getAttribute("href");

    if (href === window.location.pathname ||
        href === window.location.pathname + window.location.hash) {
      link.classList.add("nav-active");
    }
  });
});
