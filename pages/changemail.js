"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { setAuthenticated } from "../reducers/authSlice";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

const OTP_LENGTH = 4;

const requestSchema = yup.object().shape({
  password: yup.string().required("Mot de passe obligatoire"),
  newEmail: yup
    .string()
    .trim()
    .email("Adresse email invalide")
    .required("Nouvelle adresse email obligatoire"),
});

function OtpInput({
  value,
  onChange,
  disabled,
  length = OTP_LENGTH,
  autoCapitalize = "none",
}) {
  const inputRefs = useRef([]);
  const [chars, setChars] = useState(() => {
    const safeValue = String(value || "");
    return Array.from({ length }, (_, i) => safeValue[i] || "");
  });

  useEffect(() => {
    const safeValue = String(value || "");
    setChars(Array.from({ length }, (_, i) => safeValue[i] || ""));
  }, [value, length]);

  const commit = (nextChars, nextFocusIndex = null) => {
    setChars(nextChars);
    onChange(nextChars.join(""));

    if (
      nextFocusIndex !== null &&
      nextFocusIndex >= 0 &&
      nextFocusIndex < length
    ) {
      inputRefs.current[nextFocusIndex]?.focus();
    }
  };

  const fillFromIndex = (startIndex, rawText) => {
    const clean = String(rawText || "")
      .replace(/\s/g, "")
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, length);

    if (!clean) return;

    const nextChars = [...chars];
    let writeIndex = startIndex;

    for (const c of clean) {
      if (writeIndex >= length) break;
      nextChars[writeIndex] = c;
      writeIndex += 1;
    }

    commit(nextChars, Math.min(writeIndex, length - 1));
  };

  const handleChange = (index, event) => {
    const raw = event.target.value;

    if (raw.length > 1) {
      fillFromIndex(index, raw);
      return;
    }

    const clean = raw.replace(/[^a-z0-9]/gi, "");
    const nextChars = [...chars];
    nextChars[index] = clean || "";

    commit(nextChars, clean && index < length - 1 ? index + 1 : index);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      if (!chars[index] && index > 0) {
        event.preventDefault();
        const nextChars = [...chars];
        nextChars[index - 1] = "";
        commit(nextChars, index - 1);
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index, event) => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") || "";
    fillFromIndex(index, pasted);
  };

  return (
    <div className="flex justify-center gap-2">
      {chars.map((char, index) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          value={char}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          disabled={disabled}
          type="text"
          inputMode="text"
          pattern="[A-Za-z0-9]*"
          autoCapitalize={autoCapitalize}
          autoCorrect="off"
          spellCheck={false}
          maxLength={1}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus={index === 0}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          className="w-12 h-12 text-center text-xl border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-100"
          aria-label={`Code ${index + 1}`}
        />
      ))}
    </div>
  );
}

