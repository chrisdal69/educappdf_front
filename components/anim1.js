import React, { useEffect, useRef, useState } from "react";
import Login from "./Login";

const WORD = "MathsApp.fr";
const LETTERS = Array.from(WORD);
const HALF_INDEX = Math.ceil(LETTERS.length / 2);
const POSITION_BOUNDS = {
  minX: 18,
  maxX: 82,
  minY: 16,
  maxY: 84,
};
const ANIMATION = {
  lettersDuration: 1.1,
  loginDuration: 2,
  veilDuration: 0.15,
};
const DEFAULT_EXCLUSION_ZONE = {
  minX: 26,
  maxX: 74,
  minY: 24,
  maxY: 78,
};
const LOGIN_ZONE_PADDING = {
  x: 2.5,
  y: 2.5,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isInsideZone(x, y, zone) {
  return (
    x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY
  );
}

function createExclusionZone(viewportWidth, viewportHeight, panelWidth, panelHeight) {
  const widthPct = (panelWidth / viewportWidth) * 100;
  const heightPct = (panelHeight / viewportHeight) * 100;
  const rawMinX = 50 - widthPct / 2 - LOGIN_ZONE_PADDING.x;
  const rawMaxX = 50 + widthPct / 2 + LOGIN_ZONE_PADDING.x;
  const rawMinY = 50 - heightPct / 2 - LOGIN_ZONE_PADDING.y;
  const rawMaxY = 50 + heightPct / 2 + LOGIN_ZONE_PADDING.y;
  return {
    minX: clamp(rawMinX, 0, 100),
    maxX: clamp(rawMaxX, 0, 100),
    minY: clamp(rawMinY, 0, 100),
    maxY: clamp(rawMaxY, 0, 100),
  };
}

function createPositions(count, bounds, exclusionZone) {
  const { minX, maxX, minY, maxY } = bounds;
  const hasZone = Boolean(exclusionZone);
  return Array.from({ length: count }, () => {
    let attempts = 0;
    let x = minX;
    let y = minY;

    do {
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);
      attempts += 1;
    } while (hasZone && isInsideZone(x, y, exclusionZone) && attempts < 120);

    if (hasZone && isInsideZone(x, y, exclusionZone)) {
      const topSpace = Math.max(0, exclusionZone.minY - minY);
      const bottomSpace = Math.max(0, maxY - exclusionZone.maxY);
      if (topSpace + bottomSpace > 0) {
        const chooseTop = Math.random() * (topSpace + bottomSpace) < topSpace;
        if (chooseTop && topSpace > 0) {
          y = minY + Math.random() * topSpace;
        } else if (bottomSpace > 0) {
          y = exclusionZone.maxY + Math.random() * bottomSpace;
        }
      }
      x = minX + Math.random() * (maxX - minX);
    }

    return { x: Math.round(x), y: Math.round(y) };
  });
}

