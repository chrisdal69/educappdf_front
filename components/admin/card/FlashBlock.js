import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Carousel,
  Input,
  message,
  Modal,
  Popover,
  Select,
  Upload,
} from "antd";
import JSZip from "jszip";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { setCardsMaths } from "../../../reducers/cardsMathsSlice";
import Tooltip from "./TooltipClickClose";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png"];
const MAX_FLASH_IMAGE_BYTES = 4 * 1024 * 1024;
const PREVIEW_IMAGE_WIDTH = 250;
const FLASH_EXPORT_JSON_NAME = "flash.json";

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
      <Fragment key={`text-${i}`}>{part.value}</Fragment>
    ) : (
      <InlineMath key={`math-${i}`} math={part.value} />
    )
  );
  return { nodes, hasUnmatched };
};

const getZipBaseName = (value) => {
  const raw = typeof value === "string" ? value : "";
  const parts = raw.split(/[\\/]/);
  return parts[parts.length - 1] || "";
};

const buildExportFileName = (repertoire, num) => {
  const parts = ["flash"];
  if (repertoire) parts.push(repertoire);
  if (typeof num !== "undefined" && num !== null && `${num}` !== "") {
    parts.push(`tag${num}`);
  }
  const base = parts.join("_");
  const safe = base
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${safe || "flash"}.zip`;
};

const getFileNameFromDisposition = (value) => {
  if (!value || typeof value !== "string") return "";
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch && utfMatch[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch (error) {
      return utfMatch[1];
    }
  }
  const match = value.match(/filename="?([^";]+)"?/i);
  return match && match[1] ? match[1] : "";
};

const isAllowedImageName = (name) => {
  if (!name || typeof name !== "string") return false;
  const lower = name.toLowerCase();
  return ALLOWED_IMAGE_EXT.some((ext) => lower.endsWith(ext));
};

const validateImportedFlashPayload = (payload) => {
  const errors = [];
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.flash)
    ? payload.flash
    : null;

  if (!rawList) {
    return {
      ok: false,
      errors: ["Format attendu: tableau ou objet avec une cle 'flash'."],
      normalized: [],
    };
  }

  const normalized = [];
  rawList.forEach((item, idx) => {
    const label = `Flash ${idx + 1}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}: objet attendu.`);
      return;
    }

    const question =
      typeof item.question === "string" ? item.question.trim() : "";
    if (!question) {
      errors.push(`${label}: champ "question" manquant ou vide.`);
    }

    const reponse =
      typeof item.reponse === "string" ? item.reponse.trim() : "";
    if (!reponse) {
      errors.push(`${label}: champ "reponse" manquant ou vide.`);
    }

    const rawImQuestion =
      typeof item.imquestion === "string" ? item.imquestion.trim() : "";
    const rawImReponse =
      typeof item.imreponse === "string" ? item.imreponse.trim() : "";
    const imquestion = rawImQuestion ? getZipBaseName(rawImQuestion) : "";
    const imreponse = rawImReponse ? getZipBaseName(rawImReponse) : "";

    if (imquestion && !isAllowedImageName(imquestion)) {
      errors.push(`${label}: image question "${rawImQuestion}" invalide.`);
    }
    if (imreponse && !isAllowedImageName(imreponse)) {
      errors.push(`${label}: image reponse "${rawImReponse}" invalide.`);
    }

    normalized.push({
      id: "",
      question,
      imquestion: imquestion && isAllowedImageName(imquestion) ? imquestion : "",
      reponse,
      imreponse: imreponse && isAllowedImageName(imreponse) ? imreponse : "",
    });
  });

  return { ok: errors.length === 0, errors, normalized };
};

export default function FlashBlock({
  num,
  repertoire,
  flash,
  _id,
  id,
  bg,
  expanded,
}) {
  const dispatch = useDispatch();
  const cardsData = useSelector((state) => state.cardsMaths.data);
  const carouselRef = useRef(null);
  const pendingSlideRef = useRef(null);
  const flashListRef = useRef([]);
  const uploadingImageForRef = useRef("");
  const handleUploadImageRef = useRef(null);

  const [current, setCurrent] = useState(0);
  const [flashList, setFlashList] = useState(Array.isArray(flash) ? flash : []);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [deleteCardOpen, setDeleteCardOpen] = useState(false);
  const [insertPos, setInsertPos] = useState("end");
  const [editText, setEditText] = useState({ id: null, field: null, value: "" });
  const [actionKey, setActionKey] = useState("");
  const [uploadingImageFor, setUploadingImageFor] = useState("");

  const cardId = _id || id;

  const formulaLinks = (
    <>
      <Tooltip title="Exemples formules latex" mouseEnterDelay={0.3}>
        <a
          href="https://quickref.me/latex.html"
          target="_blank"
          rel="noreferrer"
          aria-label="Exemples formules latex"
          className="text-gray-500 hover:text-gray-700"
        >
          <LinkOutlined />
        </a>
      </Tooltip>
      <Tooltip title="Exemples formules katex" mouseEnterDelay={0.3}>
        <a
          href="https://katex.org/docs/supported"
          target="_blank"
          rel="noreferrer"
          aria-label="Exemples formules katex"
          className="text-gray-500 hover:text-gray-700"
        >
          <LinkOutlined />
        </a>
      </Tooltip>
    </>
  );

  const racine = useMemo(
    () =>
      `https://storage.googleapis.com/${
        process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"
      }/${repertoire}/tag${num}/imagesFlash/`,
    [repertoire, num]
  );
  const bgRoot = useMemo(
    () =>
      `https://storage.googleapis.com/${
        process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"
      }/${repertoire}/tag${num}/`,
    [repertoire, num]
  );
  const toBlurFile = (filename = "") => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };
  const blurBg = bg ? toBlurFile(bg) : "";
  const isExpanded = expanded !== false;
  const showBackground = Boolean(isExpanded && bg);

  useEffect(() => {
    setFlashList(Array.isArray(flash) ? flash : []);
  }, [flash]);

  useEffect(() => {
    flashListRef.current = flashList;
  }, [flashList]);

  useEffect(() => {
    uploadingImageForRef.current = uploadingImageFor;
  }, [uploadingImageFor]);

  useEffect(() => {
    if (pendingSlideRef.current === null) return;
    if (!flashList.length) {
      pendingSlideRef.current = null;
      return;
    }
    const targetIndex = Math.min(
      Math.max(0, pendingSlideRef.current),
      flashList.length - 1
    );
    pendingSlideRef.current = null;
    setCurrent(targetIndex);
    carouselRef.current?.goTo(targetIndex);
  }, [flashList.length]);

  const DOT = 10;
  const GAP = 20;
  const trackWidth =
    (flashList.length || 1) * DOT + Math.max(0, flashList.length - 1) * GAP;

  const reindexFlash = (list) =>
    (Array.isArray(list) ? list : []).map((item, idx) => {
      const trimmedId = typeof item?.id === "string" ? item.id.trim() : "";
      return {
        id: trimmedId || `f${idx + 1}`,
        question: typeof item?.question === "string" ? item.question : "",
        imquestion: typeof item?.imquestion === "string" ? item.imquestion : "",
        reponse: typeof item?.reponse === "string" ? item.reponse : "",
        imreponse: typeof item?.imreponse === "string" ? item.imreponse : "",
      };
    });

  const resolveInsertIndex = (list, pos) => {
    const length = Array.isArray(list) ? list.length : 0;
    if (pos === "start") return 0;
    if (pos === "end" || pos === undefined || pos === null) return length;
    const numeric = Number(pos);
    if (!Number.isNaN(numeric)) {
      return Math.max(0, Math.min(length, numeric + 1));
    }
    return length;
  };

  const getActionKey = (mode, idPart, extra) =>
    [mode, idPart, extra].filter(Boolean).join("-");

  const isAction = (key) => actionKey === key;

  const syncCardsStore = (updatedCard, fallbackFlash) => {
    if (!cardsData || !Array.isArray(cardsData.result)) return;
    const targetId = updatedCard?._id || updatedCard?.id || cardId;
    const targetNum =
      typeof updatedCard?.num !== "undefined" ? updatedCard.num : num;
    const targetRepertoire = updatedCard?.repertoire || repertoire;
    const patch = updatedCard || { flash: fallbackFlash };

    const nextResult = cardsData.result.map((card) => {
      const matchById =
        targetId && (card._id === targetId || card.id === targetId);
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

  const persistFlash = async (
    nextFlash,
    { successMessage } = {},
    loadingKey = ""
  ) => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return false;
    }

    const payload = {
      flash: reindexFlash(nextFlash ?? flashList),
    };

    setActionKey(loadingKey);
    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/flash`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expiree ou droits insuffisants. Merci de vous reconnecter."
        );
      }
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Impossible d'enregistrer les modifications."
        );
      }
      const updatedCard = data?.result;
      if (updatedCard?.flash) {
        setFlashList(Array.isArray(updatedCard.flash) ? updatedCard.flash : []);
      } else {
        setFlashList(payload.flash);
      }
      syncCardsStore(updatedCard, payload.flash);
      if (successMessage) {
        message.success(successMessage);
      }
      return true;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des flash cards :", error);
      message.error(error.message || "Erreur lors de la sauvegarde.");
      return false;
    } finally {
      setActionKey("");
    }
  };

  const handlePrev = () => {
    setCurrent((c) => Math.max(0, c - 1));
    carouselRef.current?.prev();
  };

  const handleNext = () => {
    setCurrent((c) => Math.min(flashList.length - 1, c + 1));
    carouselRef.current?.next();
  };

  const handleAddCard = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    const insertIndex = resolveInsertIndex(flashList, insertPos);
    const previousIds = new Set(
      flashList.map((item) => item?.id).filter(Boolean)
    );
    pendingSlideRef.current = insertIndex;
    setActionKey("add-flash");
    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/flash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ position: insertPos }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expiree ou droits insuffisants. Merci de vous reconnecter."
        );
      }
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (!response.ok) {
        throw new Error(data?.error || "Impossible d'ajouter la flash card.");
      }
      const updatedCard = data?.result;
      if (updatedCard?.flash) {
        const nextFlash = Array.isArray(updatedCard.flash) ? updatedCard.flash : [];
        setFlashList(nextFlash);
        syncCardsStore(updatedCard, nextFlash);

        let targetIndex = nextFlash.findIndex(
          (item) => item?.id && !previousIds.has(item.id)
        );
        if (targetIndex == -1) {
          targetIndex = insertIndex;
        }
        targetIndex = Math.min(
          Math.max(0, targetIndex),
          Math.max(0, nextFlash.length - 1)
        );
        pendingSlideRef.current = targetIndex;
        setTimeout(() => {
          setCurrent(targetIndex);
          carouselRef.current?.goTo(targetIndex);
        }, 0);
      }
      message.success("Flash card ajoutee.");
      setAddCardOpen(false);
      setInsertPos("end");
    } catch (error) {
      console.error("Erreur lors de l'ajout d'une flash card :", error);
      message.error(error.message || "Erreur lors de l'ajout.");
      pendingSlideRef.current = null;
    } finally {
      setActionKey("");
    }
  };

  const handleDeleteCard = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    if (!flashList.length) {
      setDeleteCardOpen(false);
      return;
    }
    const nextIndex = Math.max(0, current - 1);
    pendingSlideRef.current = nextIndex;
    setActionKey("delete-flash");
    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/flash`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          index: current,
          flashId: flashList[current]?.id,
        }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expiree ou droits insuffisants. Merci de vous reconnecter."
        );
      }
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (!response.ok) {
        throw new Error(data?.error || "Impossible de supprimer la flash card.");
      }
      const updatedCard = data?.result;
      if (updatedCard?.flash) {
        setFlashList(Array.isArray(updatedCard.flash) ? updatedCard.flash : []);
        syncCardsStore(updatedCard, updatedCard.flash);
      }
      message.success("Flash card supprimee.");
      setDeleteCardOpen(false);
    } catch (error) {
      console.error("Erreur lors de la suppression d'une flash card :", error);
      message.error(error.message || "Erreur lors de la suppression.");
      pendingSlideRef.current = null;
    } finally {
      setActionKey("");
    }
  };

  const handleSaveText = async (flashId, field, valueOverride) => {
    if (!flashId || !field) return;
    const fallbackValue =
      flashList.find((q) => q.id === flashId)?.[field] || "";
    const value = (valueOverride ?? editText.value ?? fallbackValue).trim();
    const next = flashList.map((q) =>
      q.id === flashId ? { ...q, [field]: value } : q
    );
    const ok = await persistFlash(
      next,
      {
        successMessage:
          field === "question"
            ? "Question mise a jour."
            : "Reponse mise a jour.",
      },
      getActionKey(field, flashId)
    );
    if (ok) {
      setEditText({ id: null, field: null, value: "" });
    }
  };

  const handleUploadImage = async (
    flashItem,
    field,
    file,
    { silent = false } = {}
  ) => {
    if (!flashItem?.id || !file || !field) return false;
    const ext = `.${(file.name || "").split(".").pop()?.toLowerCase() || ""}`;
    if (!ALLOWED_IMAGE_EXT.includes(ext)) {
      message.error("Image non autorisee (jpg ou png).");
      return false;
    }
    if (file.size && file.size > MAX_FLASH_IMAGE_BYTES) {
      message.error("Fichier trop volumineux (4 Mo max).");
      return false;
    }
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return false;
    }

    const uploadKey = getActionKey("upload", flashItem.id, field);
    setUploadingImageFor(uploadKey);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("flashId", flashItem.id);
    formData.append("field", field);
    formData.append("repertoire", repertoire || "");
    formData.append("num", `${num}`);

    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/flash/image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expiree ou droits insuffisants. Merci de vous reconnecter."
        );
      }
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (!response.ok) {
        throw new Error(data?.error || "Upload impossible.");
      }
      const updatedCard = data?.result;
      if (updatedCard?.flash) {
        setFlashList(Array.isArray(updatedCard.flash) ? updatedCard.flash : []);
        syncCardsStore(updatedCard, updatedCard.flash);
      }
      if (!silent) {
        message.success("Image importee.");
      }
      return true;
    } catch (error) {
      console.error("Erreur upload image flash", error);
      message.error(error.message || "Erreur lors de l'upload.");
      return false;
    } finally {
      setUploadingImageFor("");
    }
  };

  useEffect(() => {
    handleUploadImageRef.current = handleUploadImage;
  }, [handleUploadImage]);

  const handleDeleteImage = async (flashItem, field) => {
    if (!flashItem?.id || !field || !flashItem?.[field]) {
      return;
    }
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    const key = getActionKey("delete-image", flashItem.id, field);
    setActionKey(key);
    try {
      const response = await fetch(`${urlFetch}/cards/${cardId}/flash/image`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          flashId: flashItem.id,
          field,
          image: flashItem[field],
          repertoire: repertoire || "",
          num,
        }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expiree ou droits insuffisants. Merci de vous reconnecter."
        );
      }
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}
      if (!response.ok) {
        throw new Error(data?.error || "Suppression impossible.");
      }
      const updatedCard = data?.result;
      if (updatedCard?.flash) {
        setFlashList(Array.isArray(updatedCard.flash) ? updatedCard.flash : []);
        syncCardsStore(updatedCard, updatedCard.flash);
      }
      message.success("Image supprimee.");
    } catch (error) {
      console.error("Erreur suppression image flash", error);
      message.error(error.message || "Erreur lors de la suppression.");
    } finally {
      setActionKey("");
    }
  };

  const handlePasteImage = useCallback((flashItem, field, event) => {
    if (!flashItem?.id || !field) return;
    const uploadKey = ["upload", flashItem.id, field].filter(Boolean).join("-");
    if (uploadingImageForRef.current === uploadKey) return;
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type?.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();

    const blob = imageItem.getAsFile();
    if (!blob) return;

    const mime = blob.type || "image/png";
    const ext =
      mime === "image/png"
        ? ".png"
        : mime === "image/jpeg" || mime === "image/jpg"
        ? ".jpg"
        : "";

    if (!ALLOWED_IMAGE_EXT.includes(ext)) {
      message.error("Image non autorisee (jpg ou png).");
      return;
    }

    const name =
      blob.name && blob.name.toLowerCase().endsWith(ext)
        ? blob.name
        : `capture-${Date.now()}${ext}`;
    const file = new File([blob], name, { type: mime });
    if (handleUploadImageRef.current) {
      handleUploadImageRef.current(flashItem, field, file);
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async (flashItem, field) => {
    if (!flashItem?.id || !field) return;
    const uploadKey = ["upload", flashItem.id, field].filter(Boolean).join("-");
    if (uploadingImageForRef.current === uploadKey) return;
    if (!navigator?.clipboard?.read) {
      message.error(
        "Le collage direct n'est pas disponible sur ce navigateur."
      );
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      const imageItem = items.find((item) =>
        item.types.some((type) => type.startsWith("image/"))
      );
      if (!imageItem) {
        message.error("Aucune image dans le presse-papiers.");
        return;
      }
      const mime =
        imageItem.types.find((type) => type.startsWith("image/")) ||
        "image/png";
      const blob = await imageItem.getType(mime);
      if (!blob) return;
      const ext =
        mime === "image/png"
          ? ".png"
          : mime === "image/jpeg" || mime === "image/jpg"
          ? ".jpg"
          : "";
      if (!ALLOWED_IMAGE_EXT.includes(ext)) {
        message.error("Image non autorisee (jpg ou png).");
        return;
      }
      const name = `capture-${Date.now()}${ext}`;
      const file = new File([blob], name, { type: mime });
      if (handleUploadImageRef.current) {
        handleUploadImageRef.current(flashItem, field, file);
      }
    } catch (error) {
      console.error("Erreur collage image flash", error);
      message.error("Erreur lors du collage.");
    }
  }, []);

  useEffect(() => {
    const handlePaste = (event) => {
      const active = document.activeElement;
      const indexAttr = active?.getAttribute?.("data-upload-flash-index");
      const fieldAttr = active?.getAttribute?.("data-upload-flash-field");
      if (indexAttr === null || typeof indexAttr === "undefined") return;
      if (fieldAttr !== "imquestion" && fieldAttr !== "imreponse") return;
      const index = Number(indexAttr);
      if (Number.isNaN(index)) return;
      const item = flashListRef.current[index];
      if (!item) return;
      handlePasteImage(item, fieldAttr, event);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePasteImage]);

  const insertionOptions = useMemo(() => {
    const options = [{ value: "start", label: "Debut (avant la premiere)" }];
    flashList.forEach((_, idx) =>
      options.push({ value: idx, label: `Apres carte ${idx + 1}` })
    );
    options.push({ value: "end", label: "Fin (apres la derniere)" });
    return options;
  }, [flashList]);

  const handleExportFlash = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    const exportKey = "export-flash";
    setActionKey(exportKey);
    message.loading({
      content: "Export du flash en cours...",
      key: exportKey,
      duration: 0,
    });
    try {
      const response = await fetch(
        `${urlFetch}/cards/${cardId}/flash/export/zip`,
        {
          credentials: "include",
        }
      );
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expiree ou droits insuffisants. Merci de vous reconnecter."
        );
      }
      if (!response.ok) {
        throw new Error("Impossible d'exporter le flash.");
      }
      const zipBlob = await response.blob();
      const headerName = getFileNameFromDisposition(
        response.headers.get("Content-Disposition")
      );
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = headerName || buildExportFileName(repertoire, num);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      message.success({ content: "Export termine.", key: exportKey });
    } catch (error) {
      console.error("Erreur export flash", error);
      message.error({ content: "Erreur lors de l'export.", key: exportKey });
    } finally {
      setActionKey("");
    }
  };

  const handleImportZip = async (file) => {
    if (!file) return;
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    const fileName = file.name || "";
    if (!fileName.toLowerCase().endsWith(".zip")) {
      message.error("Merci de choisir un fichier .zip.");
      return;
    }

    setActionKey("import-zip");
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);
      const jsonEntry =
        entries.find(
          (entry) =>
            getZipBaseName(entry.name).toLowerCase() ===
            FLASH_EXPORT_JSON_NAME
        ) || entries.find((entry) => entry.name.toLowerCase().endsWith(".json"));

      if (!jsonEntry) {
        message.error("Fichier JSON introuvable dans le zip.");
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(await jsonEntry.async("text"));
      } catch (error) {
        message.error("Le fichier JSON est invalide.");
        return;
      }

      const validation = validateImportedFlashPayload(parsed);
      if (!validation.ok) {
        const maxErrors = 6;
        Modal.error({
          title: "Import impossible",
          content: (
            <div>
              <p className="m-0 text-sm text-gray-700">
                Le fichier JSON ne respecte pas le format attendu.
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                {validation.errors.slice(0, maxErrors).map((err, index) => (
                  <li key={`${index}-${err}`}>{err}</li>
                ))}
              </ul>
              {validation.errors.length > maxErrors && (
                <p className="mt-2 text-xs text-gray-500">
                  {validation.errors.length - maxErrors} autre(s) erreur(s).
                </p>
              )}
            </div>
          ),
        });
        return;
      }

      const normalized = validation.normalized;
      if (!normalized.length) {
        message.error("Aucune flash card a importer.");
        return;
      }

      const imageEntries = entries.filter((entry) =>
        isAllowedImageName(getZipBaseName(entry.name))
      );
      const imageBlobs = new Map();
      for (const entry of imageEntries) {
        const baseName = getZipBaseName(entry.name);
        if (!baseName || imageBlobs.has(baseName)) continue;
        const blob = await entry.async("blob");
        imageBlobs.set(baseName, blob);
      }

      const pendingImages = [];
      let missingImages = 0;
      const importedFlash = normalized.map((item, idx) => {
        const fields = ["imquestion", "imreponse"];
        fields.forEach((field) => {
          const imageName = item[field];
          if (imageName) {
            const blob = imageBlobs.get(imageName);
            if (blob) {
              const lower = imageName.toLowerCase();
              const type = lower.endsWith(".png") ? "image/png" : "image/jpeg";
              pendingImages.push({
                index: idx,
                field,
                file: new File([blob], imageName, {
                  type: blob.type || type,
                }),
              });
            } else {
              missingImages += 1;
            }
          }
        });
        return { ...item, imquestion: "", imreponse: "" };
      });

      const totalCards = importedFlash.length;
      Modal.confirm({
        title: "Importer un flash",
        content: `Ajouter ${totalCards} flash card${
          totalCards > 1 ? "s" : ""
        } au flash existant ?`,
        okText: "Importer",
        cancelText: "Annuler",
        onOk: async () => {
          const currentList = Array.isArray(flashListRef.current)
            ? flashListRef.current
            : [];
          const baseLength = currentList.length;
          const merged = [...currentList, ...importedFlash];
          const ok = await persistFlash(merged, {}, "import-flash");
          if (!ok) return;

          const referencedImages = pendingImages.length + missingImages;
          const baseSummaryParts = [
            `${totalCards} flash card${totalCards > 1 ? "s" : ""} ajoutee${
              totalCards > 1 ? "s" : ""
            }`,
          ];
          if (referencedImages > 0) {
            baseSummaryParts.push(
              `${referencedImages} image${
                referencedImages > 1 ? "s" : ""
              } referencee${referencedImages > 1 ? "s" : ""}`
            );
          }

          if (!pendingImages.length) {
            if (missingImages) {
              baseSummaryParts.push(
                `${missingImages} manquante${missingImages > 1 ? "s" : ""}`
              );
            }
            const summary = `Import termine: ${baseSummaryParts.join(", ")}.`;
            const severity = missingImages ? "warning" : "success";
            message[severity](summary);
            return;
          }

          const imagesKey = "import-images";
          message.loading({
            content: "Import des images...",
            key: imagesKey,
            duration: 0,
          });
          let uploaded = 0;
          for (const item of pendingImages) {
            const flashId = `f${baseLength + item.index + 1}`;
            const okImage = await handleUploadImage(
              { id: flashId },
              item.field,
              item.file,
              { silent: true }
            );
            if (okImage) uploaded += 1;
          }

          const failed = pendingImages.length - uploaded;
          const summaryParts = [...baseSummaryParts];
          summaryParts.push(
            `${uploaded}/${pendingImages.length} image${
              pendingImages.length > 1 ? "s" : ""
            } importee${pendingImages.length > 1 ? "s" : ""}`
          );
          if (missingImages) {
            summaryParts.push(
              `${missingImages} manquante${missingImages > 1 ? "s" : ""}`
            );
          }
          if (failed) {
            summaryParts.push(`${failed} en echec`);
          }
          const summary = `Import termine: ${summaryParts.join(", ")}.`;
          const severity = missingImages || failed ? "warning" : "success";
          message[severity]({ content: summary, key: imagesKey });
        },
      });
    } catch (error) {
      console.error("Erreur import flash", error);
      message.error("Erreur lors de la lecture du zip.");
    } finally {
      setActionKey("");
    }
  };

  const buildUploadProps = (flashItem, field) => ({
    accept: ALLOWED_IMAGE_EXT.join(","),
    showUploadList: false,
    beforeUpload: (file) => {
      handleUploadImage(flashItem, field, file);
      return false;
    },
  });

  const importUploadProps = {
    accept: ".zip",
    maxCount: 1,
    beforeUpload: (file) => {
      handleImportZip(file);
      return Upload.LIST_IGNORE;
    },
    showUploadList: false,
  };

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
      <div className="relative z-20 p-4">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              marginBottom: 4,
              marginTop: 14,
            }}
          >
            {current > 0 && flashList.length > 0 && (
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
                {flashList.map((q, idx) => {
                  const isCurrent = idx === current;
                  const size = isCurrent ? DOT + 4 : DOT;
                  const dotColor = isCurrent ? "#595959" : "#d9d9d9";
                  return (
                    <div
                      key={q.id || `flash-${idx}`}
                      role="button"
                      onClick={() => {
                        setCurrent(idx);
                        carouselRef.current?.goTo(idx);
                      }}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: "50%",
                        backgroundColor: dotColor,
                        border: "1px solid #bfbfbf",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                      aria-label={`Aller a la carte ${idx + 1}`}
                    />
                  );
                })}
              </div>
            </div>
            {current < flashList.length - 1 && flashList.length > 0 && (
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

          <div className="flex flex-wrap items-center justify-center gap-2 pb-3">
            <Popover
              placement="bottom"
              trigger="click"
              open={addCardOpen}
              onOpenChange={(visible) => setAddCardOpen(visible)}
              content={
                <div className="flex flex-col gap-2" style={{ maxWidth: 260 }}>
                  <p className="text-sm">
                    Choisir l'emplacement de la nouvelle flash card.
                  </p>
                  <Select
                    size="small"
                    value={insertPos}
                    options={insertionOptions}
                    onChange={(value) => setInsertPos(value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="small" onClick={() => setAddCardOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      loading={isAction("add-flash")}
                      onClick={handleAddCard}
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              }
            >
              <Tooltip title="Ajouter une flash card" mouseEnterDelay={0.3}>
                <Button type="dashed" icon={<PlusOutlined />}>
                  Ajouter une Flash Card
                </Button>
              </Tooltip>
            </Popover>

            <Popover
              placement="bottom"
              trigger="click"
              open={deleteCardOpen}
              onOpenChange={(visible) => setDeleteCardOpen(visible)}
              content={
                <div className="flex flex-col gap-2" style={{ maxWidth: 260 }}>
                  <p className="text-sm">Supprimer la flash card courante ?</p>
                  <div className="flex justify-end gap-2">
                    <Button size="small" onClick={() => setDeleteCardOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      size="small"
                      danger
                      type="primary"
                      icon={<DeleteOutlined />}
                      loading={isAction("delete-flash")}
                      onClick={handleDeleteCard}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              }
            >
              <Tooltip title="Supprimer la flash card" mouseEnterDelay={0.3}>
                <Button
                  danger
                  type="primary"
                  icon={<DeleteOutlined />}
                  disabled={!flashList.length}
                >
                  Supprimer cette Flash Card
                </Button>
              </Tooltip>
            </Popover>

            <Tooltip title="Exporter le flash en zip" mouseEnterDelay={0.3}>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportFlash}
                disabled={!flashList.length || !cardId}
              >
                Exporter le Flash
              </Button>
            </Tooltip>

            <Upload {...importUploadProps}>
              <Tooltip
                title="Importer un flash depuis un zip"
                mouseEnterDelay={0.3}
              >
                <Button icon={<UploadOutlined />} disabled={!cardId}>
                  Importer un Flash
                </Button>
              </Tooltip>
            </Upload>
          </div>

          {flashList.length === 0 ? (
            <Card className="w-full max-w-2xl text-center">
              <p className="text-sm text-gray-500">Aucune flash card.</p>
            </Card>
          ) : (
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
              {flashList.map((q, idx) => {
                const initialQuestionValue = q.question || "";
                const initialReponseValue = q.reponse || "";
                const isEditingQuestion =
                  editText.id === q.id && editText.field === "question";
                const isEditingReponse =
                  editText.id === q.id && editText.field === "reponse";
                const questionValue = isEditingQuestion
                  ? editText.value
                  : initialQuestionValue;
                const reponseValue = isEditingReponse
                  ? editText.value
                  : initialReponseValue;
                const isQuestionEmpty = !questionValue.trim();
                const isReponseEmpty = !reponseValue.trim();
                const hasQuestionChanged =
                  questionValue !== initialQuestionValue;
                const hasReponseChanged = reponseValue !== initialReponseValue;
                const { nodes: questionNodes, hasUnmatched: questionHasError } =
                  renderInlineKatex(questionValue);
                const { nodes: reponseNodes, hasUnmatched: reponseHasError } =
                  renderInlineKatex(reponseValue);
                const questionImageKey = getActionKey(
                  "upload",
                  q.id,
                  "imquestion"
                );
                const reponseImageKey = getActionKey(
                  "upload",
                  q.id,
                  "imreponse"
                );
                return (
                  <div
                    key={q.id || `flash-${idx}`}
                    style={{ display: "flex", justifyContent: "center" }}
                  >
                    <Card
                      style={{
                        margin: "4px auto",
                        width: "100%",
                        maxWidth: "100%",
                        textAlign: "center",
                        padding: "0px",
                        backgroundColor: "rgba(100,100,100,0.2)",
                      }}
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">
                              Question {idx+1}
                            </p>
                            <Popover
                              trigger="click"
                              open={isEditingQuestion}
                              onOpenChange={(visible) => {
                                if (visible) {
                                  setEditText({
                                    id: q.id,
                                    field: "question",
                                    value: initialQuestionValue,
                                  });
                                } else if (isEditingQuestion) {
                                  setEditText({
                                    id: null,
                                    field: null,
                                    value: "",
                                  });
                                }
                              }}
                              content={
                                <div className="w-80 space-y-2">
                                  <Input.TextArea
                                    autoSize={{ minRows: 3, maxRows: 6 }}
                                    className="!font-normal"
                                    value={questionValue}
                                    maxLength={500}
                                    placeholder="Texte et formules avec $...$"
                                    onChange={(e) =>
                                      setEditText({
                                        id: q.id,
                                        field: "question",
                                        value: e.target.value,
                                      })
                                    }
                                  />
                                  <p className="text-xs text-gray-500">
                                    Utiliser $...$ pour les formules inline.
                                  </p>
                                  <div className="flex w-full items-center justify-between">
                                    {formulaLinks}
                                    <Tooltip
                                      title="Annuler"
                                      mouseEnterDelay={0.3}
                                    >
                                      <Button
                                        size="small"
                                        icon={<CloseOutlined />}
                                        onClick={() =>
                                          setEditText({
                                            id: null,
                                            field: null,
                                            value: "",
                                          })
                                        }
                                      >
                                        Annuler
                                      </Button>
                                    </Tooltip>
                                    <Tooltip
                                      title="Valider la modification"
                                      mouseEnterDelay={0.3}
                                    >
                                      <Button
                                        size="small"
                                        type="primary"
                                        icon={<CheckOutlined />}
                                        loading={isAction(
                                          getActionKey("question", q.id)
                                        )}
                                        disabled={!hasQuestionChanged}
                                        onClick={() =>
                                          handleSaveText(
                                            q.id,
                                            "question",
                                            questionValue
                                          )
                                        }
                                      >
                                        Valider
                                      </Button>
                                    </Tooltip>
                                  </div>
                                </div>
                              }
                            >
                              <Tooltip
                                title={
                                  isQuestionEmpty
                                    ? "Saisir la question"
                                    : "Modifier la question"
                                }
                                mouseEnterDelay={0.3}
                              >
                                <Button size="small" icon={<EditOutlined />} />
                              </Tooltip>
                            </Popover>
                          </div>
                          <div
                            className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-800"
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {isQuestionEmpty ? (
                              <span className="text-gray-400">
                                Aucun intitule
                              </span>
                            ) : (
                              questionNodes
                            )}
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
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-700">
                                Image question
                              </p>
                              <div className="flex gap-2">
                                <Upload {...buildUploadProps(q, "imquestion")}>
                                  <Tooltip
                                    title="Importer une image"
                                    mouseEnterDelay={0.3}
                                  >
                                    <Button
                                      size="small"
                                      icon={<UploadOutlined />}
                                      loading={uploadingImageFor === questionImageKey}
                                      data-upload-flash-index={idx}
                                      data-upload-flash-field="imquestion"
                                    >
                                      Uploader
                                    </Button>
                                  </Tooltip>
                                </Upload>
                                <Tooltip
                                  title="Coller une image capturée (screenshot)"
                                  mouseEnterDelay={0.3}
                                >
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      handlePasteFromClipboard(q, "imquestion")
                                    }
                                    disabled={uploadingImageFor === questionImageKey}
                                    data-upload-flash-index={idx}
                                    data-upload-flash-field="imquestion"
                                  >
                                    Coller
                                  </Button>
                                </Tooltip>
                                <Tooltip
                                  title="Supprimer l'image"
                                  mouseEnterDelay={0.3}
                                >
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={isAction(
                                      getActionKey("delete-image", q.id, "imquestion")
                                    )}
                                    disabled={!q.imquestion}
                                    onClick={() => handleDeleteImage(q, "imquestion")}
                                  />
                                </Tooltip>
                              </div>
                            </div>
                            <div
                              className="flex items-center justify-center rounded border border-dashed border-gray-300 bg-white"
                              style={{
                                width: "90%",
                                margin: "auto",
                              }}
                            >
                              {q.imquestion ? (
                                <Image
                                  src={`${racine}${q.imquestion}`}
                                  alt=""
                                  width={PREVIEW_IMAGE_WIDTH}
                                  height={PREVIEW_IMAGE_WIDTH}
                                  style={{
                                    width: "100%",
                                    height: "auto",
                                  }}
                                />
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Aucune image
                                </span>
                              )}
                            </div>
                            {q.imquestion && (
                              <p className="text-xs text-gray-500 break-all">
                                {q.imquestion}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">
                              Reponse {idx+1}
                            </p>
                            <Popover
                              trigger="click"
                              open={isEditingReponse}
                              onOpenChange={(visible) => {
                                if (visible) {
                                  setEditText({
                                    id: q.id,
                                    field: "reponse",
                                    value: initialReponseValue,
                                  });
                                } else if (isEditingReponse) {
                                  setEditText({
                                    id: null,
                                    field: null,
                                    value: "",
                                  });
                                }
                              }}
                              content={
                                <div className="w-80 space-y-2">
                                  <Input.TextArea
                                    autoSize={{ minRows: 3, maxRows: 6 }}
                                    className="!font-normal"
                                    value={reponseValue}
                                    maxLength={500}
                                    placeholder="Texte et formules avec $...$"
                                    onChange={(e) =>
                                      setEditText({
                                        id: q.id,
                                        field: "reponse",
                                        value: e.target.value,
                                      })
                                    }
                                  />
                                  <p className="text-xs text-gray-500">
                                    Utiliser $...$ pour les formules inline.
                                  </p>
                                  <div className="flex w-full items-center justify-between">
                                    {formulaLinks}
                                    <Tooltip
                                      title="Annuler"
                                      mouseEnterDelay={0.3}
                                    >
                                      <Button
                                        size="small"
                                        icon={<CloseOutlined />}
                                        onClick={() =>
                                          setEditText({
                                            id: null,
                                            field: null,
                                            value: "",
                                          })
                                        }
                                      >
                                        Annuler
                                      </Button>
                                    </Tooltip>
                                    <Tooltip
                                      title="Valider la modification"
                                      mouseEnterDelay={0.3}
                                    >
                                      <Button
                                        size="small"
                                        type="primary"
                                        icon={<CheckOutlined />}
                                        loading={isAction(
                                          getActionKey("reponse", q.id)
                                        )}
                                        disabled={!hasReponseChanged}
                                        onClick={() =>
                                          handleSaveText(
                                            q.id,
                                            "reponse",
                                            reponseValue
                                          )
                                        }
                                      >
                                        Valider
                                      </Button>
                                    </Tooltip>
                                  </div>
                                </div>
                              }
                            >
                              <Tooltip
                                title={
                                  isReponseEmpty
                                    ? "Saisir la reponse"
                                    : "Modifier la reponse"
                                }
                                mouseEnterDelay={0.3}
                              >
                                <Button size="small" icon={<EditOutlined />} />
                              </Tooltip>
                            </Popover>
                          </div>
                          <div
                            className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-800"
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {isReponseEmpty ? (
                              <span className="text-gray-400">
                                Aucune reponse
                              </span>
                            ) : (
                              reponseNodes
                            )}
                            {reponseHasError && (
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
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-700">
                                Image reponse
                              </p>
                              <div className="flex gap-2">
                                <Upload {...buildUploadProps(q, "imreponse")}>
                                  <Tooltip
                                    title="Importer une image"
                                    mouseEnterDelay={0.3}
                                  >
                                    <Button
                                      size="small"
                                      icon={<UploadOutlined />}
                                      loading={uploadingImageFor === reponseImageKey}
                                      data-upload-flash-index={idx}
                                      data-upload-flash-field="imreponse"
                                    >
                                      Uploader
                                    </Button>
                                  </Tooltip>
                                </Upload>
                                <Tooltip
                                  title="Coller une image capturée (screenshot)"
                                  mouseEnterDelay={0.3}
                                >
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      handlePasteFromClipboard(q, "imreponse")
                                    }
                                    disabled={uploadingImageFor === reponseImageKey}
                                    data-upload-flash-index={idx}
                                    data-upload-flash-field="imreponse"
                                  >
                                    Coller
                                  </Button>
                                </Tooltip>
                                <Tooltip
                                  title="Supprimer l'image"
                                  mouseEnterDelay={0.3}
                                >
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={isAction(
                                      getActionKey("delete-image", q.id, "imreponse")
                                    )}
                                    disabled={!q.imreponse}
                                    onClick={() => handleDeleteImage(q, "imreponse")}
                                  />
                                </Tooltip>
                              </div>
                            </div>
                            <div
                              className="flex items-center justify-center rounded border border-dashed border-gray-300 bg-white"
                              style={{
                                width: "90%",
                                margin: "auto",
                              }}
                            >
                              {q.imreponse ? (
                                <Image
                                  src={`${racine}${q.imreponse}`}
                                  alt=""
                                  width={PREVIEW_IMAGE_WIDTH}
                                  height={PREVIEW_IMAGE_WIDTH}
                                  style={{
                                    width: "100%",
                                    height: "auto",
                                  }}
                                />
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Aucune image
                                </span>
                              )}
                            </div>
                            {q.imreponse && (
                              <p className="text-xs text-gray-500 break-all">
                                {q.imreponse}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </Carousel>
          )}
        </div>
      </div>
    </div>
  );
}