export default function Changemail() {
  const router = useRouter();
  const dispatch = useDispatch();
  const from = Array.isArray(router.query?.from)
    ? router.query.from[0]
    : router.query?.from;
  const shouldReturnToIndexBis = from === "home";

  const { isAuthenticated, user } = useSelector((s) => s.auth);

  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isVeilVisible, setIsVeilVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);

  const busy = isLoading;

  const requestForm = useForm({
    resolver: yupResolver(requestSchema),
    mode: "onChange",
    defaultValues: { password: "", newEmail: "" },
  });

  useEffect(() => {
    setIsCardVisible(true);
    const veilTimeout = setTimeout(() => setIsVeilVisible(true), 1000);
    return () => clearTimeout(veilTimeout);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${urlFetch}/users/me`, {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) {
          router.push("/");
        }
      } catch (err) {
        router.push("/");
      }
    };
    checkAuth();
  }, [router]);

  const handleReturn = () => {
    if (shouldReturnToIndexBis) {
      router.push("/indexbis");
      return;
    }
    router.back();
  };

  const onRequest = async (data) => {
    if (busy) return;
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/users/change-email/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: data.password,
          newEmail: data.newEmail,
        }),
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setPendingEmail(String(json?.pendingEmail || data.newEmail));
        setExpiresAt(json?.expiresAt ? new Date(json.expiresAt) : null);
        setStep(2);
        setVerificationCode("");
        setMessage(json?.message || "Un code a été envoyé.");
        return;
      }

      const errorMsg =
        json?.error ||
        json?.errors?.[0]?.message ||
        "Erreur lors de la demande.";
      setMessage(errorMsg);
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (busy) return;
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/users/change-email/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextEmail = json?.email || pendingEmail;
        if (user && nextEmail) {
          dispatch(setAuthenticated({ ...user, email: nextEmail }));
        }
        setMessage(json?.message || "Adresse email modifiée ✅");
        setTimeout(() => handleReturn(), 1500);
        return;
      }

      if (res.status === 401 && typeof json?.remainingAttempts === "number") {
        setMessage(
          `${json?.error || "Code incorrect."} Il vous reste ${json.remainingAttempts} tentative(s).`,
        );
        return;
      }

      if (json?.expired) {
        setStep(1);
        setPendingEmail("");
        setVerificationCode("");
        setExpiresAt(null);
      }

      setMessage(json?.error || "Erreur lors de la vérification.");
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (busy) return;
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${urlFetch}/users/change-email/resend`, {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setExpiresAt(json?.expiresAt ? new Date(json.expiresAt) : null);
        setMessage(json?.message || "Un nouveau code a été envoyé.");
        return;
      }

      setMessage(json?.error || "Impossible de renvoyer le code.");
    } catch (err) {
      setMessage("Erreur serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const remainingLabel = useMemo(() => {
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) return "";
    const diffMs = expiresAt.getTime() - Date.now();
    if (diffMs <= 0) return "Code expiré";
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [expiresAt, isLoading, step]);

  useEffect(() => {
    if (!expiresAt || step !== 2) return undefined;
    const interval = setInterval(() => {
      setExpiresAt((prev) => (prev ? new Date(prev) : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, step]);

  return (
    <div
      className="relative w-full min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ backgroundColor: "bg3" }}
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
          Changer son adresse mail
        </h2>

        {message && <p className="text-center mb-4 text-primary">{message}</p>}

        {step === 1 && (
          <form
            onSubmit={requestForm.handleSubmit(onRequest)}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="newEmail"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nouvelle adresse email
              </label>
              <input
                id="newEmail"
                type="email"
                autoComplete="email"
                disabled={busy || !isAuthenticated}
                {...requestForm.register("newEmail")}
                className="w-full border rounded px-3 py-2"
              />
              {requestForm.formState.errors.newEmail && (
                <p className="text-sm text-red-600 mt-1">
                  {requestForm.formState.errors.newEmail.message}
                </p>
              )}
            </div>

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
                  autoComplete="current-password"
                  disabled={busy || !isAuthenticated}
                  {...requestForm.register("password")}
                  className="w-full border rounded px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  disabled={busy || !isAuthenticated}
                  aria-label={
                    passwordVisible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {requestForm.formState.errors.password && (
                <p className="text-sm text-red-600 mt-1">
                  {requestForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                !requestForm.formState.isValid || busy || !isAuthenticated
              }
              className="w-full my-2 py-3 text-lg rounded-lg bg-bouton text-gray-100 font-semibold hover:bg-slate-300 hover:text-gray-800 disabled:bg-gray-300"
            >
              {busy ? "Envoi..." : "Envoyer le code"}
            </button>
            <div className="text-right mt-4">
              <button
                type="button"
                onClick={handleReturn}
                className={`text-sm ${
                  busy
                    ? "text-gray-400"
                    : "text-primary font-medium hover:underline"
                }`}
                disabled={busy}
              >
                Retour à la page précédente
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-600">
              Code envoyé à <strong>{pendingEmail}</strong>
            </p>
            <OtpInput
              value={verificationCode}
              onChange={setVerificationCode}
              disabled={busy}
              length={OTP_LENGTH}
              autoCapitalize="none"
            />
            {remainingLabel && (
              <p className="text-sm text-gray-600">
                Temps restant : {remainingLabel}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Faire la différence entre majuscule et minuscule.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleVerify}
                disabled={busy || verificationCode.length !== OTP_LENGTH}
                className="w-full my-2 py-3 text-lg rounded-lg bg-bouton text-gray-100 font-semibold hover:bg-slate-300 hover:text-gray-800 disabled:bg-gray-300"
              >
                {busy ? "Vérification..." : "Valider"}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={busy}
                className="w-full py-3 text-lg bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100"
              >
                Renvoyer le code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setMessage("");
                }}
                disabled={busy}
                className="w-full py-3 text-lg bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100"
              >
                Modifier la nouvelle adresse
              </button>
            </div>
            <div className="text-right mt-4">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setMessage("");
                }}
                className={`text-sm ${
                  busy
                    ? "text-gray-400"
                    : "text-primary font-medium hover:underline"
                }`}
                disabled={busy}
              >
                Retour à la page précédente
              </button>
            </div>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 rounded-xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <ClimbingBoxLoader color="#6C6C6C" size={11} speedMultiplier={1} />
          </div>
        )}
      </div>
    </div>
  );
}
