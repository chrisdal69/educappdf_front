import { Fragment, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { Radio, Button, Card, Carousel, message } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import { useRouter } from "next/router";
import { handleAuthError, throwIfUnauthorized } from "../../../utils/auth";
import { buildCardBaseUrl } from "../../../utils/gcsPaths";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

const parseInlineKatex = (input) => {
  const tokens = [];
  const text = String(input ?? "");
  let buffer = "";
  let inMath = false;

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
    const literal = `$${buffer}`;
    const last = tokens[tokens.length - 1];
    if (last && last.type === "text") {
      last.value += literal;
    } else if (literal.length > 0) {
      tokens.push({ type: "text", value: literal });
    }
    return tokens;
  }

  if (buffer.length > 0) {
    tokens.push({ type: "text", value: buffer });
  }

  return tokens;
};

const renderInlineKatex = (input) => {
  const parts = parseInlineKatex(input);
  return parts.map((part, i) =>
    part.type === "text" ? (
      <Fragment key={`text-${i}`}>{part.value}</Fragment>
    ) : (
      <InlineMath key={`math-${i}`} math={part.value} />
    )
  );
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
  expanded,
}) {
  const carouselRef = useRef(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [hovered, setHovered] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scoreMessage, setScoreMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [hasHistory, setHasHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [resultStats, setResultStats] = useState({
    totalSubmissions: 0,
    correctCounts: [],
  });
  const [resultsLoading, setResultsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const baseUrl = buildCardBaseUrl({ classeDirectoryname, repertoire, num });
  const racine = baseUrl ? `${baseUrl}imagesQuizz/` : "";
  const bgRoot = baseUrl;
  const toBlurFile = (filename = "") => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };
  const blurBg = bg ? toBlurFile(bg) : "";
  const isExpanded = expanded !== false;
  const showBackground = Boolean(isExpanded && bg);

  
  const { isAuthenticated } = useSelector((state) => state.auth);
  const cardId = _id || id;
  const dispatch = useDispatch();
  const router = useRouter();
  const authFetch = async (url, options) => {
    const response = await fetch(url, options);
    throwIfUnauthorized(response);
    return response;
  };

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

  const showOverlay = submitting || historyLoading || resultsLoading || exportLoading;
  const totalSubmissions = Number.isFinite(resultStats.totalSubmissions)
    ? Math.max(0, resultStats.totalSubmissions)
    : 0;
  const correctForCurrent =
    Array.isArray(resultStats.correctCounts) && resultStats.correctCounts.length
      ? Math.max(0, Number(resultStats.correctCounts[current]) || 0)
      : 0;
  const wrongForCurrent = Math.max(0, totalSubmissions - correctForCurrent);
  const percentCorrect =
    totalSubmissions > 0
      ? Math.round((correctForCurrent / totalSubmissions) * 100)
      : 0;
  const pieBackground =
    totalSubmissions > 0
      ? `conic-gradient(#52c41a ${percentCorrect}%, #ff4d4f ${percentCorrect}% 100%)`
      : "radial-gradient(circle at center, #e5e5e5 0, #e5e5e5 100%)";

  const handleReloadResults = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    setResultsLoading(true);
    try {
      const res = await authFetch(`${urlFetch}/quizzs/${cardId}/results`, {
        credentials: "include",
      });
      const payload = await res.json();
      if (res.ok) {
        const rawCounts = Array.isArray(payload?.correctCounts)
          ? payload.correctCounts
          : [];
        const normalizedCounts = Array.from(
          { length: quizz.length },
          (_, idx) => {
            const val = Number(rawCounts[idx]);
            return Number.isFinite(val) ? val : 0;
          }
        );
        setResultStats({
          totalSubmissions: payload?.totalSubmissions ?? 0,
          correctCounts: normalizedCounts,
        });
      } else {
        message.error(
          payload?.error || "Erreur lors du chargement des resultats."
        );
      }
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router, silent: true });
      if (!handled) {
        message.error("Erreur lors du chargement des resultats.");
      }
    } finally {
      setResultsLoading(false);
    }
  };

  const handleDownloadResults = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    setExportLoading(true);
    try {
      const res = await authFetch(`${urlFetch}/quizzs/${cardId}/results/export`, {
        credentials: "include",
      });
      if (!res.ok) {
        let payload = null;
        try {
          payload = await res.json();
        } catch (_) {}
        throw new Error(payload?.error || "Erreur lors du telechargement.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quizz_${num}_${repertoire}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const handled = handleAuthError(error, { dispatch, router, silent: true });
      if (!handled) {
        message.error(error.message || "Erreur lors du telechargement.");
      }
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    if (!cardId || !quizz?.length) return;
    handleReloadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, quizz?.length]);

  console.log("quizz : ",quizz)

  return (
    <div className="relative w-full">
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
      <div className="relative z-20">
        {contextHolder}

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
              zIndex: 30,
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
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <Button
              type="primary"
              onClick={handleReloadResults}
              loading={resultsLoading}
              style={{ backgroundColor: "#1677ff", borderColor: "#1677ff", color: "#fff" }}
            >
              Reload les resultats
            </Button>
            <Button
              type="default"
              onClick={handleDownloadResults}
              loading={exportLoading}
            >
              Fichier resultat
            </Button>
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
            const imageName = (q.image || "").trim();
            const hasImage = !!imageName;
            const questionNodes = renderInlineKatex(q.question);
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
                    backgroundColor:"rgba(200,200,200,0.5)"
                  }}
                >
                  {hasImage && (
                    <div style={{ position: "relative", marginBottom: 0 }}>
                      <div
                        style={{
                          display: "inline-block",
                          borderRadius: 8,
                          overflow: "hidden",
                          boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                        }}
                      >
                        <Image
                          src={racine + imageName}
                          alt=""
                          width="400"
                          height="400"
                          style={{
                            display: "block",
                            margin: 0,
                            transition: "transform 200ms ease",
                            transform:
                              hovered === q.id ? "scale(1.04)" : "scale(1)",
                          }}
                          onMouseEnter={() => setHovered(q.id)}
                          onMouseLeave={() => setHovered(null)}
                        />
                      </div>
                    </div>
                  )}

                  <p
                    style={{
                      marginBottom: 10,
                      fontWeight: "bold",
                      color:
                        Number.isInteger(q.correct) &&
                        answers[q.id] !== undefined
                          ? answers[q.id] === q.correct
                            ? "#52c41a"
                            : "#ff4d4f"
                          : undefined,
                    }}
                  >
                    {questionNodes}
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
                      const showFeedback = Number.isInteger(q.correct);
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
                      const optionNodes = renderInlineKatex(opt);
                      return (
                        <div
                          key={opt}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: `1px solid ${borderColor}`,
                            backgroundColor: bg,
                          }}
                        >
                          <Radio value={i} style={{ color: textColor }}>
                            {optionNodes}
                          </Radio>
                        </div>
                      );
                    })}
                  </Radio.Group>
                </Card>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <p style={{ margin: 0, textAlign: "center" }}>
                    Note : {correctForCurrent}/{totalSubmissions} —{" "}
                    {percentCorrect}% de reponses correctes sur {totalSubmissions} recues
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      justifyContent: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        background: pieBackground,
                        border: "1px solid #d9d9d9",
                        position: "relative",
                      }}
                      aria-label="Diagramme des reponses"
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 24,
                          borderRadius: "50%",
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          color: "#595959",
                        }}
                      >
                        {percentCorrect}%
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#595959" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 12,
                            height: 12,
                            borderRadius: 3,
                            background: "#52c41a",
                          }}
                        />
                        {correctForCurrent} reponses correctes
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 12,
                            height: 12,
                            borderRadius: 3,
                            background: "#ff4d4f",
                          }}
                        />
                        {wrongForCurrent} reponses incorrectes
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Carousel>
        </div>
      </div>
    </div>
  );
}
