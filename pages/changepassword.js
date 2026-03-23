"use client";
import React, { useState, useEffect, useRef } from "react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import zxcvbn from "zxcvbn";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { createSessionExpiredRedirect } from "../utils/auth";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

// ✅ Schéma de validation
const schema = yup.object().shape({
  oldPassword: yup.string().required("Ancien mot de passe obligatoire"),
  newPassword: yup
    .string()
    .min(8, "8 caractères minimum")
    .matches(/[A-Z]/, "Une majuscule requise")
    .matches(/[a-z]/, "Une minuscule requise")
    .matches(/[0-9]/, "Un chiffre requis")
    .matches(/[^A-Za-z0-9]/, "Un caractère spécial requis")
    .required("Nouveau mot de passe obligatoire"),
  confirmPassword: yup
    .string()
    .oneOf(
      [yup.ref("newPassword"), null],
      "Les mots de passe ne correspondent pas"
    )
    .required("Confirmation obligatoire"),
});

export default function ChangePassword() {
  const router = useRouter();
  const dispatch = useDispatch();
  const from = Array.isArray(router.query?.from)
    ? router.query.from[0]
    : router.query?.from;
  const shouldReturnToIndexBis = from === "home";
  const [oldPasswordVisible, setOldPasswordVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isVeilVisible, setIsVeilVisible] = useState(false);
  const sessionExpiredRef = useRef(null);

  if (!sessionExpiredRef.current) {
    sessionExpiredRef.current = createSessionExpiredRedirect({
      dispatch,
      router,
      notify: setMessage,
      delayMs: 3000,
    });
  }

  const handleSessionExpired = () => sessionExpiredRef.current?.trigger?.();

  // 🔹 Indicateurs de robustesse
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordRules, setPasswordRules] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onChange",
  });

  const newPassword = watch("newPassword", "");
  const busy = isLoading || isSubmitting;

  const getHoldToRevealButtonProps = (setVisible) => ({
    onPointerDown: (event) => {
      event.preventDefault();
      setVisible(true);
      try {
        event.currentTarget?.setPointerCapture?.(event.pointerId);
      } catch {}
    },
    onPointerUp: (event) => {
      setVisible(false);
      try {
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
      } catch {}
    },
    onPointerCancel: () => setVisible(false),
    onPointerLeave: () => setVisible(false),
    onLostPointerCapture: () => setVisible(false),
    onBlur: () => setVisible(false),
    onKeyDown: (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      setVisible(true);
    },
    onKeyUp: (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      setVisible(false);
    },
    onClick: (event) => event.preventDefault(),
  });

  // ✅ Vérifie en direct la robustesse
  useEffect(() => {
    setPasswordRules({
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    });
    setPasswordStrength(zxcvbn(newPassword).score);
  }, [newPassword]);

  useEffect(() => {
    setIsCardVisible(true);
    const veilTimeout = setTimeout(() => setIsVeilVisible(true), 1000);
    return () => clearTimeout(veilTimeout);
  }, []);

  // ✅ Labels et couleurs pour la jauge
  const getStrengthLabel = (score) => {
    const labels = ["Très faible", "Faible", "Moyen", "Bon", "Excellent"];
    const colors = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#16a34a"];
    return (
      <div className="mt-2">
        <div className="h-2 rounded bg-gray-200 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${(score + 1) * 20}%`,
              backgroundColor: colors[score],
            }}
          />
        </div>
        <p className="text-sm mt-1" style={{ color: colors[score] }}>
          {labels[score]}
        </p>
      </div>
    );
  };

  // ✅ Liste des règles dynamiques
  const renderPasswordRules = () => {
    const rules = [
      { key: "length", label: "Au moins 8 caractères" },
      { key: "upper", label: "Une majuscule" },
      { key: "lower", label: "Une minuscule" },
      { key: "number", label: "Un chiffre" },
      { key: "special", label: "Un caractère spécial (!, $, #, ...)" },
    ];
    return (
      <ul className="mt-3 space-y-1 text-sm">
        {rules.map((rule) => (
          <li
            key={rule.key}
            className={`flex items-center gap-2 ${
              passwordRules[rule.key] ? "text-green-600" : "text-gray-500"
            }`}
          >
            {passwordRules[rule.key] ? "✅" : "❌"} {rule.label}
          </li>
        ))}
      </ul>
    );
  };

  // ✅ Vérification si l'utilisateur est connecté
  useEffect(() => {
    return () => sessionExpiredRef.current?.cancel?.();
  }, []);

  // ✅ Vérification si l'utilisateur est connecté
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${urlFetch}/users/me`, {
          method: "GET",
          credentials: "include",
        });
        if (res.status === 401) {
          handleSessionExpired();
          return;
        }
        if (!res.ok) {
          router.replace("/"); // redirige si non connecté
        }
      } catch (err) {
        router.replace("/");
      }
    };
    checkAuth();
  }, [dispatch, router]);

  const handleReturn = () => {
    if (shouldReturnToIndexBis) {
      router.push("/indexbis");
      return;
    }
    router.back();
  };

  // ✅ Soumission du formulaire
   
  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${urlFetch}/users/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: data.oldPassword,
          newPassword: data.newPassword,
        }),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage("Mot de passe changé avec succès ✅");
        reset();
        setPasswordStrength(0);
        setTimeout(() => handleReturn(), 2000);
      } else {
        if (res.status === 401 && typeof json?.remainingAttempts === "number") {
          setMessage(
            `${json.error || "Ancien mot de passe incorrect."} Il vous reste ${
              json.remainingAttempts
            } tentative(s).`
          );
        } else if (res.status === 401) {
          handleSessionExpired();
        } else {
          setMessage(
            json?.error ||
              json?.errors?.[0]?.message ||
              "Erreur lors du changement de mot de passe."
          );
        }
      }
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative w-full min-h-screen flex items-center justify-center p-4 bg-bg3 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-10 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${
          isVeilVisible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative z-20 w-full max-w-md bg-white shadow-2xl rounded-xl p-6 transform-gpu origin-top-right transition-transform transition-opacity duration-1000 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          isCardVisible
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none"
        }`}
        aria-busy={busy}
      >
      <h2 className="text-2xl font-semibold text-center mb-6">
        Changer le mot de passe
      </h2>

      {message && <p className="text-primary text-center mb-4">{message}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Ancien mot de passe */}
        <div>
          <label
            htmlFor="oldPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Ancien mot de passe
          </label>
          <div className="relative">
            <input
              id="oldPassword"
              type={oldPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              {...register("oldPassword")}
              className="w-full border rounded px-3 py-2 pr-10"
              disabled={busy}
            />
            <button
              type="button"
              {...getHoldToRevealButtonProps(setOldPasswordVisible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              disabled={busy}
              aria-label={
                oldPasswordVisible
                  ? "Relâchez pour masquer le mot de passe"
                  : "Maintenir pour afficher le mot de passe"
              }
            >
              {oldPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.oldPassword && (
            <p className="text-sm text-red-600 mt-1">
              {errors.oldPassword.message}
            </p>
          )}
        </div>

        {/* Nouveau mot de passe */}
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nouveau mot de passe
          </label>
          <div className="relative">
           <input
             id="newPassword"
             type={passwordVisible ? "text" : "password"}
             autoComplete="new-password"
             {...register("newPassword")}
             className="w-full border rounded px-3 py-2 pr-10"
             disabled={busy}
           />
           <button
            type="button"
            {...getHoldToRevealButtonProps(setPasswordVisible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            disabled={busy}
            aria-label={
              passwordVisible
                ? "Relâchez pour masquer le mot de passe"
                : "Maintenir pour afficher le mot de passe"
            }
          >
              {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
           </div>

          {errors.newPassword && (
            <p className="text-sm text-red-600 mt-1">
              {errors.newPassword.message}
            </p>
          )}

          {renderPasswordRules()}
          {newPassword && getStrengthLabel(passwordStrength)}
        </div>

        {/* Confirmation */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirmer le nouveau mot de passe
          </label>
          <div className="relative">
           <input
             id="confirmPassword"
             type={confirmVisible ? "text" : "password"}
             autoComplete="new-password"
             {...register("confirmPassword")}
             className="w-full border rounded px-3 py-2 pr-10"
             disabled={busy}
           />
           <button
              type="button"
            {...getHoldToRevealButtonProps(setConfirmVisible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            disabled={busy}
            aria-label={
              confirmVisible
                ? "Relâchez pour masquer le mot de passe"
                : "Maintenir pour afficher le mot de passe"
            }
          >
              {confirmVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
           </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-600 mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!isValid || busy}
            className=" w-full mt-2 py-3 text-lg rounded-lg bg-bouton text-gray-100 font-semibold hover:bg-slate-300 hover:text-gray-800 disabled:bg-gray-300"
        >
          {isLoading ? "Mise à jour..." : "Changer le mot de passe"}
        </button>

        <div className="text-right ">
          <button
            type="button"
            onClick={handleReturn}
            disabled={busy}
            className={`text-sm font-medium ${busy ? "text-gray-400" : "text-primary hover:underline"} `}
          >
            Retour à la page précédente
          </button>
        </div>
      </form>

      {busy && (
        <div className="absolute inset-0 rounded-xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <ClimbingBoxLoader color="#6C6C6C" size={11} speedMultiplier={1} />
        </div>
      )}
      </div>
    </div>
  );
}
