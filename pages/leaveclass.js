"use client";
import React, { useState } from "react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const EXPECTED_PHRASE = `JE VEUX ME DESINSCRIRE DE CETTE CLASSE`;

export default function LeaveClass() {
  const router = useRouter();
  const from = Array.isArray(router.query?.from)
    ? router.query.from[0]
    : router.query?.from;
  const shouldReturnToIndexBis = from === "home";
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const [confirmText, setConfirmText] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const normalizedConfirm = confirmText.trim().toUpperCase();
  const canLeave = normalizedConfirm === EXPECTED_PHRASE;
  const busy = isLoading;

  const handleReturn = () => {
    if (shouldReturnToIndexBis) {
      router.push("/indexbis");
      return;
    }
    router.back();
  };

  const handleLeaveClass = async () => {
    if (busy || !canLeave) return;

    const classId = user?.classId ? String(user.classId) : "";
    if (!classId) {
      setMessage("Classe introuvable. Merci de te reconnecter.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/users/leave-class`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(json.message || "Désinscription réalisée");
        setTimeout(() => router.push("/"), 1200);
        return;
      }

      if (Array.isArray(json.errors) && json.errors.length) {
        setMessage(
          json.errors[0]?.message ||
            "Impossible de se désinscrire de cette classe",
        );
        return;
      }

      setMessage(
        json.message || "Impossible de se désinscrire de cette classe",
      );
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#b8b8b6" }}
    >
      <div
        className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 relative"
        aria-busy={busy}
      >
        <h2 className="text-2xl font-semibold text-center mb-6">
          Se désinscrire de la classe de {user?.name}
        </h2>
        <p>
          Pour te désinscrire de la classe {user?.name}, écris dans le champ
          ci-dessous : "{EXPECTED_PHRASE}"
        </p>

        {message && <p className="text-center mt-4 text-blue-600">{message}</p>}

        <div className="text-center mt-4 space-y-4">
          <input
            type="text"
            placeholder={EXPECTED_PHRASE}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={busy || !isAuthenticated}
            className="w-full border rounded px-3 py-2   focus:bg-white text-red-500 placeholder:text-red-300 focus:outline-none focus:ring-1 focus:ring-red-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={handleLeaveClass}
            disabled={!canLeave || busy || !isAuthenticated}
            className={`w-full py-2 text-white rounded disabled:bg-gray-300 ${
              canLeave && !busy ? "bg-red-500 hover:bg-red-600" : "bg-gray-300"
            }`}
          >
            {busy ? "Désinscription..." : "Se désinscrire"}
          </button>
        </div>

        <div className="text-right mt-4">
          <button
            type="button"
            onClick={handleReturn}
            className={`text-sm ${
              busy ? "text-gray-400" : "text-blue-600 hover:underline"
            }`}
          >
            Retour à la page précédente
          </button>
        </div>

        {busy && (
          <div className="absolute inset-0 rounded-xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <ClimbingBoxLoader color="#6C6C6C" size={11} speedMultiplier={1} />
          </div>
        )}
      </div>
    </div>
  );
}
