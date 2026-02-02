import Link from "next/link";
import React, { useState, useEffect } from "react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { setAuthenticated, clearAuth } from "../reducers/authSlice";
const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const schema = yup.object().shape({
  email: yup
    .string()
    .email("Adresse email invalide")
    .required("L'email est obligatoire"),
  password: yup.string().required("Mot de passe obligatoire"),
});

export default function Login(props) {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const dispatch = useDispatch(); // ✅ initialisation du dispatch

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });
  const busy = isSubmitting;
  useEffect(() => {
    if (props.isOpen) {
      reset({ email: "", password: "" });
      setServerMessage("");
      setPasswordVisible(false);
    }
  }, [props.isOpen, reset]);
  const onSubmit = async (data) => {
    try {
      const res = await fetch(`${urlFetch}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const response = await res.json();

      if (res.ok) {
        dispatch(
          setAuthenticated({
            email: response.email,
            nom: response.nom,
            prenom: response.prenom,
            role: response.role,
          })
        );
        reset({ email: "", password: "" });
        props.close();

        const fromPath = router.asPath;

        const target = (() => {
          if (response.role !== "admin") {
            if (fromPath === "/") {return "/" }
            if (fromPath === "/ciel1") {return "/ciel1" }
            if (fromPath === "/python") {return "/python" }
            return "/";
          } else {
            if (fromPath === "/") {return "/" }
            if (fromPath === "/ciel1") {return "/admin/ciel1" }
            if (fromPath === "/python") {return "/admin/python" }
            return "/admin";
          }
        })();
        router.push(target);
      } else {
        setServerMessage(response.message || "Erreur de connexion.");
      }
    } catch (err) {
      setServerMessage("Erreur serveur.");
    }
  };

  return (
    <div
      className="max-w-md mx-auto mt-10 rounded-xl shadow-lg p-6 bg-white relative"
      aria-busy={isSubmitting}
    >
      <h2 className="text-2xl font-semibold text-center mb-6">Se loguer</h2>

      {serverMessage && (
        <p className="text-center text-sm mb-4 text-red-600">{serverMessage}</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* EMAIL */}
        <div className="mb-5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register("email")}
            className={`mt-1 block w-full rounded-lg border px-3 py-2 ${
              errors.email ? "border-red-500" : "border-gray-300"
            }`}
            disabled={busy}
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* PASSWORD */}
        <div className="mb-5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="password"
              type={passwordVisible ? "text" : "password"}
              {...register("password")}
              className={`mt-1 block w-full rounded-lg border px-3 py-2 pr-10 ${
                errors.password ? "border-red-500" : "border-gray-300"
              }`}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible(!passwordVisible)}
              className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              disabled={busy}
            >
              {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <div className="mt-2 text-right">
              <Link
                href="/forgot"
                className={`text-sm ${
                  busy
                    ? "text-gray-400 pointer-events-none"
                    : "text-blue-600 hover:underline"
                }`}
                aria-disabled={busy}
                onClick={(e) => {
                  if (busy) {
                    e.preventDefault();
                    return;
                  }
                  props.close();
                }}
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>
        </div>

        {/* BUTTON */}
        <button
          type="submit"
          disabled={!isValid || busy}
          className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-300"
        >
          {isSubmitting ? "Connexion..." : "Se loguer"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <span className="text-sm text-gray-600">Pas encore inscrit ? </span>
        <Link
          href="/signup"
          className={`text-sm font-medium ${
            busy
              ? "text-gray-400 pointer-events-none"
              : "text-blue-600 hover:underline"
          }`}
          aria-disabled={busy}
          onClick={(e) => {
            if (busy) {
              e.preventDefault();
              return;
            }
            props.close();
          }}
        >
          Inscription
        </Link>
      </div>

      {isSubmitting && (
        <div className="absolute inset-0 rounded-xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <ClimbingBoxLoader color="#6C6C6C" size={11} speedMultiplier={1} />
        </div>
      )}
    </div>
  );
}
