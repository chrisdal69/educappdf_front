import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import { Button, Drawer, message } from "antd";
import { useRouter } from "next/router";
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BarsOutlined,
  BoldOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setCardsMaths } from "../../../reducers/cardsMathsSlice";
import { handleAuthError, throwIfUnauthorized } from "../../../utils/auth";
import Tooltip from "./TooltipClickClose";
import {
  createEditor,
  Editor,
  Element as SlateElement,
  Text,
  Transforms,
} from "slate";
import { Editable, Slate, useSlate, withReact } from "slate-react";
import { withHistory } from "slate-history";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png"];
const MAX_BG_BYTES = 4 * 1024 * 1024;
const CONTENT_VERSION = 1;
const DRAWER_Z_INDEX = 1001;

const LIST_TYPES = ["numbered-list", "bulleted-list"];
const TEXT_ALIGN_TYPES = ["left", "center", "right", "justify"];

const DEFAULT_CONTENT = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];

const normalizeContent = (value) =>
  Array.isArray(value) && value.length ? value : DEFAULT_CONTENT;

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

const renderSlateNode = (node, key) => {
  if (Text.isText(node)) {
    const { nodes, hasUnmatched } = renderInlineKatex(node.text || "");
    let children = nodes;
    if (node.bold) {
      children = <strong>{children}</strong>;
    }
    if (node.italic) {
      children = <em>{children}</em>;
    }
    if (node.underline) {
      children = <u>{children}</u>;
    }
    return (
      <span key={key}>
        {children}
        {hasUnmatched && (
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
      </span>
    );
  }

  const style = node.align ? { textAlign: node.align } : undefined;
  const children = (node.children || []).map((child, index) =>
    renderSlateNode(child, `${key}-${index}`)
  );

  switch (node.type) {
    case "bulleted-list":
      return (
        <ul key={key} className="list-disc pl-6" style={style}>
          {children}
        </ul>
      );
    case "numbered-list":
      return (
        <ol key={key} className="list-decimal pl-6" style={style}>
          {children}
        </ol>
      );
    case "list-item":
      return (
        <li key={key} style={style}>
          {children}
        </li>
      );
    default:
      return (
        <p key={key} className="whitespace-pre-wrap" style={style}>
          {children}
        </p>
      );
  }
};

const renderSlateNodes = (nodes) =>
  nodes.map((node, index) => renderSlateNode(node, `node-${index}`));

export default function Contenu({
  _id,
  id,
  num,
  repertoire,
  content,
  contentVersion,
  bg,
  expanded,
}) {
  const dispatch = useDispatch();
  const router = useRouter();
  const cardsData = useSelector((state) => state.cardsMaths.data);
  const authFetch = async (url, options) => {
    const response = await fetch(url, options);
    throwIfUnauthorized(response);
    return response;
  };

  const [localContent, setLocalContent] = useState(normalizeContent(content));
  const [draftContent, setDraftContent] = useState(localContent);
  const [editorKey, setEditorKey] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);

  const [localBg, setLocalBg] = useState(bg || "");
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setLocalContent(normalizeContent(content));
  }, [content]);

  useEffect(() => {
    const nextBg = bg || "";
    setLocalBg(nextBg);
  }, [bg]);

  const racine = `https://storage.googleapis.com/${
    process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"
  }/${repertoire}/tag${num}/`;

  const toBlurFile = (filename) => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };

  const blurBg = useMemo(() => (localBg ? toBlurFile(localBg) : ""), [localBg]);
  const isExpanded = expanded !== false;
  const showBackground = Boolean(isExpanded && localBg);
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

  const syncCardsStore = (updatedCard, fallbackPatch) => {
    if (!cardsData || !Array.isArray(cardsData.result)) {
      return;
    }

    const targetId = updatedCard?._id || updatedCard?.id || _id || id;
    const targetNum =
      typeof updatedCard?.num !== "undefined" ? updatedCard.num : num;
    const targetRepertoire = updatedCard?.repertoire || repertoire || null;
    const patch = updatedCard || fallbackPatch || {};

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

  const handleOpenEditor = () => {
    if (isEditorOpen) {
      setIsEditorOpen(false);
      return;
    }
    setDraftContent(JSON.parse(JSON.stringify(normalizeContent(localContent))));
    setEditorKey((prev) => prev + 1);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
  };

  const handleSaveContent = async () => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }

    setIsSavingContent(true);
    try {
      const response = await authFetch(`${urlFetch}/cards/${cardId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: draftContent,
          contentVersion: contentVersion || CONTENT_VERSION,
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          payload?.error || "Impossible d'enregistrer la modification."
        );
      }

      const updatedCard = payload?.result;
      const nextContent = normalizeContent(updatedCard?.content || draftContent);
      setLocalContent(nextContent);
      syncCardsStore(updatedCard, {
        content: nextContent,
        contentVersion: contentVersion || CONTENT_VERSION,
      });
      message.success("Contenu enregistre.");
      setIsEditorOpen(false);
    } catch (error) {
      console.error("Erreur lors de la mise a jour du contenu", error);
      const handled = handleAuthError(error, { dispatch, router });
      if (!handled) {
        message.error(error.message || "Erreur lors de la sauvegarde.");
      }
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleBackgroundButtonClick = () => {
    if (isUploadingBg) {
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleBackgroundInputChange = async (event) => {
    const target = event?.target;
    const file = target?.files?.[0];
    if (!file) return;
    target.value = "";
    await uploadBackgroundFile(file);
  };

  const uploadBackgroundFile = async (file) => {
    if (!cardId) {
      message.error("Identifiant de carte manquant.");
      return;
    }
    if (!repertoire) {
      message.error("Repertoire manquant.");
      return;
    }
    const normalizedNum = Number(num);
    if (!Number.isFinite(normalizedNum)) {
      message.error("Numero de tag invalide.");
      return;
    }

    if (file?.size && file.size > MAX_BG_BYTES) {
      message.error("Fichier trop volumineux (4 Mo max)");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("repertoire", repertoire);
    formData.append("num", `${normalizedNum}`);

    setIsUploadingBg(true);
    try {
      const response = await authFetch(`${urlFetch}/cards/${cardId}/bg/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(payload?.error || "Impossible d'envoyer l'image.");
      }

      const updatedCard = payload?.result;
      const nextBg = updatedCard?.bg || "";
      if (nextBg) {
        setLocalBg(nextBg);
      }
      syncCardsStore(updatedCard, { bg: nextBg });
      message.success("Image importee.");
    } catch (error) {
      console.error("Erreur lors de l'upload de l'image de fond", error);
      const handled = handleAuthError(error, { dispatch, router });
      if (!handled) {
        message.error(error.message || "Erreur lors de l'upload.");
      }
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handlePasteImage = (event) => {
    if (isUploadingBg) return;
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
    uploadBackgroundFile(file);
  };

  const handlePasteFromClipboard = async () => {
    if (isUploadingBg) return;
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
      uploadBackgroundFile(file);
    } catch (error) {
      const errName = error?.name;
      const errMessage = String(error?.message || "");
      if (
        errName === "NotAllowedError" ||
        errName === "AbortError" ||
        errMessage.toLowerCase().includes("clipboard read operation is not allowed")
      ) {
        return;
      }
      console.error("Erreur collage image background", error);
      message.error("Erreur lors du collage.");
    }
  };

  useEffect(() => {
    const handlePaste = (event) => {
      const active = document.activeElement;
      const isTarget =
        active?.getAttribute?.("data-upload-background") === "true";
      if (!isTarget) return;
      handlePasteImage(event);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePasteImage]);

  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const renderElement = useCallback((props) => <Element {...props} />, []);
  const renderLeaf = useCallback((props) => <Leaf {...props} />, []);
  const displayContent = isEditorOpen ? draftContent : localContent;

  return (
    <div className="group relative w-full min-h-[150px]">
      {showBackground && (
        <>
          <div className="absolute inset-0 z-0">
            <Image
              src={`${racine}${localBg}`}
              alt=""
              fill
              placeholder={blurBg ? "blur" : undefined}
              blurDataURL={blurBg ? `${racine}${blurBg}` : undefined}
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
        <div className="flex flex-col gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-5 py-4">
            <section className="rounded-lg bg-white/60 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-gray-800">Contenu</p>
                <Tooltip title="Modifier le contenu" mouseEnterDelay={0.3}>
                  <Button
                    icon={<EditOutlined />}
                    size="small"
                    type="default"
                    onClick={handleOpenEditor}
                  />
                </Tooltip>
              </div>
              <div className="mt-3 space-y-2 text-base leading-relaxed text-gray-800 ">
                {displayContent && displayContent.length ? (
                  renderSlateNodes(normalizeContent(displayContent))
                ) : (
                  <p className="text-gray-500">Aucun contenu.</p>
                )}
              </div>
            </section>
          </div>
          <div className="mx-5 flex flex-col items-center gap-2 pb-4">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-gray-700">
                Image background :
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBackgroundInputChange}
              />
              <Tooltip title="Changer l'image de fond" mouseEnterDelay={0.3}>
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  type="default"
                  onClick={handleBackgroundButtonClick}
                  loading={isUploadingBg}
                  className="flex items-center"
                  data-upload-background="true"
                >
                  {isUploadingBg ? "Upload..." : "Changer"}
                </Button>
              </Tooltip>
              <Tooltip title="Coller une image capturée (screenshot)" mouseEnterDelay={0.3}>
                <Button
                  size="small"
                  onClick={handlePasteFromClipboard}
                  disabled={isUploadingBg}
                  data-upload-background="true"
                >
                  Coller
                </Button>
              </Tooltip>
            </div>
            {localBg ? (
              <Image
                src={`${racine}${localBg}`}
                alt="Illustration de la carte"
                width={300}
                height={300}
                placeholder={blurBg ? "blur" : undefined}
                blurDataURL={blurBg ? `${racine}${blurBg}` : undefined}
                sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, (max-width: 1200px) 33vw, 25vw"
                className="max-w-full rounded-lg object-cover shadow"
              />
            ) : (
              <p className="text-sm text-gray-500">
                Aucun fichier d'image defini.
              </p>
            )}
          </div>
        </div>

        <Drawer
          title="Edition du contenu"
          open={isEditorOpen}
          onClose={handleCloseEditor}
          placement="bottom"
          height="50vh"
          mask={false}
          zIndex={DRAWER_Z_INDEX}
          styles={{
            wrapper: {
              height: "50vh",
            },
            content: {
              display: "flex",
              flexDirection: "column",
              height: "100%",
            },
            body: {
              padding: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            },
          }}
          drawerRender={(node) => (
            <>
              {isEditorOpen && <div className="drawer-backdrop " />}
              <div className="drawer-foreground">{node}</div>
            </>
          )}
          destroyOnClose
        >
          <div className="flex flex-1 flex-col gap-4 min-h-0">
            <Slate
              key={editorKey}
              editor={editor}
              initialValue={normalizeContent(draftContent)}
              onChange={setDraftContent}
            >
              <div className="flex flex-1 flex-col gap-3 min-h-0">
                <div className="flex flex-wrap gap-2">
                  <MarkButton
                    format="bold"
                    label="Gras"
                    icon={<BoldOutlined />}
                  />
                  <MarkButton
                    format="italic"
                    label="Italique"
                    icon={<ItalicOutlined />}
                  />
                  <MarkButton
                    format="underline"
                    label="Souligne"
                    icon={<UnderlineOutlined />}
                  />
                  <BlockButton
                    format="bulleted-list"
                    label="Liste"
                    icon={<UnorderedListOutlined />}
                  />
                  <BlockButton
                    format="numbered-list"
                    label="Liste numerotee"
                    icon={<OrderedListOutlined />}
                  />
                  <BlockButton
                    format="left"
                    label="Aligner a gauche"
                    icon={<AlignLeftOutlined />}
                  />
                  <BlockButton
                    format="center"
                    label="Centrer"
                    icon={<AlignCenterOutlined />}
                  />
                  <BlockButton
                    format="right"
                    label="Aligner a droite"
                    icon={<AlignRightOutlined />}
                  />
                  <BlockButton
                    format="justify"
                    label="Justifier"
                    icon={<BarsOutlined />}
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <Editable
                    className="min-h-[220px] text-base leading-loose rounded border border-slate-300 p-3"
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    placeholder="Texte et formules avec $...$"
                    spellCheck
                  />
                  <p className="mt-4 text-xs text-gray-500">
                    Utiliser $...$ pour les formules inline.
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">{formulaLinks}</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        loading={isSavingContent}
                        onClick={handleSaveContent}
                      >
                        Valider
                      </Button>
                      <Button icon={<CloseOutlined />} onClick={handleCloseEditor}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Slate>
          </div>
        </Drawer>
      </div>
    </div>
  );
}

function MarkButton({ format, label, icon }) {
  const editor = useSlate();
  const isActive = isMarkActive(editor, format);
  return (
    <Tooltip title={label} mouseEnterDelay={0.3}>
      <Button
        size="small"
        type={isActive ? "primary" : "default"}
        icon={icon}
        onMouseDown={(event) => {
          event.preventDefault();
          toggleMark(editor, format);
        }}
      />
    </Tooltip>
  );
}

function BlockButton({ format, label, icon }) {
  const editor = useSlate();
  const isActive = isBlockActive(
    editor,
    format,
    isAlignType(format) ? "align" : "type"
  );
  return (
    <Tooltip title={label} mouseEnterDelay={0.3}>
      <Button
        size="small"
        type={isActive ? "primary" : "default"}
        icon={icon}
        onMouseDown={(event) => {
          event.preventDefault();
          toggleBlock(editor, format);
        }}
      />
    </Tooltip>
  );
}

function toggleMark(editor, format) {
  const isActive = isMarkActive(editor, format);
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
}

function isMarkActive(editor, format) {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
}

function toggleBlock(editor, format) {
  const isActive = isBlockActive(
    editor,
    format,
    isAlignType(format) ? "align" : "type"
  );
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: (node) =>
      !Editor.isEditor(node) &&
      SlateElement.isElement(node) &&
      LIST_TYPES.includes(node.type) &&
      !isAlignType(format),
    split: true,
  });

  let newProperties;
  if (isAlignType(format)) {
    newProperties = {
      align: isActive ? undefined : format,
    };
  } else {
    newProperties = {
      type: isActive ? "paragraph" : isList ? "list-item" : format,
    };
  }

  Transforms.setNodes(editor, newProperties);

  if (!isActive && isList) {
    Transforms.wrapNodes(editor, { type: format, children: [] });
  }
}

