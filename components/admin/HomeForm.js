import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Layout, theme, Button, Progress, Upload, message } from "antd";
import JSZip from "jszip";
const { Content } = Layout;
import Card from "./Card";
import { useDispatch, useSelector } from "react-redux";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { setCardsMaths } from "../../reducers/cardsMathsSlice";
import { useRouter } from "next/router";
import { handleAuthError, throwIfUnauthorized } from "../../utils/auth";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const App = ({ nomRepertoire }) => {
  const {
    token: { colorBgLayout, colorBgContainer, borderRadiusLG },
  } = theme.useToken();
 //////
  const router = useRouter();
  const { isAuthenticated, isReady: authReady, user } = useSelector((s) => s.auth);
  const isAdmin = isAuthenticated && user?.role === "admin";
  const adminRepertoires = Array.isArray(user?.adminRepertoires)
    ? user.adminRepertoires
    : [];
  const canAdminRepertoire =
    isAuthenticated &&
    (isAdmin ||
      (typeof nomRepertoire === "string" &&
        adminRepertoires.includes(nomRepertoire)));

  useEffect(() => {
    if (!canAdminRepertoire) {
      router.replace("/"); // bloque l'accès aux non-admin
    }
  }, [authReady, canAdminRepertoire, router]);
/////
  const dispatch = useDispatch();
  const authFetch = async (url, options) => {
    const response = await fetch(url, options);
    throwIfUnauthorized(response);
    return response;
  };
  const data = useSelector((state) => state.cardsMaths.data);
  const repertoiresFromDb = Array.isArray(data?.repertoires) ? data.repertoires : [];
  const cardsFiltre = Array.isArray(data?.result) ? data.result : [];
  const cards = cardsFiltre.filter((obj) => obj.repertoire === nomRepertoire);
  const repertoireBgColor = useMemo(() => {
    const target = typeof nomRepertoire === "string" ? nomRepertoire.trim() : "";
    if (!target) return null;
    const match = repertoiresFromDb.find(
      (rep) => String(rep?.repertoire || "").trim() === target
    );
    const color = typeof match?.bgcolor === "string" ? match.bgcolor.trim() : "";
    return color || null;
  }, [nomRepertoire, repertoiresFromDb]);
  const layoutBgColor = repertoireBgColor || colorBgLayout;

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [resetSignals, setResetSignals] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await authFetch(
        `${urlFetch}/cards/admin?repertoire=${encodeURIComponent(
          nomRepertoire || ""
        )}`,
        {
          credentials: "include",
        }
      );
      const payload = await response.json();

      if (response.ok) {
        dispatch(
          setCardsMaths({
            ...payload,
            __source: "admin",
            __classId: user?.classId || null,
            __repertoire: typeof nomRepertoire === "string" ? nomRepertoire : "",
          })
        );
      } else {
        setErrorMessage(
          payload?.error || "Erreur lors du chargement des cartes."
        );
      }
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) {
        setErrorMessage("Erreur serveur.");
      }
    } finally {
      setLoading(false);
    }
  }, [dispatch, urlFetch, user?.classId, nomRepertoire]);

  useEffect(() => {
    setResetSignals((prev) => {
      const next = cards.map((_, idx) => prev[idx] ?? 0);
      if (
        next.length === prev.length &&
        next.every((val, idx) => val === prev[idx])
      ) {
        return prev;
      }
      return next;
    });
  }, [cards]);

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!canAdminRepertoire) {
      return;
    }
    const requestedRepertoire =
      typeof nomRepertoire === "string" ? nomRepertoire.trim() : "";
    const loadedRepertoire =
      typeof data?.__repertoire === "string" ? data.__repertoire.trim() : "";
    if (
      data?.__source === "admin" &&
      String(data?.__classId || "") === String(user?.classId || "") &&
      loadedRepertoire === requestedRepertoire
    ) {
      return; // payload admin deja present
    }

    fetchCards();
  }, [
    canAdminRepertoire,
    data?.__classId,
    data?.__repertoire,
    data?.__source,
    fetchCards,
    user?.classId,
    nomRepertoire,
  ]);

  const handleExternalTabChange = (index) => {
    setResetSignals((prev) => {
      if (!prev.length) return prev;
      return prev.map((value, idx) => (idx === index ? value : value + 1));
    });
  };

  const getCardKey = (card, idx) => card?._id || card?.id || card?.num || idx;

  const handleAddCard = async () => {
    const repertoire = (cards?.[0]?.repertoire || nomRepertoire).trim();

    if (!repertoire) {
      setErrorMessage("Répertoire introuvable pour la création.");
      return;
    }

    setCreating(true);
    setErrorMessage(null);

    try {
      const response = await authFetch(`${urlFetch}/cards/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ repertoire }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setErrorMessage(payload?.error || "Impossible d'ajouter la carte.");
        return;
      }

      message.success("Carte ajoutée.");
      await fetchCards();
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) {
        setErrorMessage("Erreur lors de l'ajout de la carte.");
      }
    } finally {
      setCreating(false);
    }
  };

  const getZipBaseName = (name = "") => {
    const normalized = `${name}`.replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : normalized;
  };

  const guessContentType = (name = "") => {
    const lower = `${name}`.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".txt")) return "text/plain";
    if (lower.endsWith(".md")) return "text/markdown";
    if (lower.endsWith(".csv")) return "text/csv";
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".zip")) return "application/zip";
    return "application/octet-stream";
  };

  const uploadToSignedUrlWithProgress = ({ url, blob, contentType, onProgress }) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader(
        "Content-Type",
        contentType || "application/octet-stream"
      );
      xhr.upload.onprogress = (event) => {
        if (typeof onProgress === "function") {
          onProgress(event);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error("Upload direct echoue."));
        }
      };
      xhr.onerror = () => reject(new Error("Upload direct echoue."));
      xhr.send(blob);
    });

  const handleImportCardZip = async (file) => {
    if (!file) return;
    const fileName = file.name || "";
    if (!fileName.toLowerCase().endsWith(".zip")) {
      message.error("Merci de choisir un fichier .zip.");
      return;
    }

    const repertoire = (cards?.[0]?.repertoire || nomRepertoire).trim();
    if (!repertoire) {
      message.error("Repertoire introuvable pour l'import.");
      return;
    }

    const importKey = "import-card";
    setImporting(true);
    setImportProgress({ stage: "zip", current: 0, total: 0, file: "", percent: 0 });
    message.loading({
      content: "Import de la carte en cours...",
      key: importKey,
      duration: 0,
    });

    let createdCardId = null;

    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);

      const jsonEntry =
        entries.find(
          (entry) => getZipBaseName(entry.name).toLowerCase() === "card.json"
        ) || null;

      if (!jsonEntry) {
        throw new Error("card.json introuvable dans le zip.");
      }

      let parsedCard = null;
      try {
        parsedCard = JSON.parse(await jsonEntry.async("text"));
      } catch (_) {
        throw new Error("card.json est invalide.");
      }
      if (!parsedCard || typeof parsedCard !== "object") {
        throw new Error("card.json est invalide.");
      }

      const createResponse = await authFetch(`${urlFetch}/cards/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ repertoire }),
      });
      const createPayload = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createPayload?.error || "Impossible de creer la carte.");
      }
      createdCardId = createPayload?.result?._id || createPayload?.result?.id;
      if (!createdCardId) {
        throw new Error("Identifiant de carte manquant apres creation.");
      }

      const fileEntries = entries.filter((entry) =>
        `${entry.name}`.replace(/\\/g, "/").startsWith("files/")
      );

      setImportProgress({
        stage: "upload",
        current: 0,
        total: fileEntries.length,
        file: "",
        percent: 0,
      });

      for (let idx = 0; idx < fileEntries.length; idx += 1) {
        const entry = fileEntries[idx];
        const entryName = `${entry.name}`.replace(/\\/g, "/");
        const relativePath = entryName.slice("files/".length);
        if (!relativePath) continue;

        setImportProgress((prev) => ({
          ...(prev || {}),
          stage: "upload",
          current: idx + 1,
          total: fileEntries.length,
          file: relativePath,
          percent: Math.floor(((idx + 0) / Math.max(1, fileEntries.length)) * 100),
        }));

        const blob = await entry.async("blob");
        const contentType = guessContentType(relativePath);

        const signResponse = await authFetch(
          `${urlFetch}/cards/${createdCardId}/import/sign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              path: relativePath,
              type: contentType,
              size: blob.size,
            }),
          }
        );
        const signPayload = await signResponse.json();
        if (!signResponse.ok) {
          throw new Error(signPayload?.error || "Impossible de preparer l'upload.");
        }
        const signed = signPayload?.result || signPayload;
        const signedUrl = signed?.url;
        const signedContentType = signed?.contentType || contentType;
        if (!signedUrl) {
          throw new Error("URL d'upload manquante.");
        }

        await uploadToSignedUrlWithProgress({
          url: signedUrl,
          blob,
          contentType: signedContentType,
          onProgress: (event) => {
            const totalBytes = event?.total || blob.size || 0;
            const loadedBytes = event?.loaded || 0;
            const filePercent =
              totalBytes > 0 ? Math.floor((loadedBytes / totalBytes) * 100) : 0;
            const overallPercent = Math.floor(
              ((idx + filePercent / 100) / Math.max(1, fileEntries.length)) * 100
            );
            setImportProgress({
              stage: "upload",
              current: idx + 1,
              total: fileEntries.length,
              file: relativePath,
              percent: Math.max(0, Math.min(100, overallPercent)),
              filePercent: Math.max(0, Math.min(100, filePercent)),
            });
          },
        });

        const confirmResponse = await authFetch(
          `${urlFetch}/cards/${createdCardId}/import/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ path: relativePath }),
          }
        );
        const confirmPayload = await confirmResponse.json();
        if (!confirmResponse.ok) {
          throw new Error(
            confirmPayload?.error || "Impossible de finaliser l'upload."
          );
        }
      }

      setImportProgress((prev) => ({
        ...(prev || {}),
        stage: "apply",
        file: "",
        percent: 100,
      }));
      const applyResponse = await authFetch(
        `${urlFetch}/cards/${createdCardId}/import/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ card: parsedCard }),
        }
      );
      const applyPayload = await applyResponse.json();
      if (!applyResponse.ok) {
        throw new Error(applyPayload?.error || "Impossible d'appliquer card.json.");
      }

      await fetchCards();
      message.success({ content: "Import termine.", key: importKey });
    } catch (err) {
      console.error("Erreur import carte", err);
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) {
        message.error({
          content: err.message || "Erreur lors de l'import.",
          key: importKey,
        });
      }

      if (createdCardId) {
        try {
          await authFetch(`${urlFetch}/cards/${createdCardId}`, {
            method: "DELETE",
            credentials: "include",
          });
        } catch (_) {}
      }
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  if (!authReady) {
    return null;
  }

  if (!canAdminRepertoire) {
    return null;
  }

  return (
    <Layout>
      <Content>
        <div
          style={{
            background: layoutBgColor,
            minHeight: 20,
            borderRadius: borderRadiusLG,
            marginTop: 0,
          }}
          className="flex flex-col gap-y-10 items-center p-1 md:p-4"
        >
          <div className="w-full flex justify-end gap-2">
            <Upload
              accept=".zip"
              showUploadList={false}
              disabled={loading || creating || importing}
              beforeUpload={(file) => {
                handleImportCardZip(file);
                return false;
              }}
            >
              <Button disabled={loading || creating || importing}>
                Importer une carte
              </Button>
            </Upload>
            <Button
              type="primary"
              onClick={handleAddCard}
              loading={creating}
              disabled={loading || importing}
            >
              Ajouter une carte
            </Button>
          </div>

          {importing && importProgress && (
            <div className="w-full max-w-xl">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>
                  {importProgress.stage === "upload"
                    ? `Import: ${importProgress.current}/${importProgress.total}`
                    : importProgress.stage === "apply"
                      ? "Application des donnees..."
                      : "Preparation..."}
                </span>
                <span>{importProgress.percent || 0}%</span>
              </div>
              <Progress percent={importProgress.percent || 0} size="small" />
              {importProgress.stage === "upload" && importProgress.file && (
                <div className="mt-1 text-[11px] text-gray-500 truncate">
                  {importProgress.file}
                  {typeof importProgress.filePercent === "number"
                    ? ` (${importProgress.filePercent}%)`
                    : ""}
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-10">
              <ClimbingBoxLoader color="#6C6C6C" size={12} />
              <p className="mt-4 text-sm text-gray-500">
                Chargement des cartes...
              </p>
            </div>
          )}

          {!loading && errorMessage && (
            <p className="text-red-500 text-sm">{errorMessage}</p>
          )}
          {!loading &&
            !errorMessage &&
            cards.map((card, idx) => (
              <div className="w-full" key={card._id || card.num || idx}>
                <Card
                  {...card}
                  resetSignal={resetSignals[idx]}
                  onTabChangeExternal={() => handleExternalTabChange(idx)}
                  expanded={getCardKey(card, idx) === expandedKey}
                  onToggleExpand={(nextExpanded) => {
                    const key = getCardKey(card, idx);
                    setExpandedKey(nextExpanded ? key : null);
                  }}
                />
              </div>
            ))}

          {!loading && !errorMessage && !cards.length && (
            <p className="text-gray-500 text-sm">Aucune carte à afficher.</p>
          )}
        </div>
      </Content>
    </Layout>
  )
}

export default App;
