"use client";
import { useRouter } from "next/router";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

export default function ManageClass() {
  const router = useRouter();
  const from = Array.isArray(router.query?.from)
    ? router.query.from[0]
    : router.query?.from;
  const shouldReturnToIndexBis = from === "home";

  const handleReturn = () => {
    if (shouldReturnToIndexBis) {
      router.push("/indexbis");
      return;
    }
    router.back();
  };

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#b8b8b6" }}
    >
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 relative flex flex-col">
        <h2 className="text-2xl font-semibold text-center mb-6">
          Gérer ma classe
        </h2>
        <button
          type="button"
          onClick={handleReturn}
          className="text-blue-600 hover:underline "
        >
          Retour à la page précédente
        </button>
      </div>
      <div className="text-center mt-4"></div>
    </div>
  );
}
