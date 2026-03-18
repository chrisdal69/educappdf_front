import React, { useState, useEffect, useMemo, useRef } from "react";
import { Layout, theme, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
const { Content } = Layout;
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import Card from "./Card";
import { useDispatch, useSelector } from "react-redux";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { fetchCardsMaths } from "../reducers/cardsMathsSlice";

const CARD_MIN_WIDTH = 380;
const stripAccentsLower = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const toSlug = (value) =>
  stripAccentsLower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const App = ({ repertoire }) => {
  let {
    token: { colorBgLayout,colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const dispatch = useDispatch();
  const { data, status, error } = useSelector((state) => state.cardsMaths);
  const activeClassId = useSelector((state) => state.auth?.user?.classId);
  const loadedClassId = useSelector((state) => state.cardsMaths.data?.__classId);
  const repertoiresFromDb = useMemo(
    () => (Array.isArray(data?.repertoires) ? data.repertoires : []),
    [data?.repertoires],
  );
  const cardsFiltre = useMemo(
    () => (Array.isArray(data?.result) ? data.result : []),
    [data?.result],
  );
  const activeSlug = toSlug(repertoire);
  const cards = useMemo(
    () => cardsFiltre.filter((obj) => toSlug(obj?.repertoire) === activeSlug),
    [activeSlug, cardsFiltre],
  );
  const cardsSignature = useMemo(
    () => cards.map((card, idx) => String(card?._id || card?.num || idx)).join("|"),
    [cards],
  );
  const repertoireBgColor = useMemo(() => {
    if (!activeSlug) return null;
    const match = repertoiresFromDb.find(
      (rep) => toSlug(rep?.repertoire) === activeSlug
    );
    const color = typeof match?.bgcolor === "string" ? match.bgcolor.trim() : "";
    return color || null;
  }, [activeSlug, repertoiresFromDb]);
  const layoutBgColor = repertoireBgColor || colorBgLayout;

  const [resetSignals, setResetSignals] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTabKey, setExpandedTabKey] = useState("contenu");
  const [showAccueil, setShowAccueil] = useState(false);
  const [cardsPerRow, setCardsPerRow] = useState(1);
  const cardsGridRef = useRef(null);

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
  }, [cardsSignature]);

  useEffect(() => {
    if (!activeClassId) {
      return;
    }

    const isStaleClass = String(loadedClassId || "") !== String(activeClassId);
    const isStaleSource = String(data?.__source || "") !== "public";
    if (status === "idle") {
      dispatch(fetchCardsMaths());
      return;
    }

    if (status === "succeeded" && (isStaleSource || isStaleClass)) {
      dispatch(fetchCardsMaths());
    }
  }, [activeClassId, data?.__source, dispatch, loadedClassId, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateAccueilVisibility = () => {
      setShowAccueil(window.innerWidth >= 830);
    };

    updateAccueilVisibility();
    window.addEventListener("resize", updateAccueilVisibility);

    return () => {
      window.removeEventListener("resize", updateAccueilVisibility);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const gridEl = cardsGridRef.current;
    if (!gridEl) {
      return;
    }

    const updateCardsPerRow = () => {
      const styles = window.getComputedStyle(gridEl);
      const gapValue = styles.columnGap || styles.gap || "0px";
      const gap = Number.parseFloat(gapValue);
      const paddingLeft = Number.parseFloat(styles.paddingLeft);
      const paddingRight = Number.parseFloat(styles.paddingRight);
      const width =
        gridEl.clientWidth -
        (Number.isNaN(paddingLeft) ? 0 : paddingLeft) -
        (Number.isNaN(paddingRight) ? 0 : paddingRight);
      const gapPx = Number.isNaN(gap) ? 0 : gap;
      const columns = Math.max(
        1,
        Math.floor((width + gapPx) / (CARD_MIN_WIDTH + gapPx))
      );

      setCardsPerRow(columns);
    };

    updateCardsPerRow();

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(updateCardsPerRow);
      resizeObserver.observe(gridEl);
      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", updateCardsPerRow);
    return () => {
      window.removeEventListener("resize", updateCardsPerRow);
    };
  }, []);

  const handleExternalTabChange = (index) => {
    setResetSignals((prev) => {
      if (!prev.length) return prev;
      return prev.map((value, idx) => (idx === index ? value : value + 1));
    });
  };
  const handleExpand = (key, tabKey = "contenu") => {
    setExpandedId(key);
    setExpandedTabKey(tabKey);
  };

  const handleCollapse = () => {
    setExpandedId(null);
    setExpandedTabKey("contenu");
  };

  const getCardKey = (card, idx) => card._id || card.num || idx;
  const expandedIndex = cards.findIndex(
    (card, idx) => getCardKey(card, idx) === expandedId
  );
  const expandedCard = expandedIndex >= 0 ? cards[expandedIndex] : null;
  const isLoading = status === "loading" || status === "idle";
  const hasError = status === "failed";

  return (
    <Layout>
      <Content>
        <LayoutGroup>
          <div
           style={{
              background: layoutBgColor,
              minHeight: 20,
              paddingTop: 0,
              borderRadius: borderRadiusLG,
              marginTop: 0,
            }}
            className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-6 items-start px-5"
          >
            {isLoading && (
              <div className="col-span-full flex flex-col items-center py-10">
                <ClimbingBoxLoader color="#6C6C6C" size={12} />
                <p className="mt-4 text-sm text-gray-500">
                  Chargement des cartes...
                </p>
              </div>
            )}

            {!isLoading && hasError && (
              <p className="col-span-full text-red-500 text-sm ">
                {error || "Erreur lors du chargement des cartes."}
              </p>
            )}
            {!isLoading && !hasError && cards.length > 0 && showAccueil && (
              <Accueil titre={cards[0]?.titre} />
            )}
            {!isLoading &&
              !hasError &&
              cards.slice(0, 1).map((card, idx) => {
                const key = getCardKey(card, idx);
                const isExpanded = expandedId === key;

                return (
                  <motion.div
                    key={key}
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.div
                      layout
                      layoutId={`card-${key}`}
                      onClick={() =>
                        isExpanded ? handleCollapse() : handleExpand(key)
                      }
                      className="cursor-pointer  my-5 md:mt-10 "
                      style={{
                        zIndex: isExpanded ? 20 : 1,
                        pointerEvents: isExpanded ? "none" : "auto",
                      }}
                      animate={{
                        scale: isExpanded ? 1 : 0.98,
                        opacity: isExpanded ? 0 : 1,
                        boxShadow: isExpanded
                          ? "0 18px 50px rgba(0,0,0,0.18)"
                          : "0 8px 25px rgba(0,0,0,0.08)",
                      }}
                      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                      whileHover={{ scale: 1.005 }}
                    >
                      <Card
                        {...card}
                        isExpanded={isExpanded}
                        onExpand={(tabKey) => handleExpand(key, tabKey)}
                        resetSignal={resetSignals[idx]}
                        onTabChangeExternal={() => handleExternalTabChange(idx)}
                        contentHoverKeepsImage
                      />
                    </motion.div>
                  </motion.div>
                );
              })}

            {!isLoading && !hasError && !cards.length && (
              <p className="col-span-full text-gray-500 text-sm">
                Aucune carte a afficher.
              </p>
            )}
          </div>
          <div
            ref={cardsGridRef}
             style={{
              background: layoutBgColor,
              minHeight: 20,
              borderRadius: borderRadiusLG,
              marginTop: 0,
            }}
            className="py-5 px-5 md:p-5 grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-6 items-start"
          >
            {!isLoading &&
              !hasError &&
              cards.slice(1).map((card, idx) => {
                const key = getCardKey(card, idx);
                const isExpanded = expandedId === key;
                const wobble = (idx % cardsPerRow) - 1;
                const tilt = idx % 2 === 0 ? 0 : 0;

                return (
                  <motion.div
                    key={key}
                    initial={{ y: 50, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.div
                      layout
                      layoutId={`card-${key}`}
                      onClick={() =>
                        isExpanded ? handleCollapse() : handleExpand(key)
                      }
                      className="cursor-pointer"
                      style={{
                        zIndex: isExpanded ? 20 : 1,
                        pointerEvents: isExpanded ? "none" : "auto",
                      }}
                      animate={{
                        scale: isExpanded ? 1 : 0.98,
                        rotate: isExpanded ? 0 : tilt,
                        y: isExpanded ? 0 : wobble * 10,
                        opacity: isExpanded ? 0 : 1,
                        boxShadow: isExpanded
                          ? "0 18px 50px rgba(0,0,0,0.18)"
                          : "0 8px 25px rgba(0,0,0,0.08)",
                      }}
                      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                      whileHover={{ scale: 1.005 }}
                    >
                      <Card
                        {...card}
                        isExpanded={isExpanded}
                        onExpand={(tabKey) => handleExpand(key, tabKey)}
                        resetSignal={resetSignals[idx]}
                        onTabChangeExternal={() => handleExternalTabChange(idx)}
                        contentHoverKeepsImage
                      />
                    </motion.div>
                  </motion.div>
                );
              })}
          </div>
          <AnimatePresence>
            {expandedCard && (
              <motion.div
                key="overlay"
                className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCollapse}
              >
                <motion.div
                  layoutId={`card-${expandedId}`}
                  className="relative w-full max-w-5xl max-h-[calc(85vh-2rem)] overflow-y-auto"
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <motion.div
                    style={{
                      position: "absolute",
                      top: "clamp(0px, 3vw, 20px)",
                      right: "clamp(0px, 3vw, 20px)",
                      zIndex: 50,
                    }}
                    whileHover={{ scale: 1.2 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <Button
                      type="text"
                      shape="circle"
                      icon={<CloseOutlined />}
                      aria-label="Fermer la carte"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCollapse();
                      }}
                    />
                  </motion.div>
                  <Card
                    {...expandedCard}
                    isExpanded={true}
                    initialActiveTabKey={expandedTabKey}
                    resetSignal={resetSignals[expandedIndex] ?? 0}
                    onTabChangeExternal={() =>
                      handleExternalTabChange(expandedIndex)
                    }
                    contentHoverKeepsImage
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </Content>
    </Layout>
  );
};

export default App;

function Accueil({ titre }) {
  const containerRef = useRef(null);
  const labelRef = useRef(null);
  const titleRef = useRef(null);
  const [titleFontSizePx, setTitleFontSizePx] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fitTitle = () => {
      const containerEl = containerRef.current;
      const labelEl = labelRef.current;
      const titleEl = titleRef.current;
      if (!containerEl || !titleEl) return;

      const availableWidth = containerEl.clientWidth;
      const availableHeight =
        containerEl.clientHeight - (labelEl?.offsetHeight || 0);
      if (availableWidth <= 0 || availableHeight <= 0) return;

      const MAX_PX = 60; // tailwind text-6xl ~= 60px
      const MIN_PX = 12;

      const previousFontSize = titleEl.style.fontSize;
      const previousMaxWidth = titleEl.style.maxWidth;

      // Assure une mesure fiable + casse des mots très longs
      titleEl.style.maxWidth = "100%";

      const fits = (px) => {
        titleEl.style.fontSize = `${px}px`;
        return (
          titleEl.scrollWidth <= availableWidth &&
          titleEl.scrollHeight <= availableHeight
        );
      };

      let low = MIN_PX;
      let high = MAX_PX;
      let best = MIN_PX;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (fits(mid)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      titleEl.style.fontSize = previousFontSize;
      titleEl.style.maxWidth = previousMaxWidth;
      setTitleFontSizePx((prev) => (prev === best ? prev : best));
    };

    const run = () => {
      // Deux frames pour laisser Framer Motion appliquer ses styles initiaux.
      requestAnimationFrame(() => requestAnimationFrame(fitTitle));
    };

    run();
    const afterAnimation = window.setTimeout(run, 2200);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => run())
        : null;
    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    } else {
      window.addEventListener("resize", run);
    }

    return () => {
      window.clearTimeout(afterAnimation);
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener("resize", run);
      }
    };
  }, [titre]);

  return (
    <div
      ref={containerRef}
      className=" h-55 flex flex-col justify-center  my-5 md:mt-10  mx-7 overflow-hidden"
    >
      <motion.p
        ref={labelRef}
        initial={{
          opacity: 0,
          x: 0,
          y: 100,
          letterSpacing: "0px",
          clipPath: "inset(0 0 100% 0)",
          filter: "blur(12px)",
        }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
          letterSpacing: "5px",
          clipPath: "inset(0 0 0% 0)",
          filter: "blur(0px)",
        }}
        transition={{
          duration: 1.9,
          ease: [0.16, 1, 0.3, 1],
          delay: 0.05,
        }}
        className=" leading-tight text-2xl"
        whileHover={{ x: 5 }}
      >
        Chapitre en cours :
      </motion.p>
      <motion.p
        ref={titleRef}
        initial={{
          opacity: 0,
          x: 0,
          y: 100,
          letterSpacing: "0px",
          clipPath: "inset(0 0 100% 0)",
          filter: "blur(12px)",
        }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
          letterSpacing: "3px",
          clipPath: "inset(0 0 0% 0)",
          filter: "blur(0px)",
        }}
        transition={{
          duration: 1.9,
          ease: [0.16, 1, 0.3, 1],
          delay: 0.05,
        }}
        className="text-center leading-tight text-6xl font-script break-words"
        whileHover={{ x: 5 }}
        style={{
          fontSize: titleFontSizePx ? `${titleFontSizePx}px` : undefined,
          overflowWrap: "anywhere",
        }}
      >
        {titre}
      </motion.p>
    </div>
  );
}