function Anim1({ onLoginTransitionComplete }) {
  const loginPanelRef = useRef(null);
  const [positions, setPositions] = useState([]);
  const [isClosingLogin, setIsClosingLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [closeStartedAt, setCloseStartedAt] = useState(null);

  useEffect(() => {
    const updatePositions = () => {
      const panel = loginPanelRef.current;
      if (!panel) {
        setPositions(
          createPositions(LETTERS.length, POSITION_BOUNDS, DEFAULT_EXCLUSION_ZONE)
        );
        return;
      }

      const viewportWidth = window.innerWidth || 1;
      const viewportHeight = window.innerHeight || 1;
      const exclusionZone = createExclusionZone(
        viewportWidth,
        viewportHeight,
        panel.offsetWidth,
        panel.offsetHeight
      );

      setPositions(createPositions(LETTERS.length, POSITION_BOUNDS, exclusionZone));
    };

    updatePositions();
    window.addEventListener("resize", updatePositions);
    return () => {
      window.removeEventListener("resize", updatePositions);
    };
  }, []);

  useEffect(() => {
    if (!isClosingLogin || !isAuthenticated || !closeStartedAt) {
      return;
    }

    const elapsed = Date.now() - closeStartedAt;
    const remaining = Math.max(0, 2000 - elapsed);
    const timerId = window.setTimeout(() => {
      onLoginTransitionComplete?.(positions);
    }, remaining);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    closeStartedAt,
    isClosingLogin,
    isAuthenticated,
    onLoginTransitionComplete,
    positions,
  ]);

  return (
    <div
      className="page"
      style={{
        "--letters-duration": `${ANIMATION.lettersDuration}s`,
        "--login-duration": `${ANIMATION.loginDuration}s`,
        "--veil-duration": `${ANIMATION.veilDuration}s`,
      }}
    >
      <div className="word" aria-label={WORD}>
        {LETTERS.map((letter, index) => {
          const pos = positions[index];
          if (!pos) {
            return null;
          }
          const fromX = index < HALF_INDEX ? "-12vw" : "112vw";
          return (
            <span
              key={`${letter}-${index}`}
              className="letter"
              style={{
                "--x": `${pos.x}vw`,
                "--y": `${pos.y}vh`,
                "--from-x": fromX,
              }}
              aria-hidden="true"
            >
              {letter}
            </span>
          );
        })}
      </div>

      <div className="veil" aria-hidden="true" />

      <div className="loginWrap">
        <div
          ref={loginPanelRef}
          className={`loginPanel${isClosingLogin ? " loginPanel--closing" : ""}`}
        >
          <Login
            isOpen
            close={() => {}}
            deferNavigation
            onFinalActionStart={() => {
              setCloseStartedAt(Date.now());
              setIsClosingLogin(true);
            }}
            onFinalActionError={() => {
              setCloseStartedAt(null);
              setIsClosingLogin(false);
              setIsAuthenticated(false);
            }}
            onAuthenticated={() => setIsAuthenticated(true)}
          />
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          position: relative;
          background-color: #f6f4ef;
          color: #1a1a1a;
          overflow: hidden;
        }

        .word {
          position: absolute;
          inset: 0;
          font-family: "Courier New", Courier, monospace;
          font-weight: 300;
          font-size: clamp(3.5rem, 8.5vw, 7rem);
          letter-spacing: 0.02em;
          line-height: 1;
          pointer-events: none;
          z-index: 1;
        }

        .letter {
          position: absolute;
          top: var(--y);
          left: var(--x);
          transform: translate(-50%, -50%);
          opacity: 0;
          animation: letter-in var(--letters-duration)
            cubic-bezier(0.22, 0.7, 0.2, 1) forwards;
        }

        .veil {
          position: absolute;
          inset: 0;
          background: rgba(25, 30, 36, 0.28);
          opacity: 0;
          z-index: 2;
          animation: veil-in var(--veil-duration) ease-out forwards;
          animation-delay: var(--login-duration);
          pointer-events: none;
        }

        .loginWrap {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .loginPanel {
          width: min(92vw, 28rem);
          max-height: 88vh;
          transform: scale(0);
          transform-origin: center center;
          opacity: 0;
          animation: login-in var(--login-duration) cubic-bezier(0.2, 0.85, 0.2, 1)
            forwards;
          will-change: transform, opacity;
        }

        .loginPanel--closing {
          pointer-events: none;
          overflow: hidden;
          animation: login-out 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes letter-in {
          0% {
            left: var(--from-x);
            opacity: 0;
          }
          100% {
            left: var(--x);
            opacity: 1;
          }
        }

        @keyframes login-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes login-out {
          0% {
            transform: scale(1);
            opacity: 1;
            width: min(92vw, 28rem);
            max-height: 88vh;
          }
          100% {
            transform: scale(0);
            opacity: 0;
            width: 0;
            max-height: 0;
          }
        }

        @keyframes veil-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .letter {
            animation: none;
            left: var(--x);
            opacity: 1;
          }

          .loginPanel {
            animation: none;
            transform: scale(1);
            opacity: 1;
          }

          .veil {
            animation: none;
            opacity: 1;
          }
        }

        @media (max-width: 700px) {
          .word {
            font-size: calc(90vw / 6.8);
          }
        }
      `}</style>
    </div>
  );
}

export default Anim1;
