import Image from "next/image";
import Nav from "../components/Nav";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { fetchCardsMaths } from "../reducers/cardsMathsSlice";

const WORD = "MathsApp.fr";
const LETTERS = Array.from(WORD);
const BG_SOURCES = {
  mobile: "/bgMobile.jpg",
  large: "/bgLarge.jpg",
};
const ANIMATION_TIMINGS = {
  assembleDuration: 0.45,
  assembleStagger: 0.12,
  revealDelay: 0,
  revealDuration: 1.5,
  raiseDuration: 0.7,
  raiseStagger: 0.12,
  raisePause: 0,
};
const RAISE_START_MS = Math.round(
  ((LETTERS.length - 1) * ANIMATION_TIMINGS.assembleStagger +
    ANIMATION_TIMINGS.assembleDuration +
    ANIMATION_TIMINGS.revealDelay +
    ANIMATION_TIMINGS.revealDuration +
    ANIMATION_TIMINGS.raisePause) *
    1000
);
const ANIMATION_END_MS = Math.round(
  ((LETTERS.length - 1) * ANIMATION_TIMINGS.assembleStagger +
    ANIMATION_TIMINGS.assembleDuration +
    ANIMATION_TIMINGS.revealDelay +
    ANIMATION_TIMINGS.revealDuration +
    ANIMATION_TIMINGS.raisePause +
    (LETTERS.length - 1) * ANIMATION_TIMINGS.raiseStagger +
    ANIMATION_TIMINGS.raiseDuration) *
    1000
);
const BG_SWAP_LEAD_MS = 140;
const BG_ADVANCE_MS = 700;
const BG_SWAP_DELAY_MS = Math.max(
  0,
  RAISE_START_MS - BG_SWAP_LEAD_MS - BG_ADVANCE_MS
);

function useMotionDelayState(delayMs, setState) {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timerId;

    const schedule = () => {
      if (mediaQuery.matches) {
        setState(true);
        return;
      }

      setState(false);
      timerId = window.setTimeout(() => {
        setState(true);
      }, delayMs);
    };

    const handleChange = (event) => {
      if (timerId) {
        window.clearTimeout(timerId);
        timerId = undefined;
      }

      if (event.matches) {
        setState(true);
        return;
      }

      setState(false);
      timerId = window.setTimeout(() => {
        setState(true);
      }, delayMs);
    };

    schedule();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [delayMs, setState]);
}

const isValidPositions = (positions) =>
  Array.isArray(positions) &&
  positions.length === LETTERS.length &&
  positions.every(
    (pos) =>
      pos &&
      Number.isFinite(Number(pos.x)) &&
      Number.isFinite(Number(pos.y))
  );

const toCenterOffset = (pos) => {
  const rawX = Number(pos.x);
  const rawY = Number(pos.y);
  const looksLikeViewportPercent =
    rawX >= 0 && rawX <= 100 && rawY >= 0 && rawY <= 100;

  if (looksLikeViewportPercent) {
    // Anim1 stores absolute vw/vh positions; Anim2 needs offsets from center.
    return { x: rawX - 50, y: rawY - 50 };
  }

  return { x: rawX, y: rawY };
};

const createFallbackPositions = () =>
  LETTERS.map((_, index) => ({
    x: -26 + index * 5.2,
    y: 0,
  }));

function createOrder(count) {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const order = Array(count);
  indices.forEach((index, orderIndex) => {
    order[index] = orderIndex;
  });
  return order;
}

const RANDOM_ORDER = createOrder(LETTERS.length);

