import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";
import { Tooltip } from "antd";

export default function FilesBlock({
  num,
  repertoire,
  fichiers,
  bg,
  isExpanded,
  canSeeHiddenFiles,
}) {
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

  const renderInlineKatex = (input) =>
    parseInlineKatex(input).map((part, i) =>
      part.type === "text" ? (
        <Fragment key={`text-${i}`}>{part.value}</Fragment>
      ) : (
        <InlineMath key={`math-${i}`} math={part.value} />
      )
    );

  // Icônes officielles via Simple Icons CDN (tracés officiels)
  const BrandImg = ({ src, alt, title, className, fallback }) => {
    const [err, setErr] = useState(false);
    if (err && fallback)
      return typeof fallback === "function" ? fallback() : fallback;
    return (
      <img
        src={src}
        alt={alt}
        title={title || alt}
        className={className}
        onError={() => setErr(true)}
      />
    );
  };

  const FileTypeIcon = ({ ext, className = "w-5 h-5" }) => {
    const e = (ext || "").toLowerCase();
    // Python: logo bicolore officiel local
    if (e === "py") {
      return (
        <img
          src="/icons/python.svg"
          alt="Python"
          title="Python"
          className={className}
        />
      );
    }
    // Word: logo officiel local (W 2013-2019)
    if (e === "doc" || e === "docx") {
      return (
        <img
          src="/icons/word.svg"
          alt="Microsoft Word"
          title="Microsoft Word"
          className={className}
        />
      );
    }
    // PDF: tente Simple Icons (Acrobat) + fallback inline
    if (e === "pdf") {
      return (
        <BrandImg
          src={`https://cdn.simpleicons.org/adobeacrobatreader/FF0000`}
          alt="PDF"
          className={className}
          fallback={() => (
            <svg
              viewBox="0 0 24 24"
              role="img"
              aria-label="PDF"
              className={className}
            >
              <rect x="2" y="2" width="20" height="20" rx="3" fill="#E11D2A" />
              <text
                x="12"
                y="15"
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#fff"
              >
                PDF
              </text>
            </svg>
          )}
        />
      );
    }
    // Office: Excel / PowerPoint via Simple Icons CDN (couleurs marque)
    if (e === "xls" || e === "xlsx" || e === "csv") {
      return (
        <BrandImg
          src={`https://cdn.simpleicons.org/microsoftexcel/107C41`}
          alt="Microsoft Excel"
          className={className}
          fallback={() => (
            <svg
              viewBox="0 0 24 24"
              role="img"
              aria-label="Excel"
              className={className}
            >
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#107C41" />
              <rect
                x="6"
                y="6"
                width="12"
                height="12"
                rx="1.5"
                fill="#fff"
                opacity="0.15"
              />
              <path d="M8 8l5 4-5 4V8z" fill="#fff" />
              <rect
                x="4"
                y="3"
                width="6"
                height="18"
                rx="1"
                fill="#0B5C30"
                opacity="0.9"
              />
              <path
                d="M6.2 10.5l1.2 1.8 1.2-1.8h1.3l-1.8 2.7 1.8 2.7H8.6l-1.2-1.8-1.2 1.8H4.7l1.8-2.7-1.8-2.7h1.5z"
                fill="#fff"
              />
            </svg>
          )}
        />
      );
    }
    if (e === "ppt" || e === "pptx") {
      return (
        <BrandImg
          src={`https://cdn.simpleicons.org/microsoftpowerpoint/D24726`}
          alt="Microsoft PowerPoint"
          className={className}
        />
      );
    }
    if (e === "md") {
      return (
        <BrandImg
          src={`https://cdn.simpleicons.org/markdown/000000`}
          alt="Markdown"
          className={className}
        />
      );
    }
    if (e === "zip" || e === "rar" || e === "7z") {
      // Dossier avec fermeture éclair (inline SVG, lisible sur fond clair)
      return (
        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-label="Archive"
          className={className}
        >
          {/* Dossier */}
          <path
            d="M3 7a2 2 0 0 1 2-2h4.5l1.5 2H21a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z"
            fill="#F59E0B"
          />
          <path d="M3 9h18v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z" fill="#FBBF24" />
          {/* Fermeture éclair */}
          <rect x="11" y="6" width="2" height="2" rx="0.5" fill="#374151" />
          <rect x="11" y="9" width="2" height="2" rx="0.5" fill="#374151" />
          <rect x="11" y="12" width="2" height="2" rx="0.5" fill="#374151" />
          <rect x="11" y="15" width="2" height="2" rx="0.5" fill="#374151" />
          {/* Curseur de zip */}
          <path
            d="M11 17h2v2a1 1 0 0 1-1 1h0a1 1 0 0 1-1-1v-2z"
            fill="#6B7280"
          />
        </svg>
      );
    }
    if (
      e === "jpg" ||
      e === "jpeg" ||
      e === "png" ||
      e === "gif" ||
      e === "svg"
    ) {
      return (
        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-label="Image"
          className={className}
        >
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#6D28D9" />
          <circle cx="9" cy="9" r="2" fill="#fff" />
          <path d="M4 18l5-5 3 3 3-3 5 5H4z" fill="#fff" />
        </svg>
      );
    }
    if (e === "mp4") {
      return (
        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-label="Video"
          className={className}
        >
          <rect x="2" y="5" width="20" height="14" rx="2" fill="#2563EB" />
          <rect x="4" y="7" width="12" height="10" rx="1" fill="#1D4ED8" />
          <path d="M15 9.5l4 2.5-4 2.5v-5z" fill="#BFDBFE" />
        </svg>
      );
    }
    // Fallback générique
    return (
      <svg
        viewBox="0 0 24 24"
        role="img"
        aria-label="Fichier"
        className={className}
      >
        <rect x="4" y="3" width="14" height="18" rx="2" fill="#9CA3AF" />
        <path d="M14 3v4a1 1 0 001 1h4" fill="#9CA3AF" />
        <path d="M14 3l5 5" stroke="#6B7280" strokeWidth="1" />
      </svg>
    );
  };
  const racine = `https://storage.googleapis.com/${
    process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"
  }/${repertoire}/tag${num}/`;

  const toBlurFile = (filename) => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };

  const blurBg = useMemo(() => (bg ? toBlurFile(bg) : ""), [bg]);
  const showBackground = Boolean(isExpanded && bg);
  const fichiersFiltered = canSeeHiddenFiles
    ? (fichiers || []).filter(Boolean)
    : (fichiers || []).filter((elt) => elt && elt.visible);
  const tab = fichiersFiltered.map((elt, idx) => {
    const name =
      elt.txt || elt.name || elt.label || elt.href || `fichier-${idx}`;
    const href = racine + elt.href || "#";
    const hoverText = typeof elt?.hover === "string" ? elt.hover.trim() : "";

    const extFromHref = href.includes(".")
      ? href.split(".").pop().toLowerCase()
      : "";
    const extFromName = name.includes(".")
      ? name.split(".").pop().toLowerCase()
      : "";
    const ext = (extFromHref || extFromName || "").split(/[?#]/)[0];
    const icon = <FileTypeIcon ext={ext} className="w-5 h-5" />;
    const nameNode = <span className="break-all whitespace-normal">{name}</span>;
    const hoverTitle = hoverText ? (
      <span style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
        {renderInlineKatex(hoverText)}
      </span>
    ) : null;
    const nameWithHover = hoverText ? (
      <Tooltip title={hoverTitle} mouseEnterDelay={0.2}>
        {nameNode}
      </Tooltip>
    ) : (
      nameNode
    );
    return (
      <li key={`${name}-${idx}`} className="flex items-center gap-2 py-1">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-900 underline decoration-blue-300 hover:decoration-blue-500"
        >
          <span className="shrink-0 text-lg leading-none">{icon}</span>
          {nameWithHover}
          {ext && (
            <span className="text-xs text-gray-500">({ext.toUpperCase()})</span>
          )}
        </a>
      </li>
    );
  });

  return (
    <div className="relative w-full min-h-[150px]">
      {showBackground && (
        <>
          <div className="absolute inset-0 z-0">
            <Image
              src={`${racine}${bg}`}
              alt=""
              fill
              placeholder="blur"
              blurDataURL={`${racine}${blurBg}`}
              sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover object-center"
            />
          </div>
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ background: "rgba(255,255,255,0.9)" }}
          />
        </>
      )}
       <div className="relative z-20 p-4">
        {canSeeHiddenFiles ? (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Exception : fichiers cachés visibles.
          </div>
        ) : null}
        {tab && tab.length > 0 ? (
          <ul className="list-none m-0 p-0 divide-y divide-gray-100">
            {tab}
          </ul>
        ) : (
          <p className="text-gray-600 text-sm">Aucun fichier disponible.</p>
        )}
      </div>
    </div>
  );
}
