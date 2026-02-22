"use client";
import React, { useEffect, useState } from "react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { clearAuth } from "../reducers/authSlice";
import { setCardsMaths } from "../reducers/cardsMathsSlice";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

const EXPECTED_PHRASE = "JE VEUX SUPPRIMER MON COMPTE MATHSAPP";

export default function DeleteAccount() {
  const router = useRouter();
  const dispatch = useDispatch();
  const from = Array.isArray(router.query?.from)
    ? router.query.from[0]
    : router.query?.from;
  const shouldReturnToIndexBis = from === "home";
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const [confirmText, setConfirmText] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isVeilVisible, setIsVeilVisible] = useState(false);

  const normalizedConfirm = confirmText.trim().toUpperCase();
  const canDelete = normalizedConfirm === EXPECTED_PHRASE;
  const busy = isLoading;

  useEffect(() => {
    setIsCardVisible(true);
    const veilTimeout = setTimeout(() => setIsVeilVisible(true), 1000);
    return () => clearTimeout(veilTimeout);
  }, []);

  const handleReturn = () => {
    if (shouldReturnToIndexBis) {
      router.push("/indexbis");
      return;
    }
    router.back();
  };

  const handleDeleteAccount = async () => {
    if (busy || !canDelete) return;

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/users/delete-account`, {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        setMessage(json.message || "Suppression de compte réalisée");
        dispatch(clearAuth());
        dispatch(setCardsMaths([]));
        setTimeout(() => router.push("/"), 1200);
        return;
      }

      setMessage(json.message || "Désinscription impossible");
    } catch (err) {
      setMessage("Désinscription impossible");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative w-full min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ backgroundColor: "#b8b8b6" }}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-10 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${
          isVeilVisible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative z-20 w-full max-w-md bg-white shadow-lg rounded-xl p-6 transform-gpu origin-top-right transition-transform transition-opacity duration-1000 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          isCardVisible
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none"
        }`}
        aria-busy={busy}
      >
        <h2 className="text-2xl font-semibold text-center mb-6">
          Supprimer mon compte MathsApp
        </h2>
        <p>
          Pour supprimer DEFINITIVEMENT ton compte MathsApp, écris dans le champ
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
            onClick={handleDeleteAccount}
            disabled={!canDelete || busy || !isAuthenticated}
            className={`w-full py-2 text-white rounded disabled:bg-gray-300 ${
              canDelete && !busy ? "bg-red-500 hover:bg-red-600" : "bg-gray-300"
            }`}
          >
            {busy ? "Suppression..." : "Supprimer définitivement"}
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
