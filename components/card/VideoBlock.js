import { useMemo, useRef, useState, useEffect } from "react";
import { Button, Carousel } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import Image from "next/image";
import { buildCardBaseUrl } from "../../utils/gcsPaths";

function isFalsyString(v) {
  if (typeof v !== "string") return !v;
  const s = v.trim().toLowerCase();
  return (
    s === "" || s === "false" || s === "0" || s === "null" || s === "undefined"
  );
}
 
function ensureParam(url, key, value) {
  try {
    const u = new URL(
      url,
      typeof window !== "undefined"
        ? window.location.origin
        : "https://example.com"
    );
    if (!u.searchParams.has(key)) u.searchParams.set(key, value);
    return u.toString();
  } catch {
    // Fallback for relative/invalid URLs
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}${encodeURIComponent(key)}=${encodeURIComponent(
      value
    )}`;
  }
}

function processEmbedUrl(url) {
  if (!url) return url;
  const lower = String(url).toLowerCase();
  if (
    lower.includes("youtube.com/embed/") ||
    lower.includes("youtube-nocookie.com/embed/")
  ) {
    return ensureParam(url, "enablejsapi", "1");
  }
  // Dailymotion may require api param; attempt to enable
  if (lower.includes("dailymotion.com/embed/")) {
    return ensureParam(url, "api", "postMessage");
  }
  return url;
}

export default function Video({
  video,
  ratio = "16:9",
  className,
  maxWidth = "800px",
  title = "Video",
  num,
  repertoire,
  classeDirectoryname,
  bg,
  isExpanded,
}) {
  const slides = useMemo(() => {
    if (!Array.isArray(video)) return [];
    return video
      .map((entry) => {
        if (typeof entry === "string") {
          const href = entry.trim();
          if (isFalsyString(href)) return null;
          return { href: processEmbedUrl(href) };
        }
        if (entry && typeof entry === "object") {
          const rawHref = entry.href || entry.url || "";
          if (isFalsyString(String(rawHref))) return null;
          return { ...entry, href: processEmbedUrl(rawHref) };
        }
        return null;
      })
      .filter(Boolean);
  }, [video]);
  // Aucun URL exploitable => hauteur nulle
  if (!slides.length) {
    return (
      <div
        className={className}
        style={{ height: 0, padding: 0, margin: 0, overflow: "hidden" }}
        aria-hidden
      />
    );
  }

  const [w, h] = (ratio || "16:9").split(":").map(Number);
  const paddingTop =
    Number.isFinite(w) && Number.isFinite(h) && h > 0 ? (h / w) * 100 : 56.25;

  // Carrousel pour plusieurs vidéos + barre de progression
  const carouselRef = useRef(null);
  const iframeRefs = useRef([]);
  const [current, setCurrent] = useState(0);

  const DOT = 10;
  const GAP = 20;
  const trackWidth = slides.length * DOT + (slides.length - 1) * GAP;

  const handlePrev = () => {
    setCurrent((c) => Math.max(0, c - 1));
    carouselRef.current?.prev();
  };
  const handleNext = () => {
    setCurrent((c) => Math.min(slides.length - 1, c + 1));
    carouselRef.current?.next();
  };

  const [loaded, setLoaded] = useState([]);

  useEffect(() => {
    // reset loaded flags when url list changes
    setLoaded(Array(slides.length).fill(false));
  }, [slides]);

  const toBlurFile = (filename) => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };

  const bgRoot = buildCardBaseUrl({ classeDirectoryname, repertoire, num });
  const bgPath = bg || "";
  const blurBgPath = bg ? toBlurFile(bg) : "";
  const showBackground = Boolean(isExpanded && bgRoot && bgPath);

  const pauseAt = (index) => {
    const slide = slides[index];
    const iframe = iframeRefs.current[index];

    const url = slide?.href;

    if (!iframe || !iframe.contentWindow || !url) return;
    const lower = url.toLowerCase();
    try {
      if (
        lower.includes("youtube.com") ||
        lower.includes("youtube-nocookie.com")
      ) {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*"
        );
      } else if (lower.includes("vimeo.com")) {
        iframe.contentWindow.postMessage({ method: "pause" }, "*");
      } else if (lower.includes("dailymotion.com")) {
        iframe.contentWindow.postMessage({ command: "pause" }, "*");
      }
    } catch {}
  };

  return (
    <div className="relative w-full">
      {showBackground && (
        <>
          <div className="absolute inset-0 z-0">
            <Image
              src={`${bgRoot}${bgPath}`}
              alt=""
              fill
              placeholder="blur"
              blurDataURL={`${bgRoot}${blurBgPath}`}
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
      <div
        className={`vb-wrap ${className || ""} relative z-20 p-4`}
        style={{ width: "100%", maxWidth, margin: "0 auto" }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 8,
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
              top: 14,
              marginRight: 20,
              zIndex: 2,
              background: "#fff",
              transform: "translateY(-50%)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            aria-label="Précédent"
          >
            <ChevronLeft size={18} />
          </Button>
        )}

        <div style={{ position: "relative", width: trackWidth, height: 12 }}>
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
            {slides.map((_, idx) => {
              const isCurrent = idx === current;
              const bg = isCurrent ? "#595959" : "#d9d9d9";
              return (
                <div
                  key={idx}
                  role="button"
                  onClick={() => {
                    setCurrent(idx);
                    carouselRef.current?.goTo(idx);
                  }}
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: "50%",
                    backgroundColor: bg,
                    border: "1px solid #bfbfbf",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                  aria-label={`Aller à la vidéo ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        {current < slides.length - 1 && (
          <Button
            type="default"
            shape="circle"
            onClick={handleNext}
            style={{
              position: "relative",
              top: 14,
              marginLeft: 20,
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

        <Carousel
          ref={carouselRef}
          dots
          swipe
          draggable
          infinite={false}
          beforeChange={(from, to) => {
            pauseAt(from);
            setCurrent(to);
          }}
          afterChange={(i) => setCurrent(i)}
          adaptiveHeight
        >
          {slides.map((slide, idx) => {
            const label = slide.txt || slide.label;
            return (
              <div
                key={idx}
                className="vb-slide"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  padding: 0,
                  margin: 0,
                }}
              >
                {label ? <p className="text-center mb-2">{label}</p> : null}
                <div
                  className="vb-inner"
                  style={{
                    position: "relative",
                    width: "100%",
                    paddingTop: `${paddingTop}%`,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  {!loaded[idx] && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.85)",
                        zIndex: 2,
                      }}
                    >
                      <ClimbingBoxLoader color="#6C6C6C" size={11} />
                    </div>
                  )}
                  <iframe
                    ref={(el) => (iframeRefs.current[idx] = el)}
                    src={slide.href}
                    title={`${title} ${idx + 1}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    onLoad={() => {
                      setLoaded((prev) => {
                        const next = prev.slice();
                        next[idx] = true;
                        return next;
                      });
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      border: 0,
                    }}
                  
                  />
                </div>
              </div>
            );
          })}
        </Carousel>
        <style jsx>{`
          @media (max-width: 640px) {
            .vb-wrap {
              max-width: 100% !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .vb-slide {
              justify-content: flex-start !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .vb-inner {
              width: 100% !important;
            }
            :global(.ant-carousel .slick-list) {
              margin: 0 !important;
              padding: 0 !important;
            }
            :global(.ant-carousel .slick-track) {
              margin: 0 !important;
            }
            :global(.ant-carousel .slick-slide) {
              padding: 0 !important;
            }
            :global(.ant-carousel .slick-slide > div) {
              padding: 0 !important;
              margin: 0 !important;
            }
            :global(.ant-carousel .slick-slide > div > div) {
              padding: 0 !important;
              margin: 0 !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
