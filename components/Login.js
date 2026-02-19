import Link from "next/link";
import React, { useState, useEffect } from "react";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { setAuthenticated, clearAuth } from "../reducers/authSlice";

const NODE_ENV = process.env.NODE_ENV;
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
  const dispatch = useDispatch();

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [multipleClasses, setmultipleClasses] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [isValidatingClass, setIsValidatingClass] = useState(false);

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

  const getTargetPath = (role, directoryname) => {
    const fromPath = (router.asPath || "/").split("?")[0];
    const sanitizedDirectory =
      typeof directoryname === "string" ? directoryname.trim() : "";

    const userPath = sanitizedDirectory ? `/${sanitizedDirectory}` : "/";
    const adminPath = sanitizedDirectory ? `/admin/${sanitizedDirectory}` : "/admin";

    if (fromPath === "/") {
      return "/";
    }

    if (fromPath === userPath || fromPath === adminPath) {
      return role === "admin" ? adminPath : userPath;
    }

    return role === "admin" ? adminPath : userPath;
  };

  const finalizeLoginWithClass = async (classId) => {
    setIsValidatingClass(true);

    try {
      const res = await fetch(`${urlFetch}/auth/login/select-class`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
        credentials: "include",
      });

      const response = await res.json();

      if (!res.ok) {
        setServerMessage(response.message || "Erreur de connexion.");
        props.onFinalActionError?.();
        if (res.status === 401 || res.status === 403) {
          setmultipleClasses(false);
          setAvailableClasses([]);
          setSelectedClassId("");
        }
        return false;
      }

      dispatch(
        setAuthenticated({
          email: response.email,
          nom: response.nom,
          prenom: response.prenom,
          role: response.role,
          classId: response.classId,
          publicname: response.publicname,
          directoryname: response.directoryname,
          repertoires: response.repertoires,
        })
      );

      props.onAuthenticated?.(response);
      reset({ email: "", password: "" });
      setServerMessage("");
      setmultipleClasses(false);
      setAvailableClasses([]);
      setSelectedClassId("");

      if (!props.deferNavigation) {
        props.close?.();
        router.push(getTargetPath(response.role, response.directoryname));
      }
      return true;
    } catch (err) {
      setServerMessage("Erreur serveur.");
      props.onFinalActionError?.();
      return false;
    } finally {
      setIsValidatingClass(false);
    }
  };

  useEffect(() => {
    if (props.isOpen) {
      reset({ email: "", password: "" });
      setServerMessage("");
      setPasswordVisible(false);
      setmultipleClasses(false);
      setAvailableClasses([]);
      setSelectedClassId("");
      setIsValidatingClass(false);
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

      if (!res.ok) {
        setServerMessage(response.message || "Erreur de connexion.");
        return;
      }

      const teachersClasses = Array.isArray(response.teachersClasses)
        ? response.teachersClasses
        : [];
      const followedClasses = Array.isArray(response.followedClasses)
        ? response.followedClasses
        : [];
      
      const classMap = new Map();

      teachersClasses.forEach((cl) => {
        if (cl?.id) {
          classMap.set(String(cl.id), {
            id: String(cl.id),
            publicname: cl.publicname || "Classe sans nom",
          });
        }
      });

      followedClasses.forEach((cl) => {
        if (cl?.id && !classMap.has(String(cl.id))) {
          classMap.set(String(cl.id), {
            id: String(cl.id),
            publicname: cl.publicname || "Classe sans nom",
          });
        }
      });

      const allClasses = Array.from(classMap.values());


      if (allClasses.length === 0) {
        dispatch(clearAuth());
        setmultipleClasses(false);
        setAvailableClasses([]);
        setSelectedClassId("");
        setServerMessage("Cet utilisateur n'est inscrit à aucun cours");
        return;
      }

      if (allClasses.length === 1) {
        props.onFinalActionStart?.();
        await finalizeLoginWithClass(allClasses[0].id);
        return;
      }

      setServerMessage("");
      setAvailableClasses(allClasses);
      setSelectedClassId("");
      setmultipleClasses(true);
    } catch (err) {
      setServerMessage("Erreur serveur.");
    }
  };

  const handleClassValidation = async () => {
    if (!selectedClassId) {
      setServerMessage("Veuillez sélectionner une classe.");
      return;
    }

    props.onFinalActionStart?.();
    await finalizeLoginWithClass(selectedClassId);
  };

  return (
    <div
      className="max-w-md mx-auto mt-10 rounded-xl shadow-lg p-6 bg-gray-50 relative"
      aria-busy={isSubmitting || isValidatingClass}
    >
      {!multipleClasses && (
        <div>
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
                        : "text-primary hover:underline"
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
              className="w-full py-3 text-lg rounded-lg bg-bouton text-gray-100 font-semibold hover:bg-slate-300 hover:text-gray-800 disabled:bg-gray-300"
            >
              {isSubmitting ? "Connexion..  ." : "Se loguer"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-sm text-gray-600">Pas encore inscrit ? </span>
            <Link
              href="/signup"
              className={`text-sm font-medium ${
                busy
                  ? "text-gray-400 pointer-events-none"
                  : "text-primary hover:underline"
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
              <ClimbingBoxLoader
                color="#6C6C6C"
                size={11}
                speedMultiplier={1}
              />
            </div>
          )}
        </div>
      )}

      {multipleClasses && (
        <div>
          <h2 className="text-2xl font-semibold text-center mb-6">
            Choisissez une classe
          </h2>

          {serverMessage && (
            <p className="text-center text-sm mb-4 text-red-600">{serverMessage}</p>
          )}

          <div className="space-y-2 mb-6">
            {availableClasses.map((cl) => (
              <label
                key={cl.id}
                className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary disabled:accent-muted"
                  checked={selectedClassId === cl.id}
                  onChange={() =>
                    setSelectedClassId((prev) => (prev === cl.id ? "" : cl.id))
                  }
                  disabled={isValidatingClass}
                />
                <span className="text-sm text-gray-800">{cl.publicname}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleClassValidation}
            disabled={!selectedClassId || isValidatingClass}
            className="w-full py-3 text-lg rounded-lg bg-bouton text-gray-100 font-semibold hover:bg-slate-300 hover:text-gray-800 disabled:bg-gray-300"
          >
            {isValidatingClass ? "Validation..." : "Valider"}
          </button>
        </div>
      )}
    </div>
  );
}
