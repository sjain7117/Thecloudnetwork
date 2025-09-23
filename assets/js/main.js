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
    const cards = Array.from(document.querySelectorAll("[data-card]"));
    if (!cards.length) return;

    const FLIP_IN_DURATION = 0.6;
    const FLIP_OUT_DURATION = 0.28;
    const FLIP_IN_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
    const FLIP_OUT_EASING = "cubic-bezier(0.55, 0, 0.55, 0.2)";
    const sampleCard = cards[0];
    const sampleStyles = sampleCard ? getComputedStyle(sampleCard) : null;
    const tracerDurationSeconds = sampleStyles
      ? parseFloat(sampleStyles.getPropertyValue("--cadence-tracer-duration"))
      : NaN;
    const TRACER_LAP_MS = Number.isFinite(tracerDurationSeconds) && tracerDurationSeconds > 0 ? tracerDurationSeconds * 1000 : 2750;
    const TRACER_SIDE_MS = TRACER_LAP_MS / 4;
    const tracerTimers = new WeakMap();

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;

    const getTracer = (card) => card.querySelector(".cadence-tracer");

    const startTracer = (card) => {
      if (reduceMotion) return;
      const tracer = getTracer(card);
      if (!tracer) return;

      const pendingTimeout = tracerTimers.get(tracer);
      if (typeof pendingTimeout === "number") {
        clearTimeout(pendingTimeout);
        tracerTimers.delete(tracer);
      }

      tracer.classList.remove("is-tracing");
      void tracer.offsetWidth;
      tracer.classList.add("is-tracing");
    };

    const stopTracer = (card, { immediate = false } = {}) => {
      const tracer = getTracer(card);
      if (!tracer) return;

      const pendingTimeout = tracerTimers.get(tracer);
      if (typeof pendingTimeout === "number") {
        clearTimeout(pendingTimeout);
        tracerTimers.delete(tracer);
      }

      if (immediate || reduceMotion) {
        tracer.classList.remove("is-tracing");
        return;
      }

      const timeoutId = window.setTimeout(() => {
        tracer.classList.remove("is-tracing");
        tracerTimers.delete(tracer);
      }, TRACER_SIDE_MS);

      tracerTimers.set(tracer, timeoutId);
    };

    const updateAria = (card, flipped) => {
      card.setAttribute("aria-pressed", flipped ? "true" : "false");
      const label = flipped ? card.dataset.backLabel : card.dataset.frontLabel;
      if (label) {
        card.setAttribute("aria-label", label);
      }
    };

    const setFlipState = (card, flipped, options = {}) => {
      const inner = card.querySelector(".card-inner");
      if (!inner) return;

      const { animate = true, force = false } = options;
      const isCurrentlyFlipped = card.classList.contains("is-flipped");
      if (isCurrentlyFlipped === flipped && !force) {
        updateAria(card, flipped);
        return;
      }

      if (reduceMotion || !animate) {
        inner.style.setProperty("--flip-duration", "0.001s");
        inner.style.setProperty("--flip-easing", "linear");
      } else {
        inner.style.setProperty("--flip-duration", `${flipped ? FLIP_IN_DURATION : FLIP_OUT_DURATION}s`);
        inner.style.setProperty("--flip-easing", flipped ? FLIP_IN_EASING : FLIP_OUT_EASING);
      }

      card.classList.toggle("is-flipped", flipped);
      card.classList.toggle("is-engaged", flipped || card === document.activeElement);
      updateAria(card, flipped);

      if (!flipped) {
        card.style.setProperty("--layer-shift-x", "0px");
        card.style.setProperty("--layer-shift-y", "0px");
      }

      if (!flipped && !card.matches(":focus")) {
        card.classList.remove("is-engaged");
      }

      if (flipped && !reduceMotion && card.dataset.easterEgg === "clapboard") {
        const clapboard = card.querySelector("[data-clapboard]");
        if (clapboard) {
          clapboard.classList.remove("is-playing");
          void clapboard.offsetWidth;
          clapboard.classList.add("is-playing");
          window.setTimeout(() => clapboard.classList.remove("is-playing"), 650);
        }
      }
    };

    const closeCards = (exception) => {
      cards.forEach((card) => {
        if (card !== exception) {
          setFlipState(card, false, { animate: !reduceMotion });
          stopTracer(card, { immediate: true });
        }
      });
    };

    const updatePointerState = (card, event) => {
      const rect = card.getBoundingClientRect();
      const pointerX = typeof event.clientX === "number" ? event.clientX : rect.left + rect.width / 2;
      const pointerY = typeof event.clientY === "number" ? event.clientY : rect.top + rect.height / 2;

      const relativeX = pointerX - rect.left;
      const relativeY = pointerY - rect.top;
      const normalizedX = relativeX / rect.width - 0.5;
      const normalizedY = relativeY / rect.height - 0.5;

      const shiftX = Math.max(Math.min(normalizedX * 4, 2), -2);
      const shiftY = Math.max(Math.min(normalizedY * 4, 2), -2);

      card.style.setProperty("--layer-shift-x", `${shiftX.toFixed(2)}px`);
      card.style.setProperty("--layer-shift-y", `${shiftY.toFixed(2)}px`);
    };

    const handleMotionChange = () => {
      reduceMotion = motionQuery.matches;
      if (reduceMotion) {
        cards.forEach((card) => {
          setFlipState(card, false, { animate: false, force: true });
          card.classList.remove("is-engaged");
          card.style.setProperty("--layer-shift-x", "0px");
          card.style.setProperty("--layer-shift-y", "0px");
          stopTracer(card, { immediate: true });
        });
      }
    };

    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", handleMotionChange);
    } else if (typeof motionQuery.addListener === "function") {
      motionQuery.addListener(handleMotionChange);
    }

    cards.forEach((card, index) => {
      card.style.setProperty("--card-reveal-delay", `${index * 60}ms`);
      updateAria(card, false);

      card.addEventListener("pointerenter", (event) => {
        if (reduceMotion) return;
        if (event.pointerType && event.pointerType !== "mouse") return;
        closeCards(card);
        setFlipState(card, true);
        updatePointerState(card, event);
        startTracer(card);
      });

      card.addEventListener("pointermove", (event) => {
        if (reduceMotion) return;
        if (event.pointerType && event.pointerType !== "mouse") return;
        updatePointerState(card, event);
      });

      card.addEventListener("pointerleave", (event) => {
        if (reduceMotion) return;
        if (event.pointerType && event.pointerType !== "mouse") return;
        setFlipState(card, false);
        stopTracer(card);
      });

      card.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          const willFlip = !card.classList.contains("is-flipped");
          closeCards(card);
          if (willFlip && !reduceMotion) {
            updatePointerState(card, event);
          }
          setFlipState(card, willFlip, { animate: !reduceMotion });
          stopTracer(card, { immediate: true });
          if (typeof card.focus === "function") {
            card.focus({ preventScroll: true });
          }
          event.preventDefault();
        }
      });

      card.addEventListener("focus", () => {
        card.classList.add("is-engaged");
        stopTracer(card, { immediate: true });
      });

      card.addEventListener("blur", () => {
        if (!card.classList.contains("is-flipped")) {
          card.classList.remove("is-engaged");
        }
        stopTracer(card, { immediate: true });
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
          event.preventDefault();
          const willFlip = !card.classList.contains("is-flipped");
          if (willFlip) {
            closeCards(card);
          }
          setFlipState(card, willFlip, { animate: !reduceMotion });
          if (!willFlip) {
            stopTracer(card, { immediate: true });
          }
        } else if (event.key === "Escape") {
          if (card.classList.contains("is-flipped")) {
            event.preventDefault();
            setFlipState(card, false, { animate: !reduceMotion });
            stopTracer(card, { immediate: true });
          }
        }
      });
    });

    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-card]")) {
        closeCards();
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    initScrollAnimations();
    initFormInteractions();
    initCadenceCards();
  });
})();
