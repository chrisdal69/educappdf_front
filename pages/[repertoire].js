import { useRouter } from "next/router";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ConfigProvider } from "antd";
import Home from "../components/Home";
import Nav from "../components/Nav";
import themeTokens from "../themeTokens";

const stripAccentsLower = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const toSlug = (value) =>
  stripAccentsLower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function Page() {
  const { query, isReady } = useRouter();
  const repertoire = Array.isArray(query.repertoire)
    ? query.repertoire[0]
    : query.repertoire;
  const repSlug = typeof repertoire === "string" ? repertoire.trim() : "";
  const repertoiresFromDb = useSelector((state) => state.cardsMaths.data?.repertoires);
  const repTheme = useMemo(() => {
    const defaultBg = themeTokens?.colors?.bg || "#e6eaea";
    const defaultPrimary = themeTokens?.colors?.primary || "#30675f";
    const defaultSelectedBg = "#c2cbcf";
    if (!repSlug) {
      return {
        bgcolor: defaultBg,
        primary: defaultPrimary,
        selectedBg: defaultSelectedBg,
      };
    }

    const reps = Array.isArray(repertoiresFromDb) ? repertoiresFromDb : [];
    const match = reps.find((rep) => toSlug(rep?.repertoire) === repSlug);
    const bg = typeof match?.bgcolor === "string" ? match.bgcolor.trim() : "";
    const primary =
      typeof match?.primary === "string" ? match.primary.trim() : "";
    const selectedBg =
      typeof match?.selectedBg === "string" ? match.selectedBg.trim() : "";

    return {
      bgcolor: bg || defaultBg,
      primary: primary || defaultPrimary,
      selectedBg: selectedBg || defaultSelectedBg,
    };
  }, [repSlug, repertoiresFromDb]);
  const navBg = repTheme?.bgcolor || (themeTokens?.colors?.bg || "#e6eaea");

  if (!isReady) {
    return <main className="mt-12">Chargement...</main>;
  }

  return (
    <>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: repTheme?.primary || themeTokens?.colors?.primary || "#30675f",
            colorBgLayout: navBg,
          },
        }}
      >
        <Nav bg={navBg} selectedBg={repTheme?.selectedBg || "#c2cbcf"} />
        <Home repertoire={repertoire} />
      </ConfigProvider>
    </>
  );
}

export default Page;
