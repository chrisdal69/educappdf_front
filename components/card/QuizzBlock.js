import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";

import { Radio, Button, Card, Carousel, message } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { buildCardBaseUrl } from "../../utils/gcsPaths";
import { clearAuth } from "../../reducers/authSlice";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

const parseInlineKatex = (input) => {
  const tokens = [];
  const text = String(input ?? "");
  let buffer = "";
  let inMath = false;
  let hasUnmatched = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\") {
      const next = text[i + 1];
      if (next === "$") {
        buffer += "$";
        i += 1;
        continue;
      }
      buffer += char;
      continue;
    }
    if (char === "$") {
      if (inMath) {
        if (buffer.length === 0) {
          const last = tokens[tokens.length - 1];
          if (last && last.type === "text") {
            last.value += "$$";
          } else {
            tokens.push({ type: "text", value: "$$" });
          }
        } else {
          tokens.push({ type: "math", value: buffer });
        }
        buffer = "";
        inMath = false;
      } else {
        if (buffer.length > 0) {
          tokens.push({ type: "text", value: buffer });
        }
        buffer = "";
        inMath = true;
      }
      continue;
    }
    buffer += char;
  }

  if (inMath) {
    hasUnmatched = true;
    const literal = `$${buffer}`;
    const last = tokens[tokens.length - 1];
    if (last && last.type === "text") {
      last.value += literal;
    } else if (literal.length > 0) {
      tokens.push({ type: "text", value: literal });
    }
    return { parts: tokens, hasUnmatched };
  }

  if (buffer.length > 0) {
    tokens.push({ type: "text", value: buffer });
  }

  return { parts: tokens, hasUnmatched };
};

const renderInlineKatex = (input) => {
  const { parts, hasUnmatched } = parseInlineKatex(input);
  const nodes = parts.map((part, i) =>
    part.type === "text" ? (
      <React.Fragment key={`text-${i}`}>{part.value}</React.Fragment>
    ) : (
      <InlineMath key={`math-${i}`} math={part.value} />
    )
  );
  return { nodes, hasUnmatched };
};

