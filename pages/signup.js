"use client";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import zxcvbn from "zxcvbn";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

// ✅ Validation schéma
const nameRegex = /^[\p{L}\s_-]+$/u;

const schema = yup.object().shape({
  nom: yup
    .string()
    .min(2, "Min 2 caractères")
    .matches(nameRegex, "Lettres, espaces, - ou _ uniquement")
    .required("Nom obligatoire"),
  prenom: yup
    .string()
    .min(2, "Min 2 caractères")
    .matches(nameRegex, "Lettres, espaces, - ou _ uniquement")
    .required("Prénom obligatoire"),
  email: yup.string().email("Email invalide").required("Email obligatoire"),
  password: yup
    .string()
    .min(8, "8 caractères minimum")
    .matches(/[A-Z]/, "1 majuscule requise")
    .matches(/[a-z]/, "1 minuscule requise")
    .matches(/[0-9]/, "1 chiffre requis")
    .matches(/[^A-Za-z0-9]/, "1 caractère spécial requis")
    .required("Mot de passe obligatoire"),
  confirmPassword: yup
    .string()
    .oneOf(
      [yup.ref("password"), null],
      "Les mots de passe ne correspondent pas",
    )
    .required("Confirmation requise"),
});

export default function SignupWizard() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  const {
    register,
    handleSubmit,
    resetField, // 👈 ajoute ici !
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onChange",
    defaultValues: {
      nom: "",
      prenom: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password", "");
  useEffect(() => {
    setPasswordRules({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    });
    setPasswordStrength(zxcvbn(password).score);
  }, [password]);

  // === API CALLS ===
  const onSubmitSignup = async (data) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${urlFetch}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        setEmail(data.email);
        setStep(2);
        setMessage("Un code a été envoyé à votre email.");
      } else {
        setMessage(json.error || "Erreur d'inscription.");
      }
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${urlFetch}/auth/verifmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const json = await res.json();
      if (res.ok) {
        setStep(3);
        setMessage("");
        setTimeout(() => router.push("/"), 2000);
      } else {
        setMessage(json.error || "Code invalide.");
        setVerificationCode("");
      }
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${urlFetch}/auth/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage("Nouveau code envoyé !");
        setVerificationCode("");
      } else {
        setMessage(json.error || "Erreur lors du renvoi.");
      }
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  // === BARRE DE PROGRESSION ===
  const steps = ["Inscription", "Vérification", "Succès"];
  // === MOT DE PASS : TEST en DIRECT ===
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
  return (
    <div
      className="w-full min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#b8b8b6" }}
    >
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 relative">
        {/* Barre de progression */}
        <div className="flex justify-between mb-6">
          {steps.map((label, idx) => (
            <div key={idx} className="flex-1 text-center">
              <div
                className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                  step >= idx + 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {idx + 1}
              </div>
              <p className="text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Messages */}
        {message && (
          <p className="text-center text-sm text-red-600 mb-4">{message}</p>
        )}

        {/* Étapes avec animation */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-semibold text-center mb-4">
                Créer un compte
              </h2>
              <form
                onSubmit={handleSubmit(onSubmitSignup)}
                className="space-y-4"
              >
                {/* Champs leurres pour neutraliser l'autofill */}
                <input
                  type="text"
                  name="fakeuser"
                  autoComplete="off"
                  style={{ display: "none" }}
                />
                <input
                  type="password"
                  name="fakepass"
                  autoComplete="new-password"
                  style={{ display: "none" }}
                />

                {/* Nom */}
                <div>
                  <label
                    htmlFor="nom"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nom
                  </label>
                  <input
                    id="nom"
                    type="text"
                    {...register("nom")}
                    className="w-full border rounded px-3 py-2"
                  />
                  {errors.nom && (
                    <p className="text-sm text-red-600">{errors.nom.message}</p>
                  )}
                </div>

                {/* Prénom */}
                <div>
                  <label
                    htmlFor="prenom"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Prénom
                  </label>
                  <input
                    id="prenom"
                    type="text"
                    {...register("prenom")}
                    className="w-full border rounded px-3 py-2"
                  />
                  {errors.prenom && (
                    <p className="text-sm text-red-600">
                      {errors.prenom.message}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    {...register("email")}
                    className="w-full border rounded px-3 py-2"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Mot de passe */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={passwordVisible ? "text" : "password"}
                      {...register("password")}
                      className="w-full border rounded px-3 py-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      className="absolute right-3 top-2 text-gray-500"
                    >
                      {passwordVisible ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-600">
                      {errors.password.message}
                    </p>
                  )}
                  {renderPasswordRules()}
                  {password && getStrengthLabel(passwordStrength)}
                </div>

                {/* Confirmation mot de passe */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={confirmVisible ? "text" : "password"}
                      {...register("confirmPassword")}
                      className="w-full border rounded px-3 py-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmVisible(!confirmVisible)}
                      className="absolute right-3 top-2 text-gray-500"
                    >
                      {confirmVisible ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!isValid || isSubmitting || isLoading}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isLoading ? "Envoi..." : "S'inscrire"}
                </button>
                <div className="mt-1 text-center">
                  <Link
                    href="/"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Retour page Accueil
                  </Link>
                </div>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h2 className="text-xl font-semibold mb-4">Vérification email</h2>
              <p className="text-sm text-gray-600 mb-3">
                Code envoyé à <strong>{email}</strong>
              </p>
              <input
                type="text"
                maxLength={6}
                placeholder="Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="border rounded px-4 py-2 text-center tracking-widest w-40"
              />
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleVerifyCode}
                  disabled={isLoading}
                  className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
                >
                  {isLoading ? "Vérification..." : "Valider"}
                </button>
                <button
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Renvoyer le code
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <CheckCircle className="mx-auto text-green-500" size={48} />
              <h2 className="text-xl font-semibold mt-3">Compte activé ✅</h2>
              <p className="text-sm text-gray-600 mt-2">
                Redirection vers la page de Accueil...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
