import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  Radio,
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
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { setCardsMaths } from "../../../reducers/cardsMathsSlice";
import Tooltip from "./TooltipClickClose";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png"];
const MAX_QUIZZ_IMAGE_BYTES = 4 * 1024 * 1024;
const PREVIEW_IMAGE_WIDTH = 250;
const QUIZZ_EXPORT_JSON_NAME = "quizz.json";

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
  const parts = ["quizz"];
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
  return `${safe || "quizz"}.zip`;
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

const validateImportedQuizzPayload = (payload) => {
  const errors = [];
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.quizz)
    ? payload.quizz
    : null;

  if (!rawList) {
    return {
      ok: false,
      errors: ["Format attendu: tableau ou objet avec une cle 'quizz'."],
      normalized: [],
    };
  }

  const normalized = [];
  rawList.forEach((item, idx) => {
    const label = `Question ${idx + 1}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${label}: objet attendu.`);
      return;
    }

    const question =
      typeof item.question === "string" ? item.question.trim() : "";
    if (!question) {
      errors.push(`${label}: champ "question" manquant ou vide.`);
    }

    const rawOptions = item.options;
    if (!Array.isArray(rawOptions)) {
      errors.push(`${label}: champ "options" doit etre un tableau.`);
    }
    const options = Array.isArray(rawOptions)
      ? rawOptions.map((opt, optIdx) => {
          if (typeof opt !== "string") {
            errors.push(
              `${label}: option ${optIdx + 1} doit etre une chaine.`
            );
            return "";
          }
          const trimmed = opt.trim();
          if (!trimmed) {
            errors.push(`${label}: option ${optIdx + 1} est vide.`);
          }
          return trimmed;
        })
      : [];
    if (Array.isArray(rawOptions) && options.length === 0) {
      errors.push(`${label}: aucune option fournie.`);
    }

    let correct = null;
    if (
      Object.prototype.hasOwnProperty.call(item, "correct") &&
      item.correct !== null &&
      typeof item.correct !== "undefined"
    ) {
      if (!Number.isInteger(item.correct)) {
        errors.push(`${label}: "correct" doit etre un entier.`);
      } else if (!options.length) {
        errors.push(`${label}: "correct" defini sans options valides.`);
      } else if (item.correct < 0 || item.correct >= options.length) {
        errors.push(`${label}: "correct" hors limites.`);
      } else {
        correct = item.correct;
      }
    }

    const rawImage =
      typeof item.image === "string" ? item.image.trim() : "";
    const image = rawImage ? getZipBaseName(rawImage) : "";
    if (image && !isAllowedImageName(image)) {
      errors.push(`${label}: image "${rawImage}" invalide (jpg/png).`);
    }

    normalized.push({
      id: "",
      question,
      image: image && isAllowedImageName(image) ? image : "",
      options,
      correct,
    });
  });

  return { ok: errors.length === 0, errors, normalized };
};