export default function Quizz({
  num,
  repertoire,
  classeDirectoryname,
  quizz,
  evalQuizz,
  resultatQuizz,
  _id,
  id,
  bg,
  isExpanded,
}) {
  const dispatch = useDispatch();
  const router = useRouter();
  const carouselRef = useRef(null);
  const preloadedImagesRef = useRef(new Set());
  const imageWheelHandlersRef = useRef(new Map());
  const imageTouchHandlersRef = useRef(new Map());
  const pinchStateRef = useRef(new Map());
  const lastTapRef = useRef(new Map());
  const didExpireRef = useRef(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [hovered, setHovered] = useState(null);
  const [zoomScales, setZoomScales] = useState({});
  const [zoomOrigins, setZoomOrigins] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [scoreMessage, setScoreMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [hasHistory, setHasHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const baseUrl = buildCardBaseUrl({ classeDirectoryname, repertoire, num });
  const racine = baseUrl ? `${baseUrl}imagesQuizz/` : "";
  const bgRoot = baseUrl;

  
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const cardId = _id || id;
  const classId = user?.classId ? String(user.classId) : "";

  const handleSessionExpired = () => {
    if (didExpireRef.current) return;
    didExpireRef.current = true;
    messageApi.error("Session expirée, il faut se reloguer");
    setTimeout(() => {
      dispatch(clearAuth());
      router.replace("/");
    }, 3000);
  };

  const toBlurFile = (filename) => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };

  const blurBg = bg ? toBlurFile(bg) : "";
  const showBackground = Boolean(isExpanded && bg);

  const handlePrev = () => {
    setCurrent((c) => Math.max(0, c - 1));
    carouselRef.current?.prev();
  };

  const handleNext = () => {
    setCurrent((c) => Math.min(quizz.length - 1, c + 1));
    carouselRef.current?.next();
  };

  // Echelle de progression dynamique (points rapproches)
  const DOT = 10; // diametre du point (px)
  const GAP = 20; // espace entre points (px)
  const trackWidth = quizz.length * DOT + (quizz.length - 1) * GAP;

  const reponsesArray = quizz.map((q) => answers[q.id]);
  const allAnswered = reponsesArray.every((r) => r !== undefined);

  const handleSelect = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const clampPercent = (value) => Math.max(0, Math.min(100, value));

  const clampScale = (value) => Math.max(1, Math.min(3, value));

  const getTouchDistance = (t1, t2) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const getTouchCenter = (t1, t2) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const toggleZoomAt = (qid, rect, clientX, clientY) => {
    let origin = "50% 50%";
    if (rect?.width && rect?.height) {
      const x = clampPercent(((clientX - rect.left) / rect.width) * 100);
      const y = clampPercent(((clientY - rect.top) / rect.height) * 100);
      origin = `${x}% ${y}%`;
    }
    setZoomOrigins((prev) => ({ ...prev, [qid]: origin }));
    setZoomScales((prev) => {
      const currentScale = prev[qid] ?? 1;
      const nextScale = currentScale > 1 ? 1 : 2;
      return { ...prev, [qid]: nextScale };
    });
  };

  const handleImageDoubleClick = (event, qid) => {
    event.preventDefault();
    event.stopPropagation();
    toggleZoomAt(qid, event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
  };

  const handleImageTouchStart = (event, qid) => {
    const touches = event.touches;
    if (!touches) return;
    if (touches.length === 2) {
      if (event.cancelable) {
        event.preventDefault();
      }
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      const [t1, t2] = touches;
      const rect = event.currentTarget?.getBoundingClientRect?.();
      if (rect?.width && rect?.height) {
        const center = getTouchCenter(t1, t2);
        const x = clampPercent(((center.x - rect.left) / rect.width) * 100);
        const y = clampPercent(((center.y - rect.top) / rect.height) * 100);
        setZoomOrigins((prev) => ({ ...prev, [qid]: `${x}% ${y}%` }));
      }
      const startDistance = getTouchDistance(t1, t2);
      if (!Number.isFinite(startDistance) || startDistance <= 0) return;
      pinchStateRef.current.set(qid, {
        startDistance,
        startScale: zoomScales[qid] ?? 1,
      });
      return;
    }
    if (touches.length !== 1) return;
    const touch = touches[0];
    const now = Date.now();
    const lastTap = lastTapRef.current.get(qid);
    const isQuick = lastTap && now - lastTap.time <= 300;
    const distance = lastTap
      ? Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y)
      : Infinity;

    if (isQuick && distance <= 24) {
      event.preventDefault();
      toggleZoomAt(
        qid,
        event.currentTarget.getBoundingClientRect(),
        touch.clientX,
        touch.clientY
      );
      lastTapRef.current.delete(qid);
      return;
    }

    lastTapRef.current.set(qid, {
      time: now,
      x: touch.clientX,
      y: touch.clientY,
    });
  };

  const handleImageTouchMove = (event, qid) => {
    const touches = event.touches;
    if (!touches || touches.length !== 2) return;
    const state = pinchStateRef.current.get(qid);
    if (!state) return;
    if (event.cancelable) {
      event.preventDefault();
    }
    if (typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    const [t1, t2] = touches;
    const rect = event.currentTarget?.getBoundingClientRect?.();
    if (rect?.width && rect?.height) {
      const center = getTouchCenter(t1, t2);
      const x = clampPercent(((center.x - rect.left) / rect.width) * 100);
      const y = clampPercent(((center.y - rect.top) / rect.height) * 100);
      setZoomOrigins((prev) => ({ ...prev, [qid]: `${x}% ${y}%` }));
    }
    const distance = getTouchDistance(t1, t2);
    if (!Number.isFinite(distance) || state.startDistance <= 0) return;
    const nextScale = clampScale(
      state.startScale * (distance / state.startDistance)
    );
    setZoomScales((prev) => ({ ...prev, [qid]: nextScale }));
  };

  const handleImageTouchEnd = (event, qid) => {
    if (!qid) return;
    if (event.touches && event.touches.length >= 2) return;
    pinchStateRef.current.delete(qid);
  };

  const handleImageWheel = (event, qid) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    if (typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    const target = event.currentTarget || event.target;
    const rect = target?.getBoundingClientRect?.();
    if (!rect) return;
    if (rect.width && rect.height) {
      const x = clampPercent(
        ((event.clientX - rect.left) / rect.width) * 100
      );
      const y = clampPercent(
        ((event.clientY - rect.top) / rect.height) * 100
      );
      setZoomOrigins((prev) => ({ ...prev, [qid]: `${x}% ${y}%` }));
    }

    const delta = event.deltaY < 0 ? 0.2 : -0.2;
    setZoomScales((prev) => {
      const currentScale = prev[qid] ?? 1;
      const nextScale = clampScale(currentScale + delta);
      return { ...prev, [qid]: nextScale };
    });
  };

  const setImageContainerRef = (qid) => (node) => {
    const existing = imageWheelHandlersRef.current.get(qid);
    if (existing?.node && existing?.handler) {
      existing.node.removeEventListener("wheel", existing.handler);
      imageWheelHandlersRef.current.delete(qid);
    }
    const existingTouch = imageTouchHandlersRef.current.get(qid);
    if (existingTouch?.node && existingTouch?.handlers) {
      const { start, move, end } = existingTouch.handlers;
      existingTouch.node.removeEventListener("touchstart", start);
      existingTouch.node.removeEventListener("touchmove", move);
      existingTouch.node.removeEventListener("touchend", end);
      existingTouch.node.removeEventListener("touchcancel", end);
      imageTouchHandlersRef.current.delete(qid);
    }
    if (!node) return;
    const handler = (event) => handleImageWheel(event, qid);
    node.addEventListener("wheel", handler, { passive: false });
    imageWheelHandlersRef.current.set(qid, { node, handler });
    const touchStart = (event) => handleImageTouchStart(event, qid);
    const touchMove = (event) => handleImageTouchMove(event, qid);
    const touchEnd = (event) => handleImageTouchEnd(event, qid);
    node.addEventListener("touchstart", touchStart, { passive: false });
    node.addEventListener("touchmove", touchMove, { passive: false });
    node.addEventListener("touchend", touchEnd, { passive: false });
    node.addEventListener("touchcancel", touchEnd, { passive: false });
    imageTouchHandlersRef.current.set(qid, {
      node,
      handlers: { start: touchStart, move: touchMove, end: touchEnd },
    });
  };

  useEffect(
    () => () => {
      imageWheelHandlersRef.current.forEach(({ node, handler }) => {
        node.removeEventListener("wheel", handler);
      });
      imageWheelHandlersRef.current.clear();
      imageTouchHandlersRef.current.forEach(({ node, handlers }) => {
        if (!handlers) return;
        node.removeEventListener("touchstart", handlers.start);
        node.removeEventListener("touchmove", handlers.move);
        node.removeEventListener("touchend", handlers.end);
        node.removeEventListener("touchcancel", handlers.end);
      });
      imageTouchHandlersRef.current.clear();
      pinchStateRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Array.isArray(quizz)) return;
    const sources = quizz
      .map((q) => q?.image)
      .filter(Boolean)
      .map((image) => `${racine}${image}`);

    sources.forEach((src) => {
      if (preloadedImagesRef.current.has(src)) return;
      const img = new window.Image();
      img.src = src;
      preloadedImagesRef.current.add(src);
    });
  }, [quizz, racine]);

  useEffect(() => {
    if (evalQuizz !== "oui" || !cardId || !isAuthenticated) return;
    let cancelled = false;

    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const res = await fetch(
          `${urlFetch}/quizzs/historique?cardId=${cardId}`,
          { credentials: "include" }
        );
        if (res.status === 401) {
          if (!cancelled) {
            handleSessionExpired();
          }
          return;
        }
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && payload?.alreadyDone) {
          const dateStr = payload.date
            ? new Date(payload.date).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "";
          setHistoryMessage(
            dateStr ? `Quizz déjà soumis le ${dateStr}.` : "Quizz déjà soumis."
          );
          if (
            resultatQuizz &&
            payload.correctCount !== undefined &&
            payload.totalQuestions !== undefined
          ) {
            setScoreMessage(
              `${payload.correctCount} reponses correctes sur ${payload.totalQuestions}.`
            );
          }
          setHasHistory(true);
        }
      } catch (error) {
        // en cas d'erreur, on laisse l'utilisateur tenter
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [evalQuizz, cardId, isAuthenticated, resultatQuizz]);

  const handleSubmit = async () => {
    if (!cardId) {
      messageApi.error("Identifiant de carte manquant.");
      return;
    }

    const reponses = quizz.map((q) => answers[q.id]);
    const missing = reponses.findIndex((r) => r === undefined);
    if (missing !== -1) {
      messageApi.warning(
        "Merci de repondre a toutes les questions avant d'envoyer."
      );
      setCurrent(missing);
      carouselRef.current?.goTo(missing);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${urlFetch}/quizzs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cardId, reponses, id_classe: classId }),
      });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        messageApi.error(
          payload?.message || "Enregistrement des reponses impossible."
        );
        return;
      }
      messageApi.success("Reponses enregistrees.");
      if (payload?.alreadyDone && payload.correctCount !== undefined) {
        setScoreMessage(
          `Quizz deja traite : ${payload.correctCount} reponses correctes sur ${payload.totalQuestions}.`
        );
      } else if (
        resultatQuizz &&
        payload?.correctCount !== undefined &&
        payload?.totalQuestions !== undefined
      ) {
        setScoreMessage(
          `${payload.correctCount} reponses correctes sur ${payload.totalQuestions}.`
        );
      } else {
        setScoreMessage("");
      }
      if (payload?.date) {
        const dateStr = new Date(payload.date).toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        });
        setHistoryMessage(`Quizz soumis le ${dateStr}.`);
      } else {
        setHistoryMessage("Quizz soumis.");
      }
      setHasHistory(true);
    } catch (error) {
      messageApi.error("Erreur lors de l'envoi des reponses.");
    } finally {
      setSubmitting(false);
    }
  };

  const canAccess =
    evalQuizz === "non" || (evalQuizz === "oui" && isAuthenticated);
  const showOverlay = submitting || historyLoading;

  return (
    <div className="relative w-full">
      {contextHolder}
      {showBackground && (
        <>
          <div className="absolute inset-0 z-0">
            <Image
              src={`${bgRoot}${bg}`}
              alt=""
              fill
              placeholder="blur"
              blurDataURL={`${bgRoot}${blurBg}`}
              sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover object-center"
            />
          </div>
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ background: "rgba(255,255,255,0.8)" }}
          />
        </>
      )}
      <div className="relative z-20 p-4">
        {evalQuizz === "attente" ? (
          <p>Quizz en attente de validation.</p>
        ) : canAccess ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              position: "relative",
            }}
          >
            {showOverlay && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                }}
              >
                <ClimbingBoxLoader color="#6C6C6C" size={12} />
              </div>
            )}
            {/* Echelle de progression */}

            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                marginBottom: 4,
                marginTop: 14,
              }}
            >
            {current > 0 && (
              <Button
                type="default"
                shape="circle"
                onClick={handlePrev}
                style={{
                  position: "relative",
                  top: "3px",
                  marginRight: "20px",
                  zIndex: 2,
                  background: "#fff",
                  transform: "translateY(-50%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
                aria-label="Precedent"
              >
                <ChevronLeft size={18} />
              </Button>
            )}
            <div
              style={{
                position: "relative",
                width: trackWidth,
                height: 12,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  height: 1,
                  background: "#e5e5e5",
                  transform: "translateY(-50%)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                {quizz.map((q, idx) => {
                  const answered = answers[q.id] !== undefined;
                  const isCurrent = idx === current;
                  const size = answered ? DOT + 4 : DOT;
                  const bg = isCurrent
                    ? "#595959"
                    : answered
                    ? "#1890ff"
                    : "#d9d9d9";
                  return (
                    <div
                      key={q.id}
                      role="button"
                      onClick={() => {
                        setCurrent(idx);
                        carouselRef.current?.goTo(idx);
                      }}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: "50%",
                        backgroundColor: bg,
                        border: "1px solid #bfbfbf",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                      aria-label={`Aller a la question ${idx + 1}`}
                    />
                  );
                })}
              </div>
            </div>
            {current < quizz.length - 1 && (
              <Button
                type="default"
                shape="circle"
                onClick={handleNext}
                style={{
                  position: "relative",
                  top: "3px",
                  marginLeft: "20px",
                  zIndex: 2,
                  background: "#fff",
                  transform: "translateY(-50%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
                aria-label="Suivant"
              >
                <ChevronRight size={18} />
              </Button>
            )}
          </div>

          {/* Carrousel de questions */}
          <Carousel
            ref={carouselRef}
            dots
            swipe
            draggable
            infinite={false}
            beforeChange={(_, to) => setCurrent(to)}
            afterChange={(i) => setCurrent(i)}
            adaptiveHeight
            className="max-w-xs sm:max-w-2xl"
          >
            {quizz.map((q) => {
              const { nodes: questionJsx, hasUnmatched: questionHasError } =
                renderInlineKatex(q.question);
              const scale = zoomScales[q.id] ?? 1;
              const isZoomed = scale > 1;
              return (
                <div
                  key={q.id}
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <Card
                    style={{
                      margin: "4px auto",
                      width: "100%",
                      maxWidth: "100%",
                      textAlign: "center",
                      padding: "0px",
                      backgroundColor:"rgba(100,100,100,0.2)",
                    }}
                  >
                    <div style={{ position: "relative", marginBottom: 0 }}>
                      {q.image && (
                        <div
                          style={{
                            display: "inline-block",
                            borderRadius: 8,
                            overflow: "hidden",
                            boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                            cursor: isZoomed ? "zoom-out" : "zoom-in",
                            overscrollBehavior: "contain",
                            touchAction: "none",
                          }}
                          ref={setImageContainerRef(q.id)}
                          onDoubleClick={(event) =>
                            handleImageDoubleClick(event, q.id)
                          }
                        >
                          <Image
                            src={racine + q.image}
                            alt=""
                            width={300}
                            height={300}
                            loading="eager"
                            style={{
                              display: "block",
                              margin: 0,
                              transition: "transform 200ms ease",
                              transform: isZoomed
                                ? `scale(${scale})`
                                : hovered === q.id
                                ? "scale(1.04)"
                                : "scale(1)",
                              transformOrigin:
                                zoomOrigins[q.id] || "50% 50%",
                            }}
                            onMouseEnter={() => setHovered(q.id)}
                            onMouseLeave={() => setHovered(null)}
                          />
                        </div>
                      )}
                    </div>

                    <p
                      style={{
                        marginBottom: 10,

                        color:
                          evalQuizz === "non" &&
                          Number.isInteger(q.correct) &&
                          answers[q.id] !== undefined
                            ? answers[q.id] === q.correct
                              ? "#52c41a"
                              : "#ff4d4f"
                            : undefined,
                      }}
                    >
                      {questionJsx}
                      {questionHasError && (
                        <span
                          style={{
                            color: "#ff4d4f",
                            marginLeft: 6,
                            fontSize: 12,
                          }}
                        >
                          ($ non ferme)
                        </span>
                      )}
                    </p>

                    <Radio.Group
                      value={answers[q.id] ?? null}
                      onChange={(e) => handleSelect(q.id, e.target.value)}
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 2,
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {q.options.map((opt, i) => {
                        const sel = answers[q.id] === i;
                        const showFeedback =
                          evalQuizz === "non" && Number.isInteger(q.correct);
                        const isOk =
                          showFeedback && sel && answers[q.id] === q.correct;
                        const isErr =
                          showFeedback && sel && answers[q.id] !== q.correct;
                        const borderColor = isOk
                          ? "#52c41a"
                          : isErr
                          ? "#ff4d4f"
                          : "transparent";
                        const bg = isOk
                          ? "rgba(82,196,26,0.12)"
                          : isErr
                          ? "rgba(255,77,79,0.12)"
                          : sel
                          ? "rgba(0,0,0,0.05)"
                          : "transparent";
                        const textColor = isOk
                          ? "#52c41a"
                          : isErr
                          ? "#ff4d4f"
                          : undefined;
                        const { nodes: optJsx, hasUnmatched: optHasError } =
                          renderInlineKatex(opt);

                        return (
                          <div
                            key={i}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 8,
                              border: `1px solid ${borderColor}`,
                              backgroundColor: bg,
                            }}
                          >
                            <Radio value={i} style={{ color: textColor }}>
                              {optJsx}
                              {optHasError && (
                                <span
                                  style={{
                                    color: "#ff4d4f",
                                    marginLeft: 6,
                                    fontSize: 12,
                                  }}
                                >
                                  ($ non ferme)
                                </span>
                              )}
                            </Radio>
                          </div>
                        );
                      })}
                    </Radio.Group>
                  </Card>
                </div>
              );
            })}
          </Carousel>
          {evalQuizz === "oui" && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              {!hasHistory && !historyLoading && (
                <Button
                  type="primary"
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={submitting || !allAnswered}
                >
                  Envoyer mes reponses
                </Button>
              )}
              {historyMessage && (
                <p style={{ marginTop: 8 }}>{historyMessage}</p>
              )}
              {scoreMessage && <p style={{ marginTop: 4 }}>{scoreMessage}</p>}
            </div>
          )}
          </div>
        ) : (
          <p>Il faut etre connecte pour acceder au quizz.</p>
        )}
      </div>
    </div>
  );
}
