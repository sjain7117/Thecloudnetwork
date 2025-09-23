(function () {
  const setActiveNav = () => {
    const navLinks = document.querySelectorAll("nav.primary-nav a");
    const currentPath = window.location.pathname.split("/").pop();

    navLinks.forEach((link) => {
      const linkPath = link.getAttribute("href");
      if (!linkPath) return;
      const isActive = linkPath === currentPath || (!currentPath && linkPath === "index.html");
      link.classList.toggle("active", isActive);
    });
  };

  const initScrollAnimations = () => {
    const animatedElements = document.querySelectorAll("[data-animate]");
    if (!("IntersectionObserver" in window)) {
      animatedElements.forEach((el) => el.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    animatedElements.forEach((element) => observer.observe(element));
  };

  const initFormInteractions = () => {
    const form = document.querySelector("form[data-mock-submit]");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const feedback = form.querySelector("[data-form-feedback]");

      if (button) {
        button.disabled = true;
        button.textContent = "Submitting...";
      }

      setTimeout(() => {
        if (button) {
          button.disabled = false;
          button.textContent = "Submit Application";
        }
        if (feedback) {
          feedback.textContent = "Thanks! We’ll reach out soon with next steps.";
          feedback.classList.add("visible");
        }
        form.reset();
      }, 900);
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    initScrollAnimations();
    initFormInteractions();
  });
})();
