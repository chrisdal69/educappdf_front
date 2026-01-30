import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Image from "next/image";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import { Text } from "slate";

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

const countTextTokens = (text) =>
  parseInlineKatex(text).reduce(
    (sum, token) => sum + (token.type === "text" ? token.value.length : 1),
    0
  );

const countNodeSteps = (node) => {
  if (Text.isText(node)) {
    return countTextTokens(node.text || "");
  }
  if (!node || !Array.isArray(node.children)) {
    return 0;
  }
  return node.children.reduce((sum, child) => sum + countNodeSteps(child), 0);
};

const renderTextTyped = (leaf, remaining, key) => {
  if (remaining.count <= 0) return null;

  const tokens = parseInlineKatex(leaf.text || "");
  const pieces = [];

  tokens.forEach((token, index) => {
    if (remaining.count <= 0) return;
    if (token.type === "text") {
      const count = Math.min(token.value.length, remaining.count);
      const text = token.value.slice(0, count);
      if (text.length > 0) {
        pieces.push(
          <Fragment key={`${key}-text-${index}`}>{text}</Fragment>
        );
      }
      remaining.count -= count;
    } else {
      pieces.push(
        <InlineMath key={`${key}-math-${index}`} math={token.value} />
      );
      remaining.count -= 1;
    }
  });

  if (!pieces.length) return null;

  let content = pieces;
  if (leaf.bold) {
    content = <strong>{content}</strong>;
  }
  if (leaf.italic) {
    content = <em>{content}</em>;
  }
  if (leaf.underline) {
    content = <u>{content}</u>;
  }

  return <span key={key}>{content}</span>;
};

const renderNodeTyped = (node, remaining, key) => {
  if (Text.isText(node)) {
    return renderTextTyped(node, remaining, key);
  }

  const style = node.align ? { textAlign: node.align } : undefined;
  const children = (node.children || [])
    .map((child, index) => renderNodeTyped(child, remaining, `${key}-${index}`))
    .filter(Boolean);

  if (!children.length) return null;

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

const renderNodesTyped = (nodes, remaining) =>
  nodes
    .map((node, index) => renderNodeTyped(node, remaining, `node-${index}`))
    .filter(Boolean);

export default function Contenu({
  num,
  repertoire,
  content,
  bg,
  isExpanded,
  contentHoverKeepsImage,
}) {
  const [typing, setTyping] = useState(false);
  const [typedStep, setTypedStep] = useState(0);
  const [revealImage, setRevealImage] = useState(false);

  const normalizedContent = useMemo(
    () => normalizeContent(content),
    [content]
  );

  const totalSteps = useMemo(
    () => normalizedContent.reduce((sum, node) => sum + countNodeSteps(node), 0),
    [normalizedContent]
  );

  const typedNodes = useMemo(() => {
    const remaining = { count: typedStep };
    return renderNodesTyped(normalizedContent, remaining);
  }, [normalizedContent, typedStep]);

  const contentRef = useRef(null);
  const inView = useInView(contentRef, { once: true, amount: 0.3 });

  useEffect(() => {
    if (inView || isExpanded) {
      setRevealImage(true);
    }
  }, [inView, isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      setTyping(false);
      setTypedStep(0);
    }
  }, [isExpanded]);

  useEffect(() => {
    let timer;
    if (typing) {
      setTypedStep(0);
      if (totalSteps > 0) {
        let i = 0;
        timer = setInterval(() => {
          i += 1;
          setTypedStep(i);
          if (i >= totalSteps) {
            clearInterval(timer);
          }
        }, 5);
      }
    } else {
      setTypedStep(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [typing, totalSteps]);

  const racine = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"}/${repertoire}/tag${num}/`;

  const toBlurFile = (filename) => {
    if (!filename || typeof filename !== "string") return "";
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };

  const blurBg = useMemo(() => toBlurFile(bg), [bg]);
  const hasBackground = typeof bg === "string" && bg.trim().length > 0;
  const hoverKeepsImage = !!contentHoverKeepsImage;
  const shouldHideImage = !isExpanded && typing && !hoverKeepsImage;
  const showExpandedOverlay = isExpanded && (typing || typedStep > 0);
  const showHoverOverlay = !isExpanded && hoverKeepsImage && typing;
  const showOverlay = showExpandedOverlay || showHoverOverlay;
  const overlayStyle = showHoverOverlay
    ? { background: "rgba(255,255,255,0.7)" }
    : { background: "rgba(229,229,229,0.9)" };
  const shouldShowText = typing || (isExpanded && typedStep > 0);
  const handleTouchStart = () => {
    if (!isExpanded) return;
    setTyping(true);
  };

  const handleMouseEnter = () => {
    setTyping(true);
  };

  const handleMouseLeave = () => {
    if (isExpanded) return;
    setTyping(false);
  };

  return (
    <div ref={contentRef} className="group relative w-full min-h-[150px] ">
      <div className="flex flex-col break-words leading-relaxed text-base whitespace-pre-line min-w-0 mx-5 relative z-20">
        {shouldShowText && (
          <div className="break-words w-full min-w-0 ">{typedNodes}</div>
        )}
      </div>

      {hasBackground && (
        <motion.div
          className="absolute inset-0 z-0"
          initial="hidden"
          animate={revealImage ? "visible" : "hidden"}
          variants={{
            hidden: { clipPath: "inset(0 0 100% 0)" },
            visible: { clipPath: "inset(0 0 0% 0)" },
          }}
          transition={{ duration: 1.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: "clip-path" }}
        >
          <Image
            src={`${racine}${bg}`}
            alt="Logo"
            fill
            placeholder={blurBg ? "blur" : undefined}
            blurDataURL={blurBg ? `${racine}${blurBg}` : undefined}
            sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className={`object-cover object-center transition-opacity duration-300 ease-out ${
              shouldHideImage ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          />
        </motion.div>
      )}

      {showOverlay && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={overlayStyle}
        />
      )}

      <div
        className="absolute inset-0 w-full h-full z-30 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
      />
    </div>
  );
}
