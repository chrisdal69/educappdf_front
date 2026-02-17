"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import zxcvbn from "zxcvbn";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import Link from "next/link";
import { AutoComplete, Input } from "antd";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const CODE_TTL_MS = 7 * 60 * 1000;

const nameRegex = /^[\p{L}\s_-]+$/u;
const teacherCodeRegex = /^[A-Za-z0-9]{4}$/;

const teacherCodeSchema = yup.object().shape({
  code: yup
    .string()
    .trim()
    .matches(teacherCodeRegex, "Code professeur invalide")
    .required("Code professeur obligatoire"),
});

const identitySchema = yup.object().shape({
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
});

const newPasswordSchema = yup.object().shape({
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

const existingPasswordSchema = yup.object().shape({
  password: yup.string().required("Mot de passe obligatoire"),
});

export default function SignupWizard() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState([]);

  const [identity, setIdentity] = useState(null);
  const [emailExists, setEmailExists] = useState(false);

  const [verificationCode, setVerificationCode] = useState("");
  const [verificationExpiresAt, setVerificationExpiresAt] = useState(null);
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

  const steps = [
    "Code professeur",
    "Identité",
    "Mot de passe",
    "Vérification",
    "Succès",
  ];

  const teacherForm = useForm({
    resolver: yupResolver(teacherCodeSchema),
    mode: "onChange",
    defaultValues: { code: "" },
  });

  const identityForm = useForm({
    resolver: yupResolver(identitySchema),
    mode: "onChange",
    defaultValues: { nom: "", prenom: "", email: "" },
  });

  const newPasswordForm = useForm({
    resolver: yupResolver(newPasswordSchema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const existingPasswordForm = useForm({
    resolver: yupResolver(existingPasswordSchema),
    mode: "onChange",
    defaultValues: { password: "" },
  });

  const watchedPassword = newPasswordForm.watch("password", "");

  useEffect(() => {
    setPasswordRules({
      length: watchedPassword.length >= 8,
      upper: /[A-Z]/.test(watchedPassword),
      lower: /[a-z]/.test(watchedPassword),
      number: /[0-9]/.test(watchedPassword),
      special: /[^A-Za-z0-9]/.test(watchedPassword),
    });
    setPasswordStrength(zxcvbn(watchedPassword).score);
  }, [watchedPassword]);

  useEffect(() => {
    if (step !== 4 || !verificationExpiresAt) return;

    const tick = () => {
      setRemainingMs(Math.max(0, verificationExpiresAt - Date.now()));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [step, verificationExpiresAt]);

  const remainingLabel = useMemo(() => {
    const totalSeconds = Math.floor((remainingMs || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(
      2,
      "0",
    )}`;
  }, [remainingMs]);

  useEffect(() => {
    if (step !== 4 || !verificationExpiresAt) return;

    const msLeft = verificationExpiresAt - Date.now();

    if (msLeft <= 0) {
      setMessage("Opération d'inscription annulée");
      const redirectTimeout = setTimeout(() => router.push("/"), 1500);
      return () => clearTimeout(redirectTimeout);
    }

    let redirectTimeout = null;
    const expireTimeout = setTimeout(() => {
      setMessage("Opération d'inscription annulée");
      redirectTimeout = setTimeout(() => router.push("/"), 1500);
    }, msLeft);

    return () => {
      clearTimeout(expireTimeout);
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, [step, verificationExpiresAt, router]);

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
            {passwordRules[rule.key] ? "✓" : "✗"} {rule.label}
          </li>
        ))}
      </ul>
    );
  };

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

  const watchedNom = identityForm.watch("nom", "");
  const watchedPrenom = identityForm.watch("prenom", "");

  const matchingStudents = useMemo(() => {
    const nomQuery = `${watchedNom}`.trim().toLowerCase();
    const prenomQuery = `${watchedPrenom}`.trim().toLowerCase();
    const source = Array.isArray(students) ? students : [];
    const available = source.filter(
      (st) => st?.free !== false && st?.id_user == null,
    );

    if (!nomQuery && !prenomQuery) {
      return available.slice(0, 8);
    }

    return available
      .filter((st) => {
        const stNom = `${st?.nom || ""}`.toLowerCase();
        const stPrenom = `${st?.prenom || ""}`.toLowerCase();
        return (
          (!nomQuery || stNom.includes(nomQuery)) &&
          (!prenomQuery || stPrenom.includes(prenomQuery))
        );
      })
      .slice(0, 8);
  }, [students, watchedNom, watchedPrenom]);

  const fillFromStudent = (student) => {
    identityForm.setValue("nom", student?.nom || "", {
      shouldValidate: true,
      shouldDirty: true,
    });
    identityForm.setValue("prenom", student?.prenom || "", {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const studentOptionsNom = useMemo(() => {
    const source = Array.isArray(matchingStudents) ? matchingStudents : [];
    return source
      .filter((st) => st?.nom && st?.prenom)
      .map((st, idx) => ({
        key: `${st.nom}-${st.prenom}-${idx}`,
        value: st.nom,
        label: `${st.nom} ${st.prenom}`,
        student: st,
      }));
  }, [matchingStudents]);

  const studentOptionsPrenom = useMemo(() => {
    const source = Array.isArray(matchingStudents) ? matchingStudents : [];
    return source
      .filter((st) => st?.nom && st?.prenom)
      .map((st, idx) => ({
        key: `${st.prenom}-${st.nom}-${idx}`,
        value: st.prenom,
        label: `${st.prenom} (${st.nom})`,
        student: st,
      }));
  }, [matchingStudents]);

  const redirectHomeWithMessage = (msg) => {
    setMessage(msg || "Erreur.");
    //setTimeout(() => router.push("/"), 1500);
  };

  const onValidateTeacherCode = async ({ code }) => {
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/auth/signup/validate-teacher-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        redirectHomeWithMessage(
          json.message || "Ce code n'est pas ou n'est plus valide",
        );
        return;
      }

      setClassId(json.classId || "");
      setStudents(Array.isArray(json.students) ? json.students : []);
      setStep(2);
    } catch (err) {
      redirectHomeWithMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const onCheckIdentity = async (data) => {
    if (!classId) {
      redirectHomeWithMessage("Ce code n'est pas ou n'est plus valide");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/auth/signup/check-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, classId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.redirect) {
          redirectHomeWithMessage(json.message || "Erreur.");
          return;
        }
        setMessage(json.message || json.error || "Erreur.");
        return;
      }

      setIdentity(data);
      setEmailExists(!!json.emailExists);
      setStep(3);
      existingPasswordForm.reset({ password: "" });
      newPasswordForm.reset({ password: "", confirmPassword: "" });
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const onCreateAccount = async (data) => {
    if (!classId || !identity) {
      redirectHomeWithMessage("Erreur.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/auth/signup/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          ...identity,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.redirect) {
          redirectHomeWithMessage(json.message || "Erreur.");
          return;
        }
        setMessage(json.error || json.message || "Erreur d'inscription.");
        return;
      }

      setMessage("Un code a été envoyé à votre email.");
      setVerificationCode("");
      setVerificationExpiresAt(Date.now() + CODE_TTL_MS);
      setStep(4);
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const onJoinExistingAccount = async (data) => {
    if (!classId || !identity) {
      redirectHomeWithMessage("Erreur.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/auth/signup/join-existing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          ...identity,
          password: data.password,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.redirect) {
          redirectHomeWithMessage(json.message || "Erreur.");
          return;
        }
        setMessage(json.message || "Erreur.");
        existingPasswordForm.reset({ password: "" });
        return;
      }

      setStep(5);
      setMessage("");
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setMessage("Erreur serveur.");
      existingPasswordForm.reset({ password: "" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!identity?.email) {
      redirectHomeWithMessage("Erreur.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/auth/verifmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identity.email,
          code: verificationCode,
          classId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error || "Code invalide.");
        setVerificationCode("");
        return;
      }

      setStep(5);
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!identity?.email) {
      setMessage("Email manquant.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/auth/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identity.email }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error || "Erreur lors du renvoi.");
        return;
      }

      setMessage("Nouveau code envoyé !");
      setVerificationCode("");
      setVerificationExpiresAt(Date.now() + CODE_TTL_MS);
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSignup = async () => {
    if (!identity?.email) {
      setMessage("Email manquant.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/auth/signup/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identity.email }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.message || json.error || "Erreur.");
        return;
      }

      setMessage("Inscription annulée");
      setVerificationExpiresAt(null);
      setRemainingMs(0);
      setTimeout(() => router.push("/"), 1500);
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
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 relative">
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
              <p className="text-[11px] mt-1 px-1 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {message && (
          <p className="text-center text-sm text-red-600 mb-4">{message}</p>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="teacher-code"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-semibold text-center mb-4">
                Code professeur
              </h2>
              <form
                onSubmit={teacherForm.handleSubmit(onValidateTeacherCode)}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="teacherCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Saisir le code professeur
                  </label>
                  <input
                    id="teacherCode"
                    type="text"
                    maxLength={4}
                    {...teacherForm.register("code")}
                    className="w-full border rounded px-3 py-2 tracking-widest text-center uppercase"
                    disabled={isLoading}
                  />
                  {teacherForm.formState.errors.code && (
                    <p className="text-sm text-red-600">
                      {teacherForm.formState.errors.code.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!teacherForm.formState.isValid || isLoading}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isLoading ? "Validation..." : "Valider"}
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
              key="identity"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-semibold text-center mb-4">
                Identité
              </h2>
              <form
                onSubmit={identityForm.handleSubmit(onCheckIdentity)}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="nom"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nom
                  </label>
                  <Controller
                    name="nom"
                    control={identityForm.control}
                    render={({ field }) => (
                      <AutoComplete
                        value={field.value}
                        options={studentOptionsNom}
                        onChange={(value) => {
                          field.onChange(value);
                        }}
                        onSelect={(_, option) => {
                          fillFromStudent(option?.student);
                        }}
                        filterOption={(inputValue, option) =>
                          `${option?.label || ""}`
                            .toLowerCase()
                            .includes(`${inputValue || ""}`.toLowerCase())
                        }
                        disabled={isLoading}
                        className="w-full"
                      >
                        <Input
                          id="nom"
                          type="text"
                          className="w-full !border !rounded !px-3 !py-2"
                          disabled={isLoading}
                          autoComplete="off"
                        />
                      </AutoComplete>
                    )}
                  />
                  {identityForm.formState.errors.nom && (
                    <p className="text-sm text-red-600">
                      {identityForm.formState.errors.nom.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="prenom"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Prénom
                  </label>
                  <Controller
                    name="prenom"
                    control={identityForm.control}
                    render={({ field }) => (
                      <AutoComplete
                        value={field.value}
                        options={studentOptionsPrenom}
                        onChange={(value) => {
                          field.onChange(value);
                        }}
                        onSelect={(_, option) => {
                          fillFromStudent(option?.student);
                        }}
                        filterOption={(inputValue, option) =>
                          `${option?.label || ""}`
                            .toLowerCase()
                            .includes(`${inputValue || ""}`.toLowerCase())
                        }
                        disabled={isLoading}
                        className="w-full"
                      >
                        <Input
                          id="prenom"
                          type="text"
                          className="w-full !border !rounded !px-3 !py-2"
                          disabled={isLoading}
                          autoComplete="off"
                        />
                      </AutoComplete>
                    )}
                  />
                  {identityForm.formState.errors.prenom && (
                    <p className="text-sm text-red-600">
                      {identityForm.formState.errors.prenom.message}
                    </p>
                  )}
                </div>

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
                    {...identityForm.register("email")}
                    className="w-full border rounded px-3 py-2"
                    disabled={isLoading}
                  />
                  {identityForm.formState.errors.email && (
                    <p className="text-sm text-red-600">
                      {identityForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!identityForm.formState.isValid || isLoading}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isLoading ? "Validation..." : "Valider"}
                </button>
              </form>
              <div className="mt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setMessage("");
                  }}
                  className="text-blue-700 rounded hover:underline text-sm"
                >
                  Retour page précédente
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && !emailExists && (
            <motion.div
              key="new-password"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-semibold text-center mb-4">
                Créer un mot de passe
              </h2>
              <form
                onSubmit={newPasswordForm.handleSubmit(onCreateAccount)}
                className="space-y-4"
              >
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
                      {...newPasswordForm.register("password")}
                      className="w-full border rounded px-3 py-2 pr-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((v) => !v)}
                      className="absolute right-3 top-2 text-gray-500"
                      disabled={isLoading}
                    >
                      {passwordVisible ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {newPasswordForm.formState.errors.password && (
                    <p className="text-sm text-red-600">
                      {newPasswordForm.formState.errors.password.message}
                    </p>
                  )}
                  {renderPasswordRules()}
                  {watchedPassword && getStrengthLabel(passwordStrength)}
                </div>

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
                      {...newPasswordForm.register("confirmPassword")}
                      className="w-full border rounded px-3 py-2 pr-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmVisible((v) => !v)}
                      className="absolute right-3 top-2 text-gray-500"
                      disabled={isLoading}
                    >
                      {confirmVisible ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {newPasswordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600">
                      {newPasswordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!newPasswordForm.formState.isValid || isLoading}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isLoading ? "Envoi..." : "S'inscrire"}
                </button>
              </form>
              <div className="mt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setMessage("");
                  }}
                  className="text-blue-700 rounded hover:underline text-sm"
                >
                  Retour page précédente
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && emailExists && (
            <motion.div
              key="existing-password"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-semibold text-center mb-4">
                Connexion
              </h2>
              <p className="text-sm text-gray-600 mb-3 text-center">
                Cet email est déjà enregistré. Saisissez votre mot de passe pour
                rejoindre la classe.
              </p>
              <form
                onSubmit={existingPasswordForm.handleSubmit(
                  onJoinExistingAccount,
                )}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="existingPassword"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="existingPassword"
                    type="password"
                    {...existingPasswordForm.register("password")}
                    className="w-full border rounded px-3 py-2"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  {existingPasswordForm.formState.errors.password && (
                    <p className="text-sm text-red-600">
                      {existingPasswordForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    !existingPasswordForm.formState.isValid || isLoading
                  }
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isLoading ? "Connexion..." : "Se connecter"}
                </button>
              </form>
              <div className="mt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setMessage("");
                  }}
                  className="text-blue-700 rounded hover:underline text-sm"
                >
                  Retour page précédente
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
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
                Code envoyé à <strong>{identity?.email}</strong>
              </p>
              <input
                type="text"
                maxLength={4}
                placeholder="Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="border rounded px-4 py-2 text-center tracking-widest w-40"
                disabled={isLoading}
              />
              <p className="text-sm text-gray-600 mt-3">
                Temps restant pour la saisie : {remainingLabel}
              </p>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={isLoading || verificationCode.trim().length !== 4}
                  className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
                >
                  {isLoading ? "Vérification..." : "Valider"}
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Renvoyer le code
                </button>
                <button
                  type="button"
                  onClick={handleCancelSignup}
                  disabled={isLoading}
                  className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300"
                >
                  Annuler l'inscription
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <CheckCircle className="mx-auto text-green-500" size={48} />
              <h2 className="text-xl font-semibold mt-3">Succès ✅</h2>
              <p className="text-sm text-gray-600 mt-2">
                Redirection vers la page d'accueil...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
