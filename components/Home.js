import React, { useState, useEffect, useRef } from "react";
import { Layout, theme, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
const { Content } = Layout;
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import Card from "./Card";
import { useDispatch, useSelector } from "react-redux";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { fetchCardsMaths } from "../reducers/cardsMathsSlice";

const CARD_MIN_WIDTH = 380;

const App = ({ repertoire }) => {
  let {
    token: { colorBgLayout,colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const dispatch = useDispatch();
  const { data, status, error } = useSelector((state) => state.cardsMaths);
  const activeClassId = useSelector((state) => state.auth?.user?.classId);
  const loadedClassId = useSelector((state) => state.cardsMaths.data?.__classId);
  const cardsFiltre = Array.isArray(data?.result) ? data.result : [];
  const cards = cardsFiltre.filter((obj) => obj.repertoire === repertoire);

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
  }, [cards]);

  useEffect(() => {
    if (!activeClassId) {
      return;
    }

    const isStaleClass = String(loadedClassId || "") !== String(activeClassId);
    if (status === "idle" || (status === "succeeded" && isStaleClass)) {
      dispatch(fetchCardsMaths());
    }
  }, [activeClassId, dispatch, loadedClassId, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateAccueilVisibility = () => {
      setShowAccueil(window.innerWidth >= 810);
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
              background: colorBgLayout,
              minHeight: 20,
              paddingTop: 10,
              borderRadius: borderRadiusLG,
              marginTop: 0,
            }}
            className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-6 items-start "
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
              <p className="col-span-full text-red-500 text-sm">
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
                      className=" cursor-pointer mx-5 my-10 md:my-20"
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
              background: colorBgLayout,
              minHeight: 20,
              borderRadius: borderRadiusLG,
              marginTop: 0,
            }}
            className="py-5 md:p-5 grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-0 md:gap-6 items-start"
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
                      className="cursor-pointer m-5 "
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
  return (
    <div className=" h-55 flex flex-col justify-center  my-10 md:my-20  mx-7 overflow-hidden">
      <motion.p
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
        className="text-center leading-tight text-6xl font-script"
        whileHover={{ x: 5 }}
      >
        {titre}
      </motion.p>
    </div>
  );
}