function Anim2({ initialPositions }) {
  const [bgSrc, setBgSrc] = useState(BG_SOURCES.mobile);
  const [showNav, setShowNav] = useState(false);
  const [decalage, setDecalage] = useState(0);
  const [allowSpinner, setAllowSpinner] = useState(false);
  const [phaseBg, setPhaseBg] = useState(false);
  const swapDelay = BG_SWAP_DELAY_MS;
  const dispatch = useDispatch();
  const cardsStatus = useSelector((state) => state.cardsMaths.status);
  const loadedClassId = useSelector((state) => state.cardsMaths.data?.__classId);
  const activeClassId = useSelector((state) => state.auth?.user?.classId);
  const letterPositions = useMemo(() => {
    if (isValidPositions(initialPositions)) {
      return initialPositions.map((pos) => toCenterOffset(pos));
    }
    return createFallbackPositions();
  }, [initialPositions]);

  useEffect(() => {
    if (!activeClassId) {
      return;
    }

    const isStaleClass = String(loadedClassId || "") !== String(activeClassId);
    if (cardsStatus === "idle" || (cardsStatus === "succeeded" && isStaleClass)) {
      dispatch(fetchCardsMaths());
    }
  }, [activeClassId, cardsStatus, dispatch, loadedClassId]);

  useEffect(() => {
    const updateLayout = () => {
      const { innerWidth: width, innerHeight: height } = window;
      let value;
      let nextSrc;
      if (width / height > 2) {
        value = 270;
        nextSrc = BG_SOURCES.large;
      } else if (width / height > 1.5) {
        nextSrc = BG_SOURCES.large;
        value = 200;
      }else if (width / height > 1) {
        nextSrc = BG_SOURCES.large;
        value = 150;
      } else {
        value = 0;
        nextSrc = BG_SOURCES.mobile;
      }
      setDecalage(value);
      setBgSrc((current) => (current === nextSrc ? current : nextSrc));
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("orientationchange", updateLayout);
    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("orientationchange", updateLayout);
    };
  }, []);

  useMotionDelayState(RAISE_START_MS, setShowNav);
  useMotionDelayState(swapDelay, setPhaseBg);
  useMotionDelayState(ANIMATION_END_MS, setAllowSpinner);

  return (
    <div
      className={`page${phaseBg ? " page--phase" : ""}`}
      style={{ "--count": LETTERS.length }}
    >
      {showNav ? (
        <div className="navWrap">
          <Nav bg="#d0d9d8" selectedBg="#bec0b6" />
        </div>
      ) : null}
      <div className="stage">
        <div className="word" aria-label={WORD}>
          {LETTERS.map((letter, index) => {
            const pos = letterPositions[index];
            return (
              <span
                key={`${letter}-${index}`}
                className="letter"
                style={{
                  "--i": index,
                  "--order": RANDOM_ORDER[index],
                  "--rx": `${pos.x}vw`,
                  "--ry": `${pos.y}vh`,
                }}
                aria-hidden="true"
              >
                {letter}
              </span>
            );
          })}
        </div>
        <div className="hero" aria-hidden="true">
          <Image
            src={bgSrc}
            alt="Fond d'Ｄran"
            fill
            sizes="100vw"
            className="heroImage"
            priority
          />
        </div>
      </div>
      {allowSpinner && cardsStatus === "loading" ? (
        <div className="loadingOverlay">
          <ClimbingBoxLoader color="#333" size={18} />
          <p className="loadingText">Chargement des cartes...</p>
        </div>
      ) : null}

      <style jsx>{`
        .page {
          min-height: 100vh;
          position: relative;
          background-color: var(--bg-start);
          color: #1a1a1a;
          overflow: hidden;
          --bg-start: #f6f4ef;
          --bg-phasec: #d0d9d8;
          --text-dark: #1a1a1a;
          --text-light: #cfd6d6;
          --duration: 0.45s;
          --stagger: 0.12s;
          --reveal-delay: 0s;
          --reveal-duration: 1.5s;
          --raise-duration: 0.7s;
          --raise-stagger: 0.12s;
          --raise-pause: 0s;
          --word-size: clamp(3.5rem, 8.5vw, 7rem);
          --nav-height: 64px;
          --nav-gap: 50px;
          --top-line: calc(var(--nav-height) + var(--nav-gap));
          --center-shift: calc(-0.5em - 5px);
          --top-shift: calc(var(--top-line) - 50vh);
          --assemble-total: calc(
            (var(--count) - 1) * var(--stagger) + var(--duration)
          );
          --wash-delay: calc(var(--assemble-total) + var(--reveal-delay));
          --wash-duration: var(--reveal-duration);
          --raise-delay: calc(
            var(--assemble-total) + var(--reveal-delay) + var(--reveal-duration) +
              var(--raise-pause)
          );
        }

        .page--phase {
          background-color: var(--bg-phasec);
        }

        .stage {
          width: 100vw;
          height: 100vh;
          position: relative;
          z-index: 1;
        }

        .navWrap {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 4;
          animation: nav-drop 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .navWrap :global(.nav-header) {
          width: 100%;
          height: var(--nav-height);
          line-height: var(--nav-height);
        }

        .loadingOverlay {
          position: absolute;
          inset: 0;
          background-color: rgba(170, 170, 170, 0.5);
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          gap: 14px;
        }

        .loadingText {
          margin: 0;
          font-size: 1.5rem;
          color: #333;
          letter-spacing: 0.02em;
        }

        .word {
          position: absolute;
          inset: 0;
          font-family: "Courier New", Courier, monospace;
          font-weight: 700;
          font-size: var(--word-size);
          letter-spacing: 0.02em;
          line-height: 1;
          --spacing: 1.05ch;
          --half: calc((var(--count) - 1) * var(--spacing) / 2);
          z-index: 3;
          pointer-events: none;
        }

        .letter {
          position: absolute;
          left: 50%;
          top: 50%;
          font-weight: 700;
          color: var(--text-dark);
          transform: translate(var(--rx), var(--ry));
          animation-name: assemble, wash, raise;
          animation-duration: var(--duration), var(--wash-duration),
            var(--raise-duration);
          animation-timing-function: cubic-bezier(0.2, 0.7, 0.2, 1),
            cubic-bezier(0.2, 0.8, 0.2, 1), cubic-bezier(0.2, 0.6, 0.2, 1);
          animation-delay: calc(var(--i) * var(--stagger)), var(--wash-delay),
            calc(var(--raise-delay) + (var(--order) * var(--raise-stagger)));
          animation-fill-mode: both, both, forwards;
          will-change: transform, opacity;
        }

        .hero {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0;
          height: 0;
          min-width: 1px;
          min-height: 1px;
          transform: translate(-50%, -50%);
          overflow: hidden;
          z-index: 1;
          animation-name: reveal, hero-slide;
          animation-duration: var(--reveal-duration),
            calc(var(--raise-duration) * 1.6);
          animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1),
            cubic-bezier(0.2, 0.6, 0.2, 1);
          animation-delay: calc(var(--assemble-total) + var(--reveal-delay)),
            var(--raise-delay);
          animation-fill-mode: both, forwards;
        }

        :global(.heroImage) {
          object-fit: cover;
        }

        @keyframes assemble {
          0% {
            transform: translate(var(--rx), var(--ry));
            opacity: 0.35;
          }
          100% {
            transform: translate(
              calc((var(--i) * var(--spacing)) - var(--half)),
              var(--center-shift)
            );
            opacity: 1;
          }
        }

        @keyframes reveal {
          0% {
            width: 0;
            height: 0;
            opacity: 0;
          }
          100% {
            width: 100vw;
            height: 100vh;
            opacity: 1;
          }
        }

        @keyframes nav-drop {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes hero-slide {
          0% {
            transform: translate(-50%, -50%);
          }
          100% {
            transform: translate(-50%, calc(-50% + ${decalage}px));
          }
        }

        @keyframes wash {
          0% {
            color: var(--text-dark);
          }
          100% {
            color: var(--text-light);
          }
        }

        @keyframes raise {
          0% {
            transform: translate(
              calc((var(--i) * var(--spacing)) - var(--half)),
              var(--center-shift)
            );
            font-weight: 700;
            color: var(--text-light);
          }
          100% {
            transform: translate(
              calc((var(--i) * var(--spacing)) - var(--half)),
              var(--top-shift)
            );
            font-weight: 500;
            color: var(--text-dark);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .letter {
            animation: none;
            transform: translate(
              calc((var(--i) * var(--spacing)) - var(--half)),
              var(--top-shift)
            );
            opacity: 1;
            font-weight: 500;
            color: var(--text-dark);
          }

          .hero {
            animation: none;
            width: 100vw;
            height: 100vh;
            top: 50%;
            transform: translate(-50%, calc(-50% + 150px));
            opacity: 1;
          }

          .navWrap {
            animation: none;
            transform: none;
            opacity: 1;
          }
        }

        @media (max-width: 700px) {
          .page {
            --word-size: calc(90vw / 6.8);
            --center-shift: -0.5em;
          }
          .word {
            --half: calc((var(--count) - 1) * var(--spacing) / 2 + 0.5ch);
          }
        }
      `}</style>
    </div>
  );
}

export default Anim2;