export default function Quizz({
  num,
  repertoire,
  quizz,
  evalQuizz,
  resultatQuizz,
  _id,
  id,
  bg,
  expanded,
}) {
  const dispatch = useDispatch();
  const cardsData = useSelector((state) => state.cardsMaths.data);
  const carouselRef = useRef(null);
  const pendingSlideRef = useRef(null);

  const [current, setCurrent] = useState(0);
  const [quizzList, setQuizzList] = useState(Array.isArray(quizz) ? quizz : []);
  const [localEvalQuizz, setLocalEvalQuizz] = useState(evalQuizz || "non");
  const [localResultatQuizz, setLocalResultatQuizz] = useState(!!resultatQuizz);
  const quizzListRef = useRef(quizzList);

  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [deleteQuestionOpen, setDeleteQuestionOpen] = useState(false);
  const [questionInsertPos, setQuestionInsertPos] = useState("end");

  const [editQuestion, setEditQuestion] = useState({ id: null, value: "" });
  const [editOption, setEditOption] = useState({
    qid: null,
    index: null,
    value: "",
  });
  const [optionInsert, setOptionInsert] = useState({
    qid: null,
    position: "end",
    value: "",
  });
  const [actionKey, setActionKey] = useState("");
  const [uploadingImageFor, setUploadingImageFor] = useState("");
  const [imageRatios, setImageRatios] = useState({});

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
      }/${repertoire}/tag${num}/imagesQuizz/`,
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
    setQuizzList(Array.isArray(quizz) ? quizz : []);
  }, [quizz]);

  useEffect(() => {
    quizzListRef.current = quizzList;
  }, [quizzList]);

  useEffect(() => {
    setLocalEvalQuizz(evalQuizz || "non");
  }, [evalQuizz]);

  useEffect(() => {
    setLocalResultatQuizz(!!resultatQuizz);
  }, [resultatQuizz]);

  // Reposition the carousel after the slide list changes (e.g. after adding a question).
  useEffect(() => {
    if (pendingSlideRef.current === null) return;
    if (!quizzList.length) {
      pendingSlideRef.current = null;
      return;
    }
    const targetIndex = Math.min(
      Math.max(0, pendingSlideRef.current),
      quizzList.length - 1
    );
    pendingSlideRef.current = null;
    setCurrent(targetIndex);
    carouselRef.current?.goTo(targetIndex);
  }, [quizzList.length]);

  const DOT = 10;
  const GAP = 20;
  const trackWidth =
    (quizzList.length || 1) * DOT + Math.max(0, quizzList.length - 1) * GAP;

  const reindexQuizz = (list) =>
    (Array.isArray(list) ? list : []).map((q, idx) => ({
      ...q,
      id: `q${idx + 1}`,
      options: Array.isArray(q.options) ? q.options : [],
      image: q.image || "",
    }));

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

  const recordImageRatio = (questionId, image) => {
    if (!questionId || !image) return;
    const rawWidth = image.naturalWidth ?? image.width;
    const rawHeight = image.naturalHeight ?? image.height;
    const naturalWidth = Number(rawWidth);
    const naturalHeight = Number(rawHeight);
    if (!naturalWidth || !naturalHeight) return;
    const ratio = Number((naturalWidth / naturalHeight).toFixed(4));
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setImageRatios((prev) => {
      if (prev[questionId] === ratio) return prev;
      return { ...prev, [questionId]: ratio };
    });
  };

  const syncCardsStore = (updatedCard, fallbackQuizz) => {
    if (!cardsData || !Array.isArray(cardsData.result)) return;
    const targetId = updatedCard?._id || updatedCard?.id || cardId;
    const targetNum =
      typeof updatedCard?.num !== "undefined" ? updatedCard.num : num;
    const targetRepertoire = updatedCard?.repertoire || repertoire;
    const patch = updatedCard || {
      quizz: fallbackQuizz,
      evalQuizz: localEvalQuizz,
      resultatQuizz: localResultatQuizz,
    };

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

  const persistQuizz = async (
    nextQuizz,
    { evalValue, resultValue, successMessage } = {},
    loadingKey = ""
  ) => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return false;
    }

    const payload = {
      quizz: reindexQuizz(nextQuizz ?? quizzList),
      evalQuizz: evalValue ?? localEvalQuizz,
      resultatQuizz:
        typeof resultValue === "boolean" ? resultValue : localResultatQuizz,
    };

    setActionKey(loadingKey);
    try {
      const response = await fetch(`${urlFetch}/quizzs/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expirée ou droits insuffisants. Merci de vous reconnecter."
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
      if (updatedCard?.quizz) {
        setQuizzList(Array.isArray(updatedCard.quizz) ? updatedCard.quizz : []);
      } else {
        setQuizzList(payload.quizz);
      }
      if (updatedCard?.evalQuizz) {
        setLocalEvalQuizz(updatedCard.evalQuizz);
      } else if (evalValue) {
        setLocalEvalQuizz(evalValue);
      }
      if (typeof updatedCard?.resultatQuizz !== "undefined") {
        setLocalResultatQuizz(!!updatedCard.resultatQuizz);
      } else if (typeof resultValue === "boolean") {
        setLocalResultatQuizz(resultValue);
      }
      syncCardsStore(updatedCard, payload.quizz);
      if (successMessage) {
        message.success(successMessage);
      }
      return true;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du quizz :", error);
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
    setCurrent((c) => Math.min(quizzList.length - 1, c + 1));
    carouselRef.current?.next();
  };

  const handleAddQuestion = async () => {
    const insertIndex = resolveInsertIndex(quizzList, questionInsertPos);
    pendingSlideRef.current = insertIndex;
    const blank = {
      id: "",
      question: "",
      image: "",
      options: [],
      correct: null,
    };
    const next = [...quizzList];
    next.splice(insertIndex, 0, blank);
    const ok = await persistQuizz(
      next,
      { successMessage: "Question ajoutee." },
      "add-question"
    );
    if (ok) {
      setAddQuestionOpen(false);
      setQuestionInsertPos("end");
      setCurrent(insertIndex);
      carouselRef.current?.goTo(insertIndex);
    } else {
      pendingSlideRef.current = null;
    }
  };

  const handleDeleteQuestion = async () => {
    if (!quizzList.length) {
      setDeleteQuestionOpen(false);
      return;
    }
    const next = quizzList.filter((_, idx) => idx !== current);
    const ok = await persistQuizz(
      next,
      { successMessage: "Question supprimee." },
      "delete-question"
    );
    if (ok) {
      const nextIndex = Math.max(0, current - 1);
      setCurrent(nextIndex);
      carouselRef.current?.goTo(nextIndex);
      setDeleteQuestionOpen(false);
    }
  };

  const handleSaveQuestion = async (qid, valueOverride) => {
    const targetId = qid || editQuestion.id;
    if (!targetId) return;
    const fallbackQuestion =
      quizzList.find((q) => q.id === targetId)?.question || "";
    const value = (
      valueOverride ??
      editQuestion.value ??
      fallbackQuestion
    ).trim();
    const next = quizzList.map((q) =>
      q.id === targetId ? { ...q, question: value } : q
    );
    const ok = await persistQuizz(
      next,
      { successMessage: "Intitule mis a jour." },
      getActionKey("question", targetId)
    );
    if (ok) {
      setEditQuestion({ id: null, value: "" });
    }
  };

  const handleAddOption = async () => {
    if (!optionInsert.qid) return;
    const value = optionInsert.value || "";
    const next = quizzList.map((q) => {
      if (q.id !== optionInsert.qid) return q;
      const insertIndex = resolveInsertIndex(
        q.options || [],
        optionInsert.position
      );
      const options = Array.isArray(q.options) ? [...q.options] : [];
      const adjustedCorrect =
        Number.isInteger(q.correct) && q.correct >= insertIndex
          ? q.correct + 1
          : q.correct;
      options.splice(insertIndex, 0, value);
      return { ...q, options, correct: adjustedCorrect };
    });
    const ok = await persistQuizz(
      next,
      { successMessage: "Option ajoutee." },
      getActionKey("add-option", optionInsert.qid)
    );
    if (ok) {
      setOptionInsert({ qid: null, position: "end", value: "" });
    }
  };

  const handleEditOption = async () => {
    if (!editOption.qid || editOption.index === null) return;
    const value = editOption.value || "";
    const next = quizzList.map((q) => {
      if (q.id !== editOption.qid) return q;
      const options = Array.isArray(q.options) ? [...q.options] : [];
      options[editOption.index] = value;
      return { ...q, options };
    });
    const ok = await persistQuizz(
      next,
      { successMessage: "Option mise a jour." },
      getActionKey("edit-option", editOption.qid, editOption.index)
    );
    if (ok) {
      setEditOption({ qid: null, index: null, value: "" });
    }
  };

  const handleDeleteOption = async (qid, index) => {
    const next = quizzList.map((q) => {
      if (q.id !== qid) return q;
      const options = Array.isArray(q.options)
        ? q.options.filter((_, idx) => idx !== index)
        : [];
      let correct = q.correct;
      if (Number.isInteger(correct)) {
        if (correct === index) {
          correct = null;
        } else if (correct > index) {
          correct = correct - 1;
        }
      }
      return { ...q, options, correct };
    });
    await persistQuizz(
      next,
      { successMessage: "Option supprimee." },
      getActionKey("delete-option", qid, index)
    );
  };

  const handleSelectCorrect = async (qid, optionIndex) => {
    const next = quizzList.map((q) =>
      q.id === qid ? { ...q, correct: optionIndex } : q
    );
    await persistQuizz(
      next,
      { successMessage: "Reponse correcte mise a jour." },
      getActionKey("correct", qid, optionIndex)
    );
  };

  const handleUploadImage = async (question, file, { silent = false } = {}) => {
    if (!question?.id || !file) return;
    const ext = `.${(file.name || "").split(".").pop()?.toLowerCase() || ""}`;
    if (!ALLOWED_IMAGE_EXT.includes(ext)) {
      message.error("Image non autorisee (jpg ou png).");
      return false;
    }
    if (file.size && file.size > MAX_QUIZZ_IMAGE_BYTES) {
      message.error("Fichier trop volumineux (4 Mo max)");
      return false;
    }
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return false;
    }
    setUploadingImageFor(question.id);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("questionId", question.id);
    formData.append("repertoire", repertoire || "");
    formData.append("num", `${num}`);

    try {
      const response = await fetch(`${urlFetch}/quizzs/${cardId}/image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expirée ou droits insuffisants. Merci de vous reconnecter."
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
      if (updatedCard?.quizz) {
        setQuizzList(Array.isArray(updatedCard.quizz) ? updatedCard.quizz : []);
        syncCardsStore(updatedCard, updatedCard.quizz);
      }
      if (!silent) {
        message.success("Image importee.");
      }
      return true;
    } catch (error) {
      console.error("Erreur upload image quizz", error);
      message.error(error.message || "Erreur lors de l'upload.");
      return false;
    } finally {
      setUploadingImageFor("");
    }
  };

  const handleDeleteImage = async (question) => {
    if (!question?.id || !question?.image) {
      return;
    }
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    const key = getActionKey("delete-image", question.id);
    setActionKey(key);
    try {
      const response = await fetch(`${urlFetch}/quizzs/${cardId}/image`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionId: question.id,
          image: question.image,
          repertoire: repertoire || "",
          num,
        }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expirée ou droits insuffisants. Merci de vous reconnecter."
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
      if (updatedCard?.quizz) {
        setQuizzList(Array.isArray(updatedCard.quizz) ? updatedCard.quizz : []);
        syncCardsStore(updatedCard, updatedCard.quizz);
      }
      message.success("Image supprimee.");
    } catch (error) {
      console.error("Erreur suppression image quizz", error);
      message.error(error.message || "Erreur lors de la suppression.");
    } finally {
      setActionKey("");
    }
  };

  const handlePasteImage = (question, event) => {
    if (!question?.id || uploadingImageFor === question.id) return;
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
    handleUploadImage(question, file);
  };

  const handlePasteFromClipboard = async (question) => {
    if (!question?.id || uploadingImageFor === question.id) return;
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
      handleUploadImage(question, file);
    } catch (error) {
      console.error("Erreur collage image quizz", error);
      message.error("Erreur lors du collage.");
    }
  };

  useEffect(() => {
    const handlePaste = (event) => {
      const active = document.activeElement;
      const indexAttr = active?.getAttribute?.("data-upload-question-index");
      if (indexAttr === null || typeof indexAttr === "undefined") return;
      const index = Number(indexAttr);
      if (Number.isNaN(index)) return;
      const question = quizzList[index];
      if (!question) return;
      handlePasteImage(question, event);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [quizzList, handlePasteImage]);

  const questionInsertionOptions = useMemo(() => {
    const options = [{ value: "start", label: "Debut (avant la premiere)" }];
    quizzList.forEach((q, idx) =>
      options.push({ value: idx, label: `Apres question ${idx + 1}` })
    );
    options.push({ value: "end", label: "Fin (apres la derniere)" });
    return options;
  }, [quizzList]);

  const optionInsertionOptions = (q) => {
    const opts = [{ value: "start", label: "Debut (avant la premiere)" }];
    (q.options || []).forEach((_, idx) =>
      opts.push({ value: idx, label: `Apres option ${idx + 1}` })
    );
    opts.push({ value: "end", label: "Fin (apres la derniere)" });
    return opts;
  };

  const handleExportQuizz = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    const exportKey = "export-quizz";
    setActionKey(exportKey);
    message.loading({
      content: "Export du quizz en cours...",
      key: exportKey,
      duration: 0,
    });
    try {
      const response = await fetch(`${urlFetch}/quizzs/${cardId}/export/zip`, {
        credentials: "include",
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Session expiree ou droits insuffisants. Merci de vous reconnecter."
        );
      }
      if (!response.ok) {
        throw new Error("Impossible d'exporter le quizz.");
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
      console.error("Erreur export quizz", error);
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
            QUIZZ_EXPORT_JSON_NAME
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

      const validation = validateImportedQuizzPayload(parsed);
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
        message.error("Aucune question a importer.");
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
      const importedQuestions = normalized.map((q, idx) => {
        const imageName = q.image;
        if (imageName) {
          const blob = imageBlobs.get(imageName);
          if (blob) {
            const lower = imageName.toLowerCase();
            const type = lower.endsWith(".png") ? "image/png" : "image/jpeg";
            pendingImages.push({
              index: idx,
              file: new File([blob], imageName, {
                type: blob.type || type,
              }),
            });
          } else {
            missingImages += 1;
          }
        }
        return { ...q, image: "" };
      });

      const totalQuestions = importedQuestions.length;
      Modal.confirm({
        title: "Importer un quizz",
        content: `Ajouter ${totalQuestions} question${
          totalQuestions > 1 ? "s" : ""
        } au quizz existant ?`,
        okText: "Importer",
        cancelText: "Annuler",
        onOk: async () => {
          const currentList = Array.isArray(quizzListRef.current)
            ? quizzListRef.current
            : [];
          const baseLength = currentList.length;
          const merged = [...currentList, ...importedQuestions];
          const ok = await persistQuizz(merged, {}, "import-quizz");
          if (!ok) return;

          const totalQuestions = importedQuestions.length;
          const referencedImages = pendingImages.length + missingImages;
          const baseSummaryParts = [
            `${totalQuestions} question${
              totalQuestions > 1 ? "s" : ""
            } ajoutee${totalQuestions > 1 ? "s" : ""}`,
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
            const questionId = `q${baseLength + item.index + 1}`;
            const okImage = await handleUploadImage(
              { id: questionId },
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
      console.error("Erreur import quizz", error);
      message.error("Erreur lors de la lecture du zip.");
    } finally {
      setActionKey("");
    }
  };

  const buildUploadProps = (question) => ({
    accept: ALLOWED_IMAGE_EXT.join(","),
    maxCount: 1,
    beforeUpload: (file) => {
      handleUploadImage(question, file);
      return Upload.LIST_IGNORE;
    },
    showUploadList: false,
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
      {actionKey && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/60">
          <ClimbingBoxLoader color="#2563eb" size={12} />
        </div>
      )}

      <div className="relative z-20">
      {/* Barre de progression */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 12,
          marginTop: 12,
          gap: 5,
          padding: "1px 0px 0px 1px ",
          maxWidth: "100%",
        }}
      >
        {current > 0 && quizzList.length > 0 && (
          <Tooltip title="Question pr\u00e9c\u00e9dente" mouseEnterDelay={0.3}>
            <Button
              type="default"
              shape="circle"
              onClick={handlePrev}
              style={{
                position: "relative",
                top: "14px",
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

        <div
          style={{
            position: "relative",
            width: "80%",
            maxWidth: 500,
            height: 24,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 2,
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
              width: "100%",
            }}
          >
            {quizzList.map((q, idx) => {
              const isCurrent = idx === current;
              const size = DOT + 4;
              const bg = isCurrent ? "#595959" : "#1890ff";
              return (
                <div
                  key={q.id || idx}
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

        {current < quizzList.length - 1 && quizzList.length > 0 && (
          <Tooltip title="Question suivante" mouseEnterDelay={0.3}>
            <Button
              type="default"
              shape="circle"
              onClick={handleNext}
              style={{
                position: "relative",
                top: "14px",
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

      {/* Actions question */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Popover
          trigger="click"
          open={addQuestionOpen}
          onOpenChange={setAddQuestionOpen}
          content={
            <div className="w-72 space-y-2">
              <p className="m-0 text-sm text-gray-700">
                Choisir l'emplacement de la nouvelle question.
              </p>
              <Select
                className="w-full"
                value={questionInsertPos}
                options={questionInsertionOptions}
                onChange={setQuestionInsertPos}
              />
              <div className="flex justify-end gap-2">
                <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setAddQuestionOpen(false)}
                  >
                    Annuler
                  </Button>
                </Tooltip>
                <Tooltip title="Valider l'ajout" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    loading={isAction("add-question")}
                    onClick={handleAddQuestion}
                  >
                    Ajouter
                  </Button>
                </Tooltip>
              </div>
            </div>
          }
        >
          <Tooltip title="Ajouter une nouvelle question" mouseEnterDelay={0.3}>
            <Button type="primary" icon={<PlusOutlined />}>
              Ajouter une question
            </Button>
          </Tooltip>
        </Popover>

        <Popover
          trigger="click"
          open={deleteQuestionOpen}
          onOpenChange={setDeleteQuestionOpen}
          content={
            <div className="w-64 space-y-2">
              <p className="m-0 text-sm text-gray-700">
                Supprimer completement la question {current + 1} ?
              </p>
              <div className="flex justify-end gap-2">
                <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setDeleteQuestionOpen(false)}
                  >
                    Annuler
                  </Button>
                </Tooltip>
                <Tooltip title="Supprimer cette question" mouseEnterDelay={0.3}>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={isAction("delete-question")}
                    onClick={handleDeleteQuestion}
                  >
                    Supprimer
                  </Button>
                </Tooltip>
              </div>
            </div>
          }
        >
          <Tooltip title="Supprimer la question courante" mouseEnterDelay={0.3}>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!quizzList.length}
            >
              Supprimer la question
            </Button>
          </Tooltip>
        </Popover>

        <Tooltip title="Exporter le quizz en zip" mouseEnterDelay={0.3}>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportQuizz}
            disabled={!quizzList.length || !cardId}
          >
            Exporter le Quiz
          </Button>
        </Tooltip>

        <Upload {...importUploadProps}>
          <Tooltip title="Importer un quizz depuis un zip" mouseEnterDelay={0.3}>
            <Button icon={<UploadOutlined />} disabled={!cardId}>
              Importer un Quizz
            </Button>
          </Tooltip>
        </Upload>
      </div>

      {/* Carousel responsive */}
      <div className="w-full flex justify-center px-2 sm:px-4">
        <div style={{ width: "100%", maxWidth: 1200 }}>
          <Carousel
            ref={carouselRef}
            dots
            swipe
            draggable
            infinite={false}
            beforeChange={(_, to) => setCurrent(to)}
            afterChange={(i) => setCurrent(i)}
            adaptiveHeight
            className="w-full"
          >
            {quizzList.map((q, idx) => {
              const initialQuestionValue = q.question || "";
              const isEditingQuestion = editQuestion.id === q.id;
              const questionValue = isEditingQuestion
                ? editQuestion.value
                : initialQuestionValue;
              const isQuestionEmpty = !questionValue.trim();
              const hasQuestionChanged = questionValue !== initialQuestionValue;
              const disableQuestionSave =
                isQuestionEmpty || !hasQuestionChanged;
              const { nodes: questionNodes, hasUnmatched: questionHasError } =
                renderInlineKatex(questionValue);
              const ratio = imageRatios[q.id];
              const previewHeight = ratio
                ? Math.max(1, Math.round(PREVIEW_IMAGE_WIDTH / ratio))
                : PREVIEW_IMAGE_WIDTH;
              return (
                <div
                  key={q.id || idx}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  <Card
                    style={{
                      margin: "8px auto",
                      width: "100%",
                      maxWidth: "1100px",
                      minWidth: "280px",
                      padding: "8px",
                        backgroundColor: "rgba(100,100,100,0.2)",

                    }}
                    title={
                      <div className="flex w-full flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <label className="text-sm font-bold text-gray-700">
                            Question {idx + 1}  :
                          </label>
                          <Popover
                            trigger="click"
                            open={isEditingQuestion}
                            onOpenChange={(visible) => {
                              if (visible) {
                                setEditQuestion({
                                  id: q.id,
                                  value: initialQuestionValue,
                                });
                              } else if (isEditingQuestion) {
                                setEditQuestion({ id: null, value: "" });
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
                                    setEditQuestion({
                                      id: q.id,
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
                                        setEditQuestion({ id: null, value: "" })
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
                                      disabled={disableQuestionSave}
                                      onClick={() =>
                                        handleSaveQuestion(q.id, questionValue)
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
                          className="rounded border border-gray-200 bg-gray-100 px-2 py-1 text-sm text-gray-800"
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
                      </div>
                    }
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className=" space-y-2">
                          <div className=" flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">
                              Image
                            </p>
                            <div className="flex gap-2">
                              <Upload {...buildUploadProps(q)}>
                                <Tooltip
                                  title="Importer une image"
                                  mouseEnterDelay={0.3}
                                >
                                  <Button
                                    size="small"
                                    icon={<UploadOutlined />}
                                    loading={uploadingImageFor === q.id}
                                    data-upload-question-index={idx}
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
                                  onClick={() => handlePasteFromClipboard(q)}
                                  disabled={uploadingImageFor === q.id}
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
                                    getActionKey("delete-image", q.id)
                                  )}
                                  disabled={!q.image}
                                  onClick={() => handleDeleteImage(q)}
                                />
                              </Tooltip>
                            </div>
                          </div>
                          <div
                            className="flex items-center justify-center rounded border border-dashed border-gray-300 bg-white"
                            style={{
                              width: "90%",
                              //maxWidth: PREVIEW_IMAGE_WIDTH,
                              margin: "auto",
                            }}
                          >
                            {q.image ? (
                              <Image
                                src={`${racine}${q.image}`}
                                alt=""
                                width={PREVIEW_IMAGE_WIDTH}
                                height={previewHeight}
                                onLoadingComplete={(img) =>
                                  recordImageRatio(q.id, img)
                                }
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
                          {q.image && (
                            <p className="text-xs text-gray-500 break-all">
                              {q.image}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-700">
                            Options
                          </p>
                          <Popover
                            trigger="click"
                            open={optionInsert.qid === q.id}
                            onOpenChange={(visible) => {
                              if (visible) {
                                setOptionInsert({
                                  qid: q.id,
                                  position: "end",
                                  value: "",
                                });
                              } else if (optionInsert.qid === q.id) {
                                setOptionInsert({
                                  qid: null,
                                  position: "end",
                                  value: "",
                                });
                              }
                            }}
                            content={
                              <div className="w-72 space-y-2">
                                <Input
                                  placeholder="Nouvelle option"
                                  value={optionInsert.value}
                                  maxLength={300}
                                  onChange={(e) =>
                                    setOptionInsert((prev) => ({
                                      ...prev,
                                      value: e.target.value,
                                    }))
                                  }
                                />
                                <Select
                                  className="w-full"
                                  value={optionInsert.position}
                                  options={optionInsertionOptions(q)}
                                  onChange={(value) =>
                                    setOptionInsert((prev) => ({
                                      ...prev,
                                      position: value,
                                    }))
                                  }
                                />
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
                                        setOptionInsert({
                                          qid: null,
                                          position: "end",
                                          value: "",
                                        })
                                      }
                                    >
                                      Annuler
                                    </Button>
                                  </Tooltip>
                                  <Tooltip
                                    title="Ajouter l'option"
                                    mouseEnterDelay={0.3}
                                  >
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<CheckOutlined />}
                                      loading={isAction(
                                        getActionKey("add-option", q.id)
                                      )}
                                      onClick={handleAddOption}
                                    >
                                      Valider
                                    </Button>
                                  </Tooltip>
                                </div>
                              </div>
                            }
                          >
                            <Tooltip
                              title="Ajouter une option"
                              mouseEnterDelay={0.3}
                            >
                              <Button size="small" icon={<PlusOutlined />}>
                                Ajouter une option
                              </Button>
                            </Tooltip>
                          </Popover>
                        </div>

                        <ul className="space-y-2">
                          {(q.options || []).map((op, optionIndex) => {
                            const editOpen =
                              editOption.qid === q.id &&
                              editOption.index === optionIndex;
                            const optionValue = editOpen
                              ? editOption.value
                              : op || "";
                            const {
                              nodes: optionNodes,
                              hasUnmatched: optionHasError,
                            } = renderInlineKatex(optionValue);
                            return (
                              <li
                                key={`${q.id}-${optionIndex}`}
                                className="flex flex-col gap-1 rounded border border-gray-200 bg-gray-200 px-2 py-1 sm:flex-row sm:items-start sm:justify-between"
                              >
                                <div className="flex-1 flex items-start gap-2">
                                  <Radio
                                    checked={q.correct === optionIndex}
                                    onChange={() =>
                                      handleSelectCorrect(q.id, optionIndex)
                                    }
                                  />
                                  <div>
                                    <p className="text-xs text-gray-500">
                                      Option {optionIndex + 1}
                                    </p>
                                    <p className="whitespace-pre-line break-words text-sm text-gray-800">
                                      {optionValue ? (
                                        optionNodes
                                      ) : (
                                        <span className="text-gray-400">
                                          vide
                                        </span>
                                      )}
                                      {optionValue && optionHasError && (
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
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Popover
                                    trigger="click"
                                    open={editOpen}
                                    onOpenChange={(visible) => {
                                      if (visible) {
                                        setEditOption({
                                          qid: q.id,
                                          index: optionIndex,
                                          value: op || "",
                                        });
                                      } else if (editOpen) {
                                        setEditOption({
                                          qid: null,
                                          index: null,
                                          value: "",
                                        });
                                      }
                                    }}
                                    content={
                                      <div className="w-64 space-y-2">
                                        <Input.TextArea
                                          value={editOption.value}
                                          maxLength={300}
                                          autoSize={{ minRows: 3, maxRows: 6 }}
                                          onChange={(e) =>
                                            setEditOption((prev) => ({
                                              ...prev,
                                              value: e.target.value,
                                            }))
                                          }
                                        />
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
                                                setEditOption({
                                                  qid: null,
                                                  index: null,
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
                                                getActionKey(
                                                  "edit-option",
                                                  q.id,
                                                  optionIndex
                                                )
                                              )}
                                              onClick={handleEditOption}
                                            >
                                              Valider
                                            </Button>
                                          </Tooltip>
                                        </div>
                                      </div>
                                    }
                                  >
                                    <Tooltip
                                      title="Modifier cette option"
                                      mouseEnterDelay={0.3}
                                    >
                                      <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                      />
                                    </Tooltip>
                                  </Popover>
                                  <Tooltip
                                    title="Supprimer cette option"
                                    mouseEnterDelay={0.3}
                                  >
                                    <Button
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      loading={isAction(
                                        getActionKey(
                                          "delete-option",
                                          q.id,
                                          optionIndex
                                        )
                                      )}
                                      onClick={() =>
                                        handleDeleteOption(q.id, optionIndex)
                                      }
                                    />
                                  </Tooltip>
                                </div>
                              </li>
                            );
                          })}
                          {!q.options?.length && (
                            <li className="text-sm text-gray-500">
                              Aucune option pour le moment.
                            </li>
                          )}
                        </ul>

                        <div className="rounded border border-gray-200 bg-gray-100 px-2 py-2 text-sm">
                          <p className="m-0 text-xs text-gray-600">
                            Selectionner la bonne reponse
                          </p>
                          <p className="m-0 text-xs text-gray-500">
                            {Number.isInteger(q.correct)
                              ? `Option ${q.correct + 1}`
                              : "Aucune selection"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </Carousel>
        </div>
      </div>

      {/* Eval / resultat */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-2 rounded border border-gray-200 p-2">
          <p className="text-sm font-semibold text-gray-700">Mode évaluation</p>
          <Radio.Group
            value={localEvalQuizz}
            onChange={(e) =>
              persistQuizz(undefined, {
                evalValue: e.target.value,
                successMessage: "Mode évaluation mis a jour.",
              })
            }
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Radio value="non">Mode formatif</Radio>
            <Radio value="oui">Mode évaluation actif</Radio>
            <Radio value="attente">Mode évaluation en attente</Radio>
          </Radio.Group>
        </div>

        <div className="flex flex-col items-center gap-2 rounded border border-gray-200 p-2">
          <p className="text-sm font-semibold text-gray-700">Résultats quizz</p>
          <Radio.Group
            value={`${localResultatQuizz}`}
            onChange={(e) =>
              persistQuizz(undefined, {
                resultValue: e.target.value === "true",
                successMessage: "Etat d'affichage des resultats mis a jour.",
              })
            }
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Radio value="false">Résultats cachés</Radio>
            <Radio value="true">Résultats publiés</Radio>
          </Radio.Group>
        </div>
      </div>
      </div>
    </div>
  );
}
