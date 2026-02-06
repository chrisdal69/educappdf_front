import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layout, Menu, theme } from "antd";
import { CloseOutlined, MenuOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import Modal from "./Modal";

const { Header } = Layout;
const DEFAULT_TABS = ["Maths"];

const stripAccents = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const toSlug = (value) =>
  stripAccents(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildTabs = (rawTabs) => {
  const sourceTabs =
    Array.isArray(rawTabs) && rawTabs.length ? rawTabs : DEFAULT_TABS;

  return sourceTabs
    .map((tab) => (typeof tab === "string" ? tab.trim() : ""))
    .filter(Boolean)
    .map((label, index) => ({
      label,
      slug: toSlug(label) || `onglet-${index + 1}`,
    }));
};

export default function Nav(props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [useMobileMenu, setUseMobileMenu] = useState(false);
  const headerWidthRef = useRef(null);
  const menuMeasureRef = useRef(null);
  const router = useRouter();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const isAdmin = isAuthenticated && user?.role === "admin";
  const tabs = isAuthenticated ? buildTabs(user?.tabs) : [];
  const tabsSignature = useMemo(
    () => tabs.map((tab) => tab.slug).join("|"),
    [tabs]
  );
  const menuSignature = useMemo(() => {
    const roleKey = isAdmin ? "admin" : "user";
    const authKey = isAuthenticated ? "auth" : "guest";
    const nameKey = isAuthenticated ? `${user?.prenom || ""}|${user?.nom || ""}` : "";
    return `${authKey}|${roleKey}|${tabsSignature}|${nameKey}`;
  }, [isAdmin, isAuthenticated, tabsSignature, user?.nom, user?.prenom]);
  const slugToTab = tabs.reduce((acc, tab, index) => {
    acc[tab.slug] = String(index + 2);
    return acc;
  }, {});
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const pathToKey = {
    "/signup": "account",
    "/forgot": "account",
    "/changepassword": "account",
  };

  const isDynamicRoute =
    router.pathname === "/[repertoire]" ||
    router.pathname === "/admin/[repertoire]";

  const rawRepertoire = Array.isArray(router.query.repertoire)
    ? router.query.repertoire[0]
    : router.query.repertoire;
  const dynamicKey = slugToTab[rawRepertoire];

  const selectedKey = !router.isReady
    ? undefined
    : router.pathname === "/admin"
    ? undefined
    : isDynamicRoute
    ? router.pathname === "/admin/[repertoire]"
      ? dynamicKey
        ? `admin:${dynamicKey}`
        : undefined
      : dynamicKey
    : pathToKey[router.pathname];

  const selectedKeys = selectedKey ? [selectedKey] : [];

  const publicItems = tabs.map((tab, index) => ({
    key: String(index + 2),
    label: <Link href={`/${tab.slug}`}>{tab.label}</Link>,
    className: "nav-item",
  }));

  const adminItems = isAdmin
    ? tabs.map((tab, index) => ({
        key: `admin:${index + 2}`,
        label: <Link href={`/admin/${tab.slug}`}>{`A_${tab.label}`}</Link>,
        className: "nav-item",
      }))
    : [];

  const items = [
    ...publicItems,
    ...adminItems,
    {
      key: "account",
      icon: <UserOutlined style={{ fontSize: 24 }} />,
      label: <Modal />,
      className: "nav-item nav-item--last",
    },
  ];

  useEffect(() => {
    if (!useMobileMenu && menuOpen) {
      setMenuOpen(false);
    }
  }, [menuOpen, useMobileMenu]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let rafId;
    const MIN_MOBILE_PX = 570;
    const TOGGLE_RESERVE_PX = 56;
    const SAFETY_PX = 12;

    const computeUseMobileMenu = () => {
      const viewportWidth = window.innerWidth || 0;
      if (viewportWidth <= MIN_MOBILE_PX) {
        return true;
      }

      const headerWrapper = headerWidthRef.current;
      const headerElement = headerWrapper?.querySelector?.(".nav-header");
      const headerBoxWidth =
        headerElement?.getBoundingClientRect?.().width ||
        headerWrapper?.getBoundingClientRect?.().width ||
        viewportWidth;
      const headerStyles = headerElement ? window.getComputedStyle(headerElement) : null;
      const headerPaddingLeft = headerStyles ? Number.parseFloat(headerStyles.paddingLeft) : 0;
      const headerPaddingRight = headerStyles ? Number.parseFloat(headerStyles.paddingRight) : 0;
      const headerContentWidth = Math.max(
        0,
        headerBoxWidth - headerPaddingLeft - headerPaddingRight
      );

      const measureRoot = menuMeasureRef.current;
      const menuElement = measureRoot?.querySelector?.(".nav-menu--measure");
      const requiredWidth = menuElement?.getBoundingClientRect?.().width || 0;
      if (!requiredWidth) {
        return false;
      }

      return (
        requiredWidth + TOGGLE_RESERVE_PX + SAFETY_PX > headerContentWidth
      );
    };

    const scheduleUpdate = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setUseMobileMenu(computeUseMobileMenu());
        });
      });
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);

    let resizeObserver;
    if (typeof window.ResizeObserver !== "undefined") {
      resizeObserver = new window.ResizeObserver(() => scheduleUpdate());
      if (headerWidthRef.current) {
        resizeObserver.observe(headerWidthRef.current);
      }
      if (menuMeasureRef.current) {
        resizeObserver.observe(menuMeasureRef.current);
      }
    }

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [menuSignature]);

  const navColors = {
    bg: props.bg,
    border: "#222",
    tabBorder: "#000",
    text: "#333",
    textSize: "20px",
    selectedBg: props.selectedBg,
    selectedText: "#0f172a",
    hoverBg: "#fff",
  };

  return (
    <div className={`nav-root${useMobileMenu ? " nav-root--mobile" : ""}`}>
      <div className="nav-measure" aria-hidden="true">
        <div ref={menuMeasureRef}>
          <Menu
            className="nav-menu nav-menu--measure"
            theme="dark"
            mode="horizontal"
            selectedKeys={selectedKeys}
            items={items}
          />
        </div>
      </div>

      <div ref={headerWidthRef}>
        <Header
          className="nav-header"
          style={{ display: "flex", alignItems: "center" }}
        >
          <Menu
            className="nav-menu nav-menu--desktop"
            theme="dark"
            mode="horizontal"
            selectedKeys={selectedKeys}
            items={items}
            style={{ flex: 1, justifyContent: "flex-end" }}
          />
          <button
            type="button"
            className="nav-toggle"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseOutlined /> : <MenuOutlined />}
          </button>
        </Header>
      </div>
      <div
        className={`nav-drawer ${menuOpen ? "nav-drawer--open" : ""}`}
        id="nav-drawer"
      >
        <Menu
          className="nav-menu nav-menu--mobile"
          theme="dark"
          mode="vertical"
          selectedKeys={selectedKeys}
          items={items}
          onClick={() => setMenuOpen(false)}
        />
      </div>
      <style jsx global>{`
        .nav-root {
          position: relative;
          width: 100%;
        }
        .nav-measure {
          position: fixed;
          left: -10000px;
          top: -10000px;
          visibility: hidden;
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }
        .nav-measure > div {
          display: inline-block;
        }
        .nav-measure .nav-menu--measure.ant-menu {
          display: inline-flex;
          width: max-content;
        }
        .nav-header {
          background: ${navColors.bg};
          border-bottom: 0px solid ${navColors.border};
        }
        .nav-toggle {
          border: none;
          background: transparent;
          color: ${navColors.text};
          font-size: 30px;
          width: 44px;
          height: 44px;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          margin-left: -30px;
          margin-top: 10px;
        }
        .nav-root--mobile .nav-menu--desktop {
          display: none;
        }
        .nav-root--mobile .nav-toggle {
          display: inline-flex;
        }
        .nav-drawer {
          position: absolute;
          top: 100%;
          left: 0;
          width: 180px;
          background: ${navColors.bg};
          border-radius: 5px;
          padding: 0px 0;
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.2);
          z-index: 30;
          transform: translateX(-100%);
          opacity: 0;
          pointer-events: none;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 200ms ease;
        }
        .nav-drawer--open {
          transform: translateX(0);
          opacity: 1;
          pointer-events: auto;
        }
        .nav-menu.ant-menu {
          background: transparent;
          --nav-border-duration: 650ms;
          --nav-text-duration: 900ms;
          --nav-text-delay: calc(var(--nav-border-duration) + 140ms);
        }
        .nav-menu.ant-menu-dark .ant-menu-item,
        .nav-menu.ant-menu-dark .ant-menu-item a,
        .nav-menu.ant-menu-dark .ant-menu-item .anticon {
          color: ${navColors.text};
          font-size: ${navColors.textSize};
        }
        .nav-menu.ant-menu-dark .nav-item {
          position: relative;
          overflow: hidden;
        }
        .nav-menu.ant-menu-dark .nav-item::before {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 1px;
          height: 100%;
          background: #111;
          transform: scaleY(0);
          transform-origin: top;
          animation: navBorderDown var(--nav-border-duration)
            cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .nav-menu.ant-menu-dark .nav-item--last::before {
          display: none;
        }
        .nav-menu.ant-menu-dark .ant-menu-item {
          --nav-item-delay: 0ms;
        }
        .nav-menu.ant-menu-dark .ant-menu-item:nth-child(2) {
          --nav-item-delay: 80ms;
        }
        .nav-menu.ant-menu-dark .ant-menu-item:nth-child(3) {
          --nav-item-delay: 160ms;
        }
        .nav-menu.ant-menu-dark .ant-menu-item:nth-child(4) {
          --nav-item-delay: 240ms;
        }
        .nav-menu.ant-menu-dark .ant-menu-item .ant-menu-title-content,
        .nav-menu.ant-menu-dark .ant-menu-item .anticon {
          display: inline-block;
          opacity: 0;
          transform: translateY(100%);
          animation: navTextUp var(--nav-text-duration)
            cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: calc(var(--nav-text-delay) + var(--nav-item-delay));
          will-change: transform, opacity;
        }

        .nav-menu.ant-menu-dark .ant-menu-item-selected {
          background: ${navColors.selectedBg};
        }
        .nav-menu.ant-menu-dark .ant-menu-item-selected a,
        .nav-menu.ant-menu-dark .ant-menu-item-selected .anticon {
          color: ${navColors.selectedText};
        }
        .nav-menu.ant-menu-dark .ant-menu-item::after,
        .nav-menu.ant-menu-dark .ant-menu-item-active::after,
        .nav-menu.ant-menu-dark .ant-menu-item-selected::after {
          border-color: ${navColors.tabBorder};
        }
        .nav-menu.ant-menu-dark .ant-menu-item:hover {
          background: ${navColors.hoverBg};
        }
        .nav-menu--mobile.ant-menu-dark
          .ant-menu-item:not(.ant-menu-item-selected):hover,
        .nav-menu--mobile.ant-menu-dark .ant-menu-item-active {
          background: ${navColors.hoverBg};
        }
        .nav-menu--mobile.ant-menu {
          background: transparent;
          border-right: none;
          width: 100%;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item {
          margin: 0;
          width: 100%;
          padding: 14px 12px;
          height: auto;
          line-height: 1.2;
          border-bottom: 1px solid #111;
          border-radius: 0;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item:last-child {
          border-bottom: 0;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item,
        .nav-menu--mobile.ant-menu-dark .ant-menu-item a,
        .nav-menu--mobile.ant-menu-dark .ant-menu-item .anticon {
          white-space: nowrap;
        }
        .nav-menu--mobile.ant-menu-dark .nav-item {
          overflow: visible;
        }
        .nav-menu--mobile.ant-menu-dark .nav-item::before {
          display: none;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item::after,
        .nav-menu--mobile.ant-menu-dark .ant-menu-item-selected::after {
          border: none;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content {
          display: block;
          width: 100%;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content > a,
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content > span,
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content > .ant-btn {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content > a,
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content > span {
          padding: 0;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content > .ant-btn {
          padding: 6px 20px;
          width: 70%;
          margin-left: 7px;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-title-content > .ant-btn {
          white-space: nowrap;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item .ant-menu-title-content,
        .nav-menu--mobile.ant-menu-dark .ant-menu-item .anticon {
          opacity: 0;
          transform: none;
          animation: none;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item {
          --nav-mobile-delay: 0ms;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item:nth-child(2) {
          --nav-mobile-delay: 80ms;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item:nth-child(3) {
          --nav-mobile-delay: 160ms;
        }
        .nav-menu--mobile.ant-menu-dark .ant-menu-item:nth-child(4) {
          --nav-mobile-delay: 240ms;
        }
        .nav-drawer--open
          .nav-menu--mobile.ant-menu-dark
          .ant-menu-item
          .ant-menu-title-content,
        .nav-drawer--open
          .nav-menu--mobile.ant-menu-dark
          .ant-menu-item
          .anticon {
          animation: navMobileTextIn 420ms ease forwards;
          animation-delay: calc(160ms + var(--nav-mobile-delay));
        }
        @keyframes navBorderDown {
          from {
            transform: scaleY(0);
          }
          to {
            transform: scaleY(1);
          }
        }
        @keyframes navTextUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes navMobileTextIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-menu.ant-menu-dark .nav-item::before {
            animation: none;
            transform: scaleY(1);
          }
          .nav-menu.ant-menu-dark .ant-menu-item .ant-menu-title-content,
          .nav-menu.ant-menu-dark .ant-menu-item .anticon {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .nav-drawer--open
            .nav-menu--mobile.ant-menu-dark
            .ant-menu-item
            .ant-menu-title-content,
          .nav-drawer--open
            .nav-menu--mobile.ant-menu-dark
            .ant-menu-item
            .anticon {
            animation: none;
            opacity: 1;
          }
          .nav-drawer {
            transition: none;
          }
        }
        @media (max-width: 570px) {
          .nav-menu--desktop {
            display: none;
          }
          .nav-toggle {
            display: inline-flex;
          }
        }
      `}</style>
    </div>
  );
}
