"use client";
import React, { useState, useEffect } from "react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import zxcvbn from "zxcvbn";
import { Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const CODE_TTL_MS = 7 * 60 * 1000;

// === Schémas de validation ===
const emailSchema = yup.object().shape({
  email: yup.string().email("Email invalide").required("Email obligatoire"),
});

const codeSchema = yup.object().shape({
  code: yup
    .string()
    .length(4, "Le code doit contenir 4 caractères")
    .required("Code obligatoire"),
});

const passwordSchema = yup.object().shape({
  newPassword: yup
    .string()
    .min(8, "8 caractères minimum")
    .matches(/[A-Z]/, "Une majuscule requise")
    .matches(/[a-z]/, "Une minuscule requise")
    .matches(/[0-9]/, "Un chiffre requis")
    .matches(/[^A-Za-z0-9]/, "Un caractère spécial requis")
    .required("Mot de passe obligatoire"),
  confirmPassword: yup
    .string()
    .oneOf(
      [yup.ref("newPassword"), null],
      "Les mots de passe ne correspondent pas"
    )
    .required("Confirmation obligatoire"),
});

export default function ForgotWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordRules, setPasswordRules] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false,
  });

  const schema =
    step === 1
      ? emailSchema
      : step === 2
      ? codeSchema
      : step === 3
      ? passwordSchema
      : null;

  const {
    register,
    handleSubmit,
    watch,
    resetField, // 👈 ajoute ici !
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onChange",
  });

  const newPassword = watch("newPassword", "");
  const busy = isLoading || isSubmitting;

  // ✅ Vérifie la robustesse du mot de passe
  useEffect(() => {
    if (step === 3) {
      setPasswordRules({
        length: newPassword.length >= 8,
        upper: /[A-Z]/.test(newPassword),
        lower: /[a-z]/.test(newPassword),
        number: /[0-9]/.test(newPassword),
        special: /[^A-Za-z0-9]/.test(newPassword),
      });
      setPasswordStrength(zxcvbn(newPassword).score);
    }
  }, [newPassword, step]);

  useEffect(() => {
    if (step !== 2 || !codeExpiresAt) return;

    const tick = () => {
      setRemainingMs(Math.max(0, codeExpiresAt - Date.now()));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [step, codeExpiresAt]);

  const remainingLabel = React.useMemo(() => {
    const totalSeconds = Math.floor((remainingMs || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(
      2,
      "0",
    )}`;
  }, [remainingMs]);

  useEffect(() => {
    if (step !== 2 || !codeExpiresAt) return;

    const msLeft = codeExpiresAt - Date.now();

    if (msLeft <= 0) {
      setMessage("Opération annulée");
      const redirectTimeout = setTimeout(() => router.push("/"), 1500);
      return () => clearTimeout(redirectTimeout);
    }

    let redirectTimeout = null;
    const expireTimeout = setTimeout(() => {
      setMessage("Opération annulée");
      redirectTimeout = setTimeout(() => router.push("/"), 1500);
    }, msLeft);

    return () => {
      clearTimeout(expireTimeout);
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, [step, codeExpiresAt, router]);

  // === ÉTAPE 1 : ENVOI EMAIL ===
  const onSubmitEmail = async (data) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${urlFetch}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        setEmail(data.email);
        setMessage("Un code a été envoyé à votre adresse email.");
        setCodeExpiresAt(Date.now() + CODE_TTL_MS);
        setRemainingMs(CODE_TTL_MS);
        setStep(2);
      } else {
        setMessage(json.error || "Erreur lors de l’envoi du code.");
      }
    } catch {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  // === ÉTAPE 2 : SAISIE DU CODE ===
  const onSubmitCode = (data) => {
    setCode(data.code);
    setMessage("Créer un nouveau mot de passe");
    setStep(3);
  };

  // === ÉTAPE 3 : NOUVEAU MOT DE PASSE ===
  const onSubmitPassword = async (data) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${urlFetch}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          newPassword: data.newPassword,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage("Mot de passe réinitialisé avec succès ✅");
        setStep(4);
        setTimeout(() => router.back(), 2000);
      } else {
        setMessage(json.error || "Erreur lors de la réinitialisation.");
      }
    } catch {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  // === Renvoyer le code ===
  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${urlFetch}/auth/resend-forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage("Nouveau code envoyé !");
        setCodeExpiresAt(Date.now() + CODE_TTL_MS);
        setRemainingMs(CODE_TTL_MS);
        resetField("code");
      } else {
        setMessage(json.error);
      }
    } catch {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  // === Indicateur de progression ===
  const steps = ["Email", "Code", "Nouveau mot de passe", "Succès"];

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

  const renderPasswordRules = () => (
    <ul className="mt-3 space-y-1 text-sm">
      {[
        { key: "length", label: "Au moins 8 caractères" },
        { key: "upper", label: "Une majuscule" },
        { key: "lower", label: "Une minuscule" },
        { key: "number", label: "Un chiffre" },
        { key: "special", label: "Un caractère spécial (!, $, #, ...)" },
      ].map((rule) => (
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

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "bg3" }}
    >
      <div
        className="w-full max-w-md bg-white shadow-2xl rounded-xl p-6 relative"
        aria-busy={isLoading || isSubmitting}
      >
      {/* Barre de progression */}
      <div className="flex justify-between mb-6">
        {steps.map((label, idx) => (
          <div key={idx} className="flex-1 text-center">
            <div
              className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                step >= idx + 1
                  ? "bg-primary text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              {idx + 1}
            </div>
            <p className="text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {message && (
        <p className="text-center text-sm text-primary mb-4">{message}</p>
      )}

      <AnimatePresence mode="wait">
        {/* ÉTAPE 1 - EMAIL */}
        {step === 1 && (
          <motion.form
            key="email"
            onSubmit={handleSubmit(onSubmitEmail)}
            className="space-y-5"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
          >
            <h2 className="text-xl font-semibold text-center mb-4">
              Réinitialiser le mot de passe
            </h2>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                {...register("email")}
                className="w-full border rounded px-3 py-2"
                disabled={busy}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={!isValid || busy}
              className="w-full py-3 my-3 bg-bouton rounded-lg text-white text-lg hover:bg-slate-300 hover:text-gray-800 disabled:bg-gray-300"
            >
              {isLoading ? "Envoi..." : "Envoyer le code"}
            </button>
            <div className=" text-right">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-sm text-primary hover:underline"
              >
                Retour  ?
              </button>
            </div>
          </motion.form>
        )}

        {/* ÉTAPE 2 - CODE */}
        {step === 2 && (
          <motion.form
            key="code"
            onSubmit={handleSubmit(onSubmitCode)}
            className="space-y-4 text-center"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
          >
            <h2 className="text-xl font-semibold mb-3">Saisir le code</h2>
            <p className="text-sm text-gray-600 mb-5">
              Code envoyé à <strong>{email}</strong>
            </p>
            <input
              type="text"
              maxLength={4}
              placeholder="Code"
              {...register("code")}
              className="border rounded px-4 py-2 text-center tracking-widest w-40 mx-auto"
              disabled={busy}
            />
            <p className="text-sm text-gray-600 ">
              Temps restant pour la saisie : {remainingLabel}
            </p>
            {errors.code && (
              <p className="text-sm text-red-600">{errors.code.message}</p>
            )}

            <div className="space-y-2 mt-4">
              <button
                type="submit"
                disabled={!isValid || busy || (codeExpiresAt && remainingMs <= 0)}
                className="w-full mb-5 py-3 bg-bouton rounded-xl text-white text-lg hover:bg-slate-300 hover:text-gray-800"
              >
                Valider le code
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={busy}
                className="w-full py-3 mb-5 text-lg bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300"
              >
                Renvoyer le code
              </button>
              {/* 🡸 Bouton Retour */}
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setMessage("");
                  setCodeExpiresAt(null);
                  setRemainingMs(0);
                }}
                disabled={busy}
                className="w-full py-2 text-lg flex items-center justify-center gap-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 mt-2"
              >
                <ArrowLeft size={16} /> Retour
              </button>
            </div>
          </motion.form>
        )}

        {/* ÉTAPE 3 - NOUVEAU MOT DE PASSE */}
        {step === 3 && (
          <motion.form
            key="password"
            onSubmit={handleSubmit(onSubmitPassword)}
            className="space-y-4"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
          >
            <h2 className="text-xl font-semibold text-center mb-4">
              Nouveau mot de passe
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={passwordVisible ? "text" : "password"}
                  {...register("newPassword")}
                  className="w-full border rounded px-3 py-2 pr-10"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-3 top-2 text-gray-500"
                  disabled={busy}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  type={confirmVisible ? "text" : "password"}
                  {...register("confirmPassword")}
                  className="w-full border rounded px-3 py-2 pr-10"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setConfirmVisible(!confirmVisible)}
                  className="absolute right-3 top-2 text-gray-500"
                  disabled={busy}
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
              className="w-full py-3 my-3 bg-bouton text-lg text-white rounded-xl hover:bg-slate-300 hovet-text-gray-800 disabled:bg-gray-300"
            >
              {isLoading ? "Mise à jour..." : "Changer le mot de passe"}
            </button>

            {/* 🡸 Bouton Retour */}
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setMessage("");
                resetField("code");
              }}
              className="w-full py-3 flex items-center justify-center gap-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 mt-3"
            >
              <ArrowLeft size={16} /> Retour
            </button>
          </motion.form>
        )}

        {/* ÉTAPE 4 - SUCCÈS */}
        {step === 4 && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <CheckCircle className="mx-auto text-green-500" size={48} />
            <h2 className="text-xl font-semibold mt-3">
              Mot de passe réinitialisé ✅
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              Redirection vers la page d'accueil ...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {(isLoading || isSubmitting) && (
        <div className="absolute inset-0 rounded-xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <ClimbingBoxLoader color="#6C6C6C" size={11} speedMultiplier={1} />
        </div>
      )}
      </div>
    </div>
  );
}
