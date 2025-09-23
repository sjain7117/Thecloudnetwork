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

  const initCadenceCards = () => {
    const cards = document.querySelectorAll(".metric-card");
    if (!cards.length) return;

    const highlightState = new WeakMap();
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const EDGE_SPEED = 65; // degrees per second for the border spark
    const PARALLAX_LIMIT = 2; // pixels

    const isReducedMotion = () => document.documentElement.classList.contains("reduced-motion");

    const ensureState = (card) => {
      if (!highlightState.has(card)) {
        highlightState.set(card, {
          base: 90,
          offset: 0,
          rafId: null,
          previousTime: null,
        });
      }
      return highlightState.get(card);
    };

    const updateStateText = (card, flipped) => {
      const state = card.querySelector("[data-card-state]");
      if (!state) return;
      const week = card.querySelector(".card-week");
      const title = card.querySelector(".card-front strong");
      const labelParts = [week ? week.textContent.trim() : "", title ? title.textContent.trim() : ""].filter(Boolean);
      const label = labelParts.join(" ") || "Card";
      state.textContent = flipped ? `${label} back side visible.` : `${label} front side visible.`;
    };

    const isLocked = (card) => card.dataset.locked === "true";

    const setLocked = (card, locked) => {
      if (locked) {
        card.dataset.locked = "true";
        card.classList.add("is-active");
      } else {
        delete card.dataset.locked;
      }
    };

    const startOrbit = (card) => {
      if (isReducedMotion()) return;
      const state = ensureState(card);
      if (state.rafId) return;

      const step = (time) => {
        const current = ensureState(card);
        if (current.previousTime == null) {
          current.previousTime = time;
        }
        const delta = Math.min(60, time - current.previousTime);
        current.previousTime = time;
        current.offset = (current.offset + (delta / 1000) * EDGE_SPEED) % 360;
        const angle = (current.base + current.offset) % 360;
        card.style.setProperty("--edge-angle", `${angle}deg`);
        current.rafId = requestAnimationFrame(step);
      };

      state.offset = 0;
      state.previousTime = null;
      state.rafId = requestAnimationFrame(step);
    };

    const stopOrbit = (card) => {
      const state = ensureState(card);
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      state.previousTime = null;
      state.offset = 0;
    };

    const updateReduceMotionClass = (matches) => {
      document.documentElement.classList.toggle("reduced-motion", matches);
      cards.forEach((card) => {
        const state = ensureState(card);
        if (matches) {
          if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
          }
          state.offset = 0;
          state.previousTime = null;
          card.style.setProperty("--parallax-x", "0px");
          card.style.setProperty("--parallax-y", "0px");
          card.style.removeProperty("--edge-angle");
        } else if (card.classList.contains("is-flipped")) {
          startOrbit(card);
        }
      });
    };

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener("change", (event) => updateReduceMotionClass(event.matches));
    } else if (typeof reduceMotionQuery.addListener === "function") {
      reduceMotionQuery.addListener((event) => updateReduceMotionClass(event.matches));
    }

    updateReduceMotionClass(reduceMotionQuery.matches);

    const resetParallax = (card) => {
      card.style.setProperty("--parallax-x", "0px");
      card.style.setProperty("--parallax-y", "0px");
    };

    const updateParallax = (card, event) => {
      if (isReducedMotion() || !event) return;
      const rect = card.getBoundingClientRect();
      const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
      const relativeY = (event.clientY - rect.top) / rect.height - 0.5;
      const clamp = (value) => Math.max(Math.min(value, 0.5), -0.5);
      const shiftX = clamp(relativeX) * 2 * PARALLAX_LIMIT;
      const shiftY = clamp(relativeY) * 2 * PARALLAX_LIMIT;
      card.style.setProperty("--parallax-x", `${shiftX.toFixed(2)}px`);
      card.style.setProperty("--parallax-y", `${shiftY.toFixed(2)}px`);
    };

    const updateLightDirection = (card, event, { resetOffset = false } = {}) => {
      if (isReducedMotion() || !event) return;
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const angle = (Math.atan2(y, x) * 180) / Math.PI;
      const normalized = (angle + 360) % 360;
      const state = ensureState(card);
      state.base = normalized;
      if (resetOffset) {
        state.offset = 0;
      }
      const effectiveAngle = (state.base + state.offset) % 360;
      card.style.setProperty("--edge-angle", `${effectiveAngle}deg`);
    };

    const setFlip = (card, flipped) => {
      const alreadyFlipped = card.classList.contains("is-flipped");
      if (alreadyFlipped === flipped) return;

      if (flipped) {
        card.classList.add("is-flipped", "is-active");
        startOrbit(card);
      } else {
        card.classList.remove("is-flipped");
        if (!isLocked(card)) {
          card.classList.remove("is-active");
        }
        stopOrbit(card);
        resetParallax(card);
        card.style.setProperty("--edge-angle", "90deg");
      }

      card.setAttribute("aria-pressed", flipped ? "true" : "false");
      updateStateText(card, flipped);
    };

    const closeCard = (card) => {
      if (!card.classList.contains("is-flipped")) {
        card.classList.remove("is-active");
        return;
      }
      setLocked(card, false);
      setFlip(card, false);
    };

    cards.forEach((card) => {
      ensureState(card);
      updateStateText(card, card.classList.contains("is-flipped"));
      card.setAttribute("aria-pressed", card.classList.contains("is-flipped") ? "true" : "false");
      resetParallax(card);
      card.style.setProperty("--edge-angle", "90deg");

      card.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "touch") return;
        setLocked(card, false);
        updateLightDirection(card, event, { resetOffset: true });
        updateParallax(card, event);
        setFlip(card, true);
      });

      card.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") return;
        if (!card.classList.contains("is-flipped")) return;
        updateLightDirection(card, event);
        updateParallax(card, event);
      });

      card.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "touch") return;
        if (isLocked(card)) return;
        setFlip(card, false);
      });

      card.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        event.preventDefault();
        const shouldFlip = !card.classList.contains("is-flipped");
        setLocked(card, shouldFlip);
        setFlip(card, shouldFlip);
        if (!shouldFlip) {
          resetParallax(card);
        }
      });

      card.addEventListener("pointercancel", () => {
        if (!card.classList.contains("is-flipped")) {
          card.classList.remove("is-active");
        }
        if (!isLocked(card)) {
          setFlip(card, false);
        }
      });

      card.addEventListener("focus", () => {
        card.classList.add("is-active");
      });

      card.addEventListener("blur", () => {
        if (!isLocked(card)) {
          card.classList.remove("is-active");
          setFlip(card, false);
        }
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const shouldFlip = !card.classList.contains("is-flipped");
          setLocked(card, shouldFlip);
          setFlip(card, shouldFlip);
        } else if (event.key === "Escape") {
          if (card.classList.contains("is-flipped")) {
            event.preventDefault();
            closeCard(card);
            card.blur();
          }
        }
      });
    });

    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!event.isPrimary) return;
        if (event.target.closest(".metric-card")) return;
        cards.forEach((card) => {
          if (isLocked(card) || card.classList.contains("is-flipped")) {
            closeCard(card);
          }
        });
      },
      { passive: true }
    );
  };

  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    initScrollAnimations();
    initFormInteractions();
    initCadenceCards();
  });
})();
