import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { clearAuth } from "../reducers/authSlice";
import { setCardsMaths } from "../reducers/cardsMathsSlice";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";



export default function Account(props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const isAdmin = isAuthenticated && user?.role === "admin";

  const handleLogout = async () => {
    try {
      const res = await fetch(`${urlFetch}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const response = await res.json();
        setMessage(response.message);
        dispatch(clearAuth());
        isAdmin && dispatch(setCardsMaths([]));
        console.log("✅ Déconnexion réussie ", response , isAdmin);
        props.close();
        if (typeof window !== "undefined") {
          window.location.replace("/");
          return;
        }
        router.push("/");
      } else {
        setMessage("Erreur lors de la déconnexion.");
      }
    } catch {
      setMessage("Erreur serveur.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 rounded-xl shadow-lg p-6 bg-white text-center">
      <h2 className="text-2xl font-semibold mb-6">Mon compte</h2>
      {user && (
        <h2 className="text-2xl  mb-6">
          {user.prenom} {user.nom}
        </h2>
      )}
      {message && <p className="text-blue-600 mb-4">{message}</p>}

      <button
        onClick={handleLogout}
        className="w-full py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 mb-4"
      >
        Logout
      </button>

      <Link
        href="/changepassword"
        className="inline-block py-2 px-4 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
        onClick={() => props.close()}
      >
        Changer le mot de passe
      </Link>
    </div>
  );
}
