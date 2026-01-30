import { useMemo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import { Button, Carousel, Input, Popover, Select, message } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setCardsMaths } from "../../../reducers/cardsMathsSlice";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import Tooltip from "./TooltipClickClose";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

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
  if (lower.includes("dailymotion.com/embed/")) {
    return ensureParam(url, "api", "postMessage");
  }
  return url;
}

function toYoutubeEmbed(raw) {
  const value = (raw || "").trim();
  if (!value) return "";
  try {
    const u = new URL(
      value,
      value.startsWith("http") ? undefined : "https://example.com"
    );
    const host = (u.hostname || "").replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = (u.pathname || "").replace(/^\/+/, "").split("/")[0];
      if (!id) return value;
      const search = u.searchParams.toString();
      return `https://www.youtube.com/embed/${id}${search ? `?${search}` : ""}`;
    }
    if (host.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        if (!id) return value;
        const params = new URLSearchParams(u.searchParams);
        params.delete("v");
        const suffix = params.toString();
        return `https://www.youtube.com/embed/${id}${suffix ? `?${suffix}` : ""}`;
      }
    }
  } catch (_) {
    return value;
  }
  return value;
}

const sanitizeVideoList = (value) =>
  Array.isArray(value)
    ? value.map((entry) => ({
        txt: typeof entry?.txt === "string" ? entry.txt : entry?.label || "",
        href: typeof entry?.href === "string" ? entry.href : entry?.url || "",
      }))
    : [];

const resolveInsertIndex = (list, position) => {
  const length = Array.isArray(list) ? list.length : 0;
  if (position === "start") return 0;
  if (position === "end" || typeof position === "undefined" || position === null) {
    return length;
  }
  const numeric = Number(position);
  if (!Number.isNaN(numeric)) {
    return Math.max(0, Math.min(length, numeric + 1));
  }
  return length;
};

