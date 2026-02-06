import React, { useState, useEffect, useCallback } from "react";
import { Layout, theme, Button, message } from "antd";
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
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const isAdmin = isAuthenticated && user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/"); // bloque l'accès aux non-admin
    }
  }, [isAdmin, router]);
/////
  const dispatch = useDispatch();
  const authFetch = async (url, options) => {
    const response = await fetch(url, options);
    throwIfUnauthorized(response);
    return response;
  };
  const data = useSelector((state) => state.cardsMaths.data);
  const cardsFiltre = Array.isArray(data?.result) ? data.result : [];
  const cards = cardsFiltre.filter((obj) => obj.repertoire === nomRepertoire);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [resetSignals, setResetSignals] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await authFetch(`${urlFetch}/cards/admin`, {
        credentials: "include",
      });
      const payload = await response.json();

      if (response.ok) {
        dispatch(
          setCardsMaths({
            ...payload,
            __source: "admin",
            __classId: user?.classId || null,
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
  }, [dispatch, urlFetch, user?.classId]);

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
    if (!isAdmin) {
      return;
    }
    if (
      data?.__source === "admin" &&
      String(data?.__classId || "") === String(user?.classId || "")
    ) {
      return; // payload admin deja present
    }

    fetchCards();
  }, [isAdmin, data?.__classId, data?.__source, fetchCards, user?.classId]);

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

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <Content>
        <div
          style={{
            background: colorBgLayout,
            minHeight: 20,
            borderRadius: borderRadiusLG,
            marginTop: 0,
          }}
          className="flex flex-col gap-y-10 items-center p-1 md:p-4"
        >
          <div className="w-full flex justify-end">
            <Button
              type="primary"
              onClick={handleAddCard}
              loading={creating}
              disabled={loading}
            >
              Ajouter une carte
            </Button>
          </div>

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
