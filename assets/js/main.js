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

    const ORBIT_LOOP_DURATION = 2600;
    const ORBIT_TRAIL_FRACTION = 0.09;

    const createRoundedPath = (width, height, radius) => {
      const r = Math.max(Math.min(radius, Math.min(width, height) / 2), 0);
      const w = Math.max(width, 0);
      const h = Math.max(height, 0);
      return [
        `M ${r} 0`,
        `H ${w - r}`,
        `Q ${w} 0 ${w} ${r}`,
        `V ${h - r}`,
        `Q ${w} ${h} ${w - r} ${h}`,
        `H ${r}`,
        `Q 0 ${h} 0 ${h - r}`,
        `V ${r}`,
        `Q 0 0 ${r} 0`,
        "Z",
      ].join(" ");
    };

    const computeSegmentStops = (width, height, radius) => {
      const r = Math.max(Math.min(radius, Math.min(width, height) / 2), 0);
      const horizontal = Math.max(width - 2 * r, 0);
      const vertical = Math.max(height - 2 * r, 0);
      const arcLength = (Math.PI / 2) * r;
      const segments = [
        horizontal,
        arcLength,
        vertical,
        arcLength,
        horizontal,
        arcLength,
        vertical,
        arcLength,
      ];
      const total = segments.reduce((sum, value) => sum + value, 0);
      if (!total) return [];
      let running = 0;
      return segments.map((segment) => {
        running += segment;
        return running / total;
      });
    };

    class OrbitController {
      constructor(card) {
        this.card = card;
        this.duration = ORBIT_LOOP_DURATION;
        this.trailOffset = ORBIT_TRAIL_FRACTION;
        this.orbit = document.createElement("span");
        this.orbit.className = "cadence-orbit";
        this.trail = document.createElement("span");
        this.trail.className = "cadence-orbit__trail";
        this.head = document.createElement("span");
        this.head.className = "cadence-orbit__head";
        this.orbit.append(this.trail, this.head);
        this.card.appendChild(this.orbit);

        this.progress = 0;
        this.frame = null;
        this.lastTimestamp = null;
        this.pendingFade = null;
        this.segmentStops = [];
        this.alpha = 0;
        this.engaged = false;
        this.reduceMotion = false;

        this.tick = this.tick.bind(this);
        this.updateGeometry = this.updateGeometry.bind(this);

        this.updateGeometry();
        this.updateOrbitDistance();

        if (typeof ResizeObserver === "function") {
          this.resizeObserver = new ResizeObserver(() => this.updateGeometry());
          this.resizeObserver.observe(this.card);
        } else {
          window.addEventListener("resize", this.updateGeometry);
        }
      }

      updateGeometry() {
        const rect = this.card.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        if (!width || !height) return;

        let radius = 0;
        const face = this.card.querySelector(".card-face");
        if (face) {
          const style = window.getComputedStyle(face);
          const radiusValue = style.borderTopLeftRadius;
          const parsed = parseFloat(radiusValue);
          if (!Number.isNaN(parsed)) {
            radius = parsed;
          }
        }

        if (!radius) {
          radius = Math.min(width, height) * 0.12;
        }

        radius = Math.min(radius, width / 2, height / 2);

        const pathData = createRoundedPath(width, height, radius);
        this.orbit.style.setProperty("--orbit-path", `path('${pathData}')`);
        this.segmentStops = computeSegmentStops(width, height, radius);
        this.updateOrbitDistance();
      }

      updateOrbitDistance() {
        const normalized = ((this.progress % 1) + 1) % 1;
        const headDistance = `${(normalized * 100).toFixed(3)}%`;
        const tailNormalized = ((normalized - this.trailOffset) % 1 + 1) % 1;
        const trailDistance = `${(tailNormalized * 100).toFixed(3)}%`;

        this.head.style.setProperty("offset-distance", headDistance);
        this.trail.style.setProperty("offset-distance", trailDistance);

        const energy = 0.85 + 0.15 * Math.sin(normalized * Math.PI * 2);
        this.orbit.style.setProperty("--orbit-energy", energy.toFixed(3));
      }

      setAlpha(value) {
        const clamped = Math.max(0, Math.min(1, value));
        if (Math.abs(clamped - this.alpha) < 0.001) return;
        this.alpha = clamped;
        this.orbit.style.setProperty("--orbit-alpha", clamped.toFixed(3));
      }

      ensureAnimation() {
        if (this.reduceMotion) return;
        if (this.frame !== null) return;
        this.lastTimestamp = null;
        this.frame = requestAnimationFrame(this.tick);
      }

      scheduleFade() {
        if (this.alpha <= 0.001) {
          this.setAlpha(0);
          return;
        }

        const normalized = ((this.progress % 1) + 1) % 1;
        let target = normalized + 0.25;

        if (this.segmentStops && this.segmentStops.length) {
          const nextStop = this.segmentStops.find((stop) => stop > normalized + 0.0001);
          if (typeof nextStop === "number") {
            target = nextStop;
          } else {
            target = this.segmentStops[0] + 1;
          }
        }

        const base = this.progress - normalized;
        this.pendingFade = { trigger: base + target };
      }

      updateEngagedState(isEngaged) {
        this.engaged = isEngaged;
        if (this.reduceMotion) {
          if (!isEngaged) {
            this.setAlpha(0);
          }
          return;
        }

        if (isEngaged) {
          this.pendingFade = null;
          this.setAlpha(1);
          this.ensureAnimation();
        } else {
          this.scheduleFade();
          this.ensureAnimation();
        }
      }

      tick(timestamp) {
        if (this.reduceMotion) {
          if (this.frame !== null) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
          }
          this.lastTimestamp = null;
          return;
        }

        if (this.frame === null) {
          return;
        }

        if (!this.lastTimestamp) {
          this.lastTimestamp = timestamp;
        }

        const delta = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        if (delta > 0) {
          this.progress += delta / this.duration;
        }

        this.updateOrbitDistance();

        if (this.pendingFade && this.progress >= this.pendingFade.trigger) {
          this.pendingFade = null;
          this.setAlpha(0);
        }

        const shouldContinue = this.engaged || this.pendingFade || this.alpha > 0.001;

        if (shouldContinue) {
          this.frame = requestAnimationFrame(this.tick);
        } else {
          this.frame = null;
          this.lastTimestamp = null;
          this.progress = ((this.progress % 1) + 1) % 1;
        }
      }

      setReducedMotion(value) {
        if (this.reduceMotion === value) return;
        this.reduceMotion = value;

        if (value) {
          this.pendingFade = null;
          this.setAlpha(0);
          if (this.frame !== null) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
          }
          this.lastTimestamp = null;
        } else if (this.engaged) {
          this.setAlpha(1);
          this.ensureAnimation();
        }
      }
    }

    const orbitControllers = new WeakMap();

    const FLIP_IN_DURATION = 0.6;
    const FLIP_OUT_DURATION = 0.28;
    const FLIP_IN_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
    const FLIP_OUT_EASING = "cubic-bezier(0.55, 0, 0.55, 0.2)";

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;

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
        const existingOrbit = orbitControllers.get(card);
        if (existingOrbit) {
          existingOrbit.updateEngagedState(card.classList.contains("is-engaged"));
        }
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
      const orbit = orbitControllers.get(card);
      if (orbit) {
        orbit.updateEngagedState(card.classList.contains("is-engaged"));
      }
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
      cards.forEach((card) => {
        const orbit = orbitControllers.get(card);
        if (orbit) {
          orbit.setReducedMotion(reduceMotion);
          orbit.updateEngagedState(card.classList.contains("is-engaged"));
        }
      });
      if (reduceMotion) {
        cards.forEach((card) => {
          setFlipState(card, false, { animate: false, force: true });
          card.classList.remove("is-engaged");
          card.style.setProperty("--layer-shift-x", "0px");
          card.style.setProperty("--layer-shift-y", "0px");
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

      const orbit = new OrbitController(card);
      orbitControllers.set(card, orbit);
      orbit.setReducedMotion(reduceMotion);
      orbit.updateEngagedState(card.classList.contains("is-engaged"));

      card.addEventListener("pointerenter", (event) => {
        if (reduceMotion) return;
        if (event.pointerType && event.pointerType !== "mouse") return;
        closeCards(card);
        setFlipState(card, true);
        updatePointerState(card, event);
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
      });

      card.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          const willFlip = !card.classList.contains("is-flipped");
          closeCards(card);
          if (willFlip && !reduceMotion) {
            updatePointerState(card, event);
          }
          setFlipState(card, willFlip, { animate: !reduceMotion });
          if (typeof card.focus === "function") {
            card.focus({ preventScroll: true });
          }
          event.preventDefault();
        }
      });

      card.addEventListener("focus", () => {
        card.classList.add("is-engaged");
        orbit.updateEngagedState(true);
      });

      card.addEventListener("blur", () => {
        if (!card.classList.contains("is-flipped")) {
          card.classList.remove("is-engaged");
          orbit.updateEngagedState(false);
        }
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
          event.preventDefault();
          const willFlip = !card.classList.contains("is-flipped");
          if (willFlip) {
            closeCards(card);
          }
          setFlipState(card, willFlip, { animate: !reduceMotion });
        } else if (event.key === "Escape") {
          if (card.classList.contains("is-flipped")) {
            event.preventDefault();
            setFlipState(card, false, { animate: !reduceMotion });
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