function isBlockActive(editor, format, blockType = "type") {
  const { selection } = editor;
  if (!selection) return false;
  const [match] = Editor.nodes(editor, {
    at: Editor.unhangRange(editor, selection),
    match: (node) =>
      !Editor.isEditor(node) &&
      SlateElement.isElement(node) &&
      (blockType === "align" ? node.align === format : node.type === format),
  });
  return !!match;
}

function isAlignType(format) {
  return TEXT_ALIGN_TYPES.includes(format);
}

function Element({ attributes, children, element }) {
  const style = element.align ? { textAlign: element.align } : undefined;
  switch (element.type) {
    case "bulleted-list":
      return (
        <ul className="list-disc pl-6" style={style} {...attributes}>
          {children}
        </ul>
      );
    case "numbered-list":
      return (
        <ol className="list-decimal pl-6" style={style} {...attributes}>
          {children}
        </ol>
      );
    case "list-item":
      return (
        <li style={style} {...attributes}>
          {children}
        </li>
      );
    default:
      return (
        <p style={style} {...attributes}>
          {children}
        </p>
      );
  }
}

function Leaf({ attributes, children, leaf }) {
  let content = children;
  if (leaf.bold) {
    content = <strong>{content}</strong>;
  }
  if (leaf.italic) {
    content = <em>{content}</em>;
  }
  if (leaf.underline) {
    content = <u>{content}</u>;
  }
  const { hasUnmatched } = parseInlineKatex(leaf.text || "");
  return (
    <span {...attributes}>
      {content}
      {hasUnmatched && (
        <span
          contentEditable={false}
          style={{
            color: "#ff4d4f",
            marginLeft: 6,
            fontSize: 12,
          }}
        >
          ($ non ferme)
        </span>
      )}
    </span>
  );
}