export default function Video({
  video,
  ratio = "16:9",
  className,
  maxWidth = "800px",
  title = "Video",
  _id,
  id,
  num,
  repertoire,
  bg,
  expanded,
}) {
  const dispatch = useDispatch();
  const cardsData = useSelector((state) => state.cardsMaths.data);
  const cardId = _id || id;

  const [videos, setVideos] = useState(sanitizeVideoList(video));
  const [current, setCurrent] = useState(0);
  const [insertPosition, setInsertPosition] = useState("end");
  const [actionKey, setActionKey] = useState("");
  const [editField, setEditField] = useState({ index: null, field: null, value: "" });
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);
  const [loaded, setLoaded] = useState([]);
  const fallbackTimers = useRef([]);
  const pendingSlideRef = useRef(null);

  useEffect(() => {
    setVideos(sanitizeVideoList(video));
  }, [video]);

  useEffect(() => {
    if (current >= videos.length && videos.length) {
      const nextIndex = Math.max(0, videos.length - 1);
      setCurrent(nextIndex);
      carouselRef.current?.goTo(nextIndex);
    }
  }, [videos.length, current]);

  // After the list updates (e.g. post-creation), reposition carousel to the intended slide.
  useEffect(() => {
    if (pendingSlideRef.current === null) return;
    if (!videos.length) {
      pendingSlideRef.current = null;
      return;
    }
    const targetIndex = Math.min(
      Math.max(0, pendingSlideRef.current),
      videos.length - 1
    );
    pendingSlideRef.current = null;
    setCurrent(targetIndex);
    carouselRef.current?.goTo(targetIndex);
  }, [videos.length]);

  const slides = useMemo(
    () =>
      videos.map((entry) => {
        const href =
          typeof entry?.href === "string"
            ? toYoutubeEmbed(entry.href)
            : "";
        return {
          ...entry,
          processedHref: href ? processEmbedUrl(href) : "",
        };
      }),
    [videos]
  );

  useEffect(() => {
    setLoaded(slides.map((s) => !s.processedHref));
  }, [slides]);

  useEffect(() => {
    fallbackTimers.current.forEach((t) => clearTimeout(t));
    fallbackTimers.current = [];
    slides.forEach((slide, idx) => {
      if (!slide.processedHref) return;
      const timer = setTimeout(() => {
        setLoaded((prev) => {
          const next = prev.slice();
          next[idx] = true;
          return next;
        });
      }, 6000);
      fallbackTimers.current.push(timer);
    });
    return () => {
      fallbackTimers.current.forEach((t) => clearTimeout(t));
      fallbackTimers.current = [];
    };
  }, [slides]);

  const syncCardsStore = (updatedCard, fallbackVideos) => {
    if (!cardsData || !Array.isArray(cardsData.result)) return;
    const targetId = updatedCard?._id || updatedCard?.id || cardId;
    const targetNum = typeof updatedCard?.num !== "undefined" ? updatedCard.num : num;
    const targetRepertoire = updatedCard?.repertoire || repertoire;
    const patch = updatedCard || { video: fallbackVideos };
    const nextResult = cardsData.result.map((card) => {
      const matchById = targetId && (card._id === targetId || card.id === targetId);
      const matchByComposite =
        !matchById &&
        targetId &&
        typeof targetNum !== "undefined" &&
        typeof card.num !== "undefined" &&
        card.num === targetNum &&
        targetRepertoire &&
        card.repertoire === targetRepertoire;
      return matchById || matchByComposite ? { ...card, ...patch } : card;
    });
    dispatch(setCardsMaths({ ...cardsData, result: nextResult }));
  };

  const [w, h] = (ratio || "16:9").split(":").map(Number);
  const paddingTop =
    Number.isFinite(w) && Number.isFinite(h) && h > 0 ? (h / w) * 100 : 56.25;
  const toBlurFile = (filename = "") => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };
  const bgRoot = `https://storage.googleapis.com/${
    process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"
  }/`;
  const bgPath =
    bg && repertoire ? `${repertoire}/tag${num}/${bg}` : bg || "";
  const blurBgPath =
    bg && repertoire ? `${repertoire}/tag${num}/${toBlurFile(bg)}` : "";
  const isExpanded = expanded !== false;
  const showBackground = Boolean(isExpanded && bgPath);

  const carouselRef = useRef(null);
  const iframeRefs = useRef([]);

  const DOT = 10;
  const GAP = 20;
  const trackWidth = slides.length
    ? slides.length * DOT + Math.max(0, slides.length - 1) * GAP
    : DOT;

  const handlePrev = () => {
    setCurrent((c) => Math.max(0, c - 1));
    carouselRef.current?.prev();
  };
  const handleNext = () => {
    setCurrent((c) => Math.min(slides.length - 1, c + 1));
    carouselRef.current?.next();
  };

  const pauseAt = (index) => {
    const iframe = iframeRefs.current[index];
    const url = slides[index]?.processedHref;

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

  const isAction = (key) => actionKey === key;

  const insertionOptions = useMemo(() => {
    const options = [{ value: "start", label: "Debut (avant la premiere)" }];
    slides.forEach((_, idx) => {
      options.push({ value: idx, label: `Apres la video ${idx + 1}` });
    });
    options.push({ value: "end", label: "Fin (apres la derniere)" });
    return options;
  }, [slides]);

  const handleAddVideo = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    setActionKey("add");
    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ position: insertPosition }),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {}
      if (!response.ok) {
        const errMsg =
          response.status === 401 || response.status === 403
            ? "Session expirée, veuillez vous reconnecter."
            : payload?.error || "Impossible d'ajouter la video.";
        message.error(errMsg);
        return;
      }
      const updatedCard = payload?.result;
      const nextVideos = sanitizeVideoList(updatedCard?.video || [...videos]);
      const insertedIndex = resolveInsertIndex(nextVideos, insertPosition);
      const nextIndex = Math.max(0, Math.min(nextVideos.length - 1, insertedIndex));
      pendingSlideRef.current = nextIndex;
      setVideos(nextVideos);
      syncCardsStore(updatedCard, nextVideos);
      setCurrent(nextIndex);
      carouselRef.current?.goTo(nextIndex);
      setInsertPosition("end");
      setAddPopoverOpen(false);
      message.success("Video ajoutee.");
    } catch (error) {
      console.error("Erreur ajout video", error);
      message.error(error.message || "Erreur lors de l'ajout.");
    } finally {
      setActionKey("");
    }
  };

  const handleDeleteVideo = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    if (!videos.length) {
      return;
    }
    const deleteIndex = current;
    const key = `delete-${deleteIndex}`;
    setActionKey(key);
    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/video`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ index: deleteIndex }),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {}
      if (!response.ok) {
        const errMsg =
          response.status === 401 || response.status === 403
            ? "Session expirée, veuillez vous reconnecter."
            : payload?.error || "Impossible de supprimer la video.";
        message.error(errMsg);
        return;
      }
      const updatedCard = payload?.result;
      const nextVideos = sanitizeVideoList(updatedCard?.video || []);
      setVideos(nextVideos);
      syncCardsStore(updatedCard, nextVideos);
      const nextIndex = Math.max(0, deleteIndex - 1);
      setCurrent(nextIndex);
      carouselRef.current?.goTo(nextIndex);
      setDeletePopoverOpen(false);
      message.success("Video supprimee.");
    } catch (error) {
      console.error("Erreur suppression video", error);
      message.error(error.message || "Erreur lors de la suppression.");
    } finally {
      setActionKey("");
    }
  };

  const handleSaveField = async (index, field) => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    const key = `save-${field}-${index}`;
    setActionKey(key);
    const value =
      field === "href" ? toYoutubeEmbed(editField.value) : editField.value;
    const payload = { index, [field]: value ?? "" };
    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/video`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (!response.ok) {
        const errMsg =
          response.status === 401 || response.status === 403
            ? "Session expirée, veuillez vous reconnecter."
            : data?.error || "Impossible de mettre a jour la video.";
        message.error(errMsg);
        return;
      }
      const updatedCard = data?.result;
      const nextVideos = sanitizeVideoList(updatedCard?.video || videos);
      setVideos(nextVideos);
      syncCardsStore(updatedCard, nextVideos);
      setEditField({ index: null, field: null, value: "" });
      message.success("Video mise a jour.");
    } catch (error) {
      console.error("Erreur edition video", error);
      message.error(error.message || "Erreur lors de la mise a jour.");
    } finally {
      setActionKey("");
    }
  };

  const getFieldValue = (idx, field) =>
    field === "txt" ? slides[idx]?.txt || "" : slides[idx]?.href || "";

  const fieldPopover = (idx, field, label, placeholder) => {
    const isOpen = editField.index === idx && editField.field === field;
    const icon =
      field === "href" ? <VideoCameraOutlined /> : <EditOutlined />;
    return (
      <Popover
        trigger="click"
        open={isOpen}
        onOpenChange={(visible) => {
          if (visible) {
            setEditField({ index: idx, field, value: getFieldValue(idx, field) });
          } else if (isOpen) {
            setEditField({ index: null, field: null, value: "" });
          }
        }}
        content={
          <div className="w-72 space-y-2">
            <Input.TextArea
              value={editField.value}
              onChange={(e) =>
                setEditField((prev) => ({ ...prev, value: e.target.value }))
              }
              placeholder={placeholder}
              maxLength={400}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
            <div className="flex justify-end gap-2">
              <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => setEditField({ index: null, field: null, value: "" })}
                >
                  Annuler
                </Button>
              </Tooltip>
              <Tooltip title="Enregistrer" mouseEnterDelay={0.3}>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={isAction(`save-${field}-${idx}`)}
                  onClick={() => handleSaveField(idx, field)}
                >
                  Valider
                </Button>
              </Tooltip>
            </div>
          </div>
        }
      >
        <Tooltip title={label} mouseEnterDelay={0.3}>
          <Button size="small" icon={icon} />
        </Tooltip>
      </Popover>
    );
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
        className={`vb-wrap ${className || ""} relative z-20`}
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
        {current > 0 && slides.length > 0 && (
          <Tooltip title="Vidéo précédente" mouseEnterDelay={0.3}>
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
              aria-label="Precedent"
            >
              <ChevronLeft size={18} />
            </Button>
          </Tooltip>
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
                  aria-label={`Aller a la video ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        {current < slides.length - 1 && slides.length > 0 && (
          <Tooltip title="Vidéo suivante" mouseEnterDelay={0.3}>
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
          </Tooltip>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <Popover
          trigger="click"
          open={addPopoverOpen}
          onOpenChange={setAddPopoverOpen}
          content={
            <div className="w-72 space-y-2">
              <p className="m-0 text-sm text-gray-700">
                Choisir l'emplacement de la nouvelle video.
              </p>
              <Select
                className="w-full"
                value={insertPosition}
                options={insertionOptions}
                onChange={setInsertPosition}
              />
              <div className="flex justify-end gap-2">
                <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setInsertPosition("end");
                      setAddPopoverOpen(false);
                    }}
                  >
                    Annuler
                  </Button>
                </Tooltip>
                <Tooltip title="Ajouter la vidéo" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    loading={isAction("add")}
                    onClick={handleAddVideo}
                  >
                    Valider
                  </Button>
                </Tooltip>
              </div>
            </div>
          }
        >
          <Tooltip title="Ajouter une nouvelle vidéo" mouseEnterDelay={0.3}>
            <Button type="primary" icon={<PlusOutlined />}>
              Ajouter une video
            </Button>
          </Tooltip>
        </Popover>

        <Popover
          trigger="click"
          content={
            <div className="w-64 space-y-2">
              <p className="m-0 text-sm text-gray-700">
                Supprimer completement la video {current + 1} ?
              </p>
              <div className="flex justify-end gap-2">
                <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setDeletePopoverOpen(false)}
                  >
                    Annuler
                  </Button>
                </Tooltip>
                <Tooltip title="Supprimer cette vidéo" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={isAction(`delete-${current}`)}
                    onClick={handleDeleteVideo}
                  >
                    Supprimer
                  </Button>
                </Tooltip>
              </div>
            </div>
          }
          open={deletePopoverOpen}
          onOpenChange={setDeletePopoverOpen}
        >
          <Tooltip title="Supprimer la vidéo courante" mouseEnterDelay={0.3}>
            <Button danger icon={<DeleteOutlined />} disabled={!slides.length}>
              Supprimer cette video
            </Button>
          </Tooltip>
        </Popover>
      </div>

      {slides.length ? (
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
          {slides.map((slide, idx) => (
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
              <div className="w-full max-w-5xl px-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="m-0 flex-1 text-center text-base font-medium">
                    {`Vidéo ${idx+1} : `}{slide.txt || "Intitule non renseigne"}
                  </p>
                  <div className="flex items-center gap-1">
                    {fieldPopover(
                      idx,
                      "txt",
                      "Modifier le titre",
                      "Intitule de la video"
                    )}
                    {fieldPopover(
                      idx,
                      "href",
                      "Modifier le lien",
                      "Lien YouTube (embed)"
                    )}
                  </div>
                </div>
                <div
                  className="vb-inner"
                  style={{
                    position: "relative",
                    width: "100%",
                    paddingTop: `${paddingTop}%`,
                    margin: 0,
                  }}
                >
                  {slide.processedHref ? (
                    <>
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
                        src={slide.processedHref}
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
                        onError={() => {
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
                    </>
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f5f5f5",
                        border: "1px dashed #d9d9d9",
                      }}
                    >
                      <p className="m-0 text-sm text-gray-600">
                        Lien video non renseigne.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Carousel>
      ) : (
        <div className="flex justify-center rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          Aucune video. Utilisez "Ajouter une video" pour creer la premiere entree.
        </div>
      )}
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
