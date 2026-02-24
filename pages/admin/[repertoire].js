import { useRouter } from "next/router";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import HomeForm from "../../components/admin/HomeForm";
import Nav from "../../components/Nav";
import themeTokens from "../../themeTokens";

const stripAccentsLower = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const toSlug = (value) =>
  stripAccentsLower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function AdminPage() {
  const { query, isReady } = useRouter();
  const repertoire = Array.isArray(query.repertoire)
    ? query.repertoire[0]
    : query.repertoire;
  const repSlug = typeof repertoire === "string" ? repertoire.trim() : "";
  const repertoiresFromDb = useSelector((state) => state.cardsMaths.data?.repertoires);
  const navBg = useMemo(() => {
    const defaultBg = themeTokens?.colors?.bg || "#e6eaea";
    if (!repSlug) return defaultBg;

    const reps = Array.isArray(repertoiresFromDb) ? repertoiresFromDb : [];
    const match = reps.find((rep) => toSlug(rep?.repertoire) === repSlug);
    const color = typeof match?.bgcolor === "string" ? match.bgcolor.trim() : "";
    return color || defaultBg;
  }, [repSlug, repertoiresFromDb]);

  if (!isReady) {
    return <main className="mt-12">Chargement...</main>;
  }

  return (
    <>
      <Nav bg={navBg} selectedBg="#c2cbcf" />
      <HomeForm nomRepertoire={repertoire} />
    </>
  );
}

export default AdminPage;
