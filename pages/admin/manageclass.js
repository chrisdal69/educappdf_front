"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { Button, Input, Popover } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import Tooltip from "../../components/admin/card/TooltipClickClose";
import { handleAuthError, throwIfUnauthorized } from "../../utils/auth";

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

const CONFIRM_TEXT = "Elève à désinscrire";

export default function ManageClass() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const isAdmin = isAuthenticated && user?.role === "admin";
  const classId = user?.classId ? String(user.classId) : "";
  const className = user?.publicname || "";

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [deleteOpenKey, setDeleteOpenKey] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoadingKey, setDeleteLoadingKey] = useState("");

  const from = Array.isArray(router.query?.from)
    ? router.query.from[0]
    : router.query?.from;
  const shouldReturnToIndexBis = from === "home";

  const handleReturn = () => {
    if (shouldReturnToIndexBis) {
      router.push("/indexbis");
      return;
    }
    router.back();
  };

  const canManage = useMemo(() => isAdmin && !!classId, [isAdmin, classId]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!isAuthenticated || !canManage) {
      router.replace("/");
    }
  }, [router, router.isReady, isAuthenticated, canManage]);

  const fetchStudents = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `${urlFetch}/users/admin/class/${classId}/students`,
        { credentials: "include" }
      );
      throwIfUnauthorized(res);
      const payload = await res.json();
      if (!res.ok) {
        setErrorMessage(payload?.message || "Erreur lors du chargement.");
        return;
      }
      setStudents(Array.isArray(payload?.students) ? payload.students : []);
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) setErrorMessage("Erreur serveur.");
    } finally {
      setLoading(false);
    }
  }, [canManage, classId, dispatch, router]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleUnsubscribe = async (student) => {
    const studentKey = student?.studentId ? String(student.studentId) : "";
    if (!studentKey) return;

    setDeleteLoadingKey(studentKey);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `${urlFetch}/users/admin/class/${classId}/students/${studentKey}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      throwIfUnauthorized(res);
      const payload = await res.json();
      if (!res.ok) {
        setErrorMessage(payload?.message || "Erreur lors de la désinscription.");
        return;
      }
      setStudents((prev) =>
        prev.filter((st) => String(st?.studentId) !== studentKey)
      );
      setDeleteOpenKey("");
      setDeleteConfirmText("");
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) setErrorMessage("Erreur serveur.");
    } finally {
      setDeleteLoadingKey("");
    }
  };

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#b8b8b6" }}
    >
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-xl p-6 relative flex flex-col">
        <h2 className="text-2xl font-semibold text-center mb-6">
          Gérer ma classe
        </h2>

        {className && (
          <p className="text-center text-gray-600 pb-4">
            Classe : <span className="font-medium">{className}</span>
          </p>
        )}

        <div className="text-center pb-4">
          Liste des élèves inscrits par l’admin à ce cours
        </div>

        {loading && (
          <div className="flex flex-col items-center py-6">
            <ClimbingBoxLoader color="#6C6C6C" size={12} />
          </div>
        )}

        {!loading && errorMessage && (
          <p className="text-center text-red-500 text-sm pb-3">{errorMessage}</p>
        )}

        {!loading && !errorMessage && (
          <ul className="list-none m-0 p-0 divide-y divide-gray-100">
            {students.map((st, idx) => {
              const key = st?.studentId ? String(st.studentId) : String(idx);
              const email = st?.email ? String(st.email) : "—";
              const displayName = `${st?.nom || ""} ${st?.prenom || ""}`.trim();
              const isDeleteOpen = deleteOpenKey === key;
              const isDeleting = deleteLoadingKey === key;

              return (
                <li
                  key={key}
                  className={`py-3 px-2 ${idx % 2 === 1 ? "bg-gray-100" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-800">
                        {displayName || "—"}
                      </div>
                      <div className="truncate text-sm text-gray-600">{email}</div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Popover
                        trigger="click"
                        open={isDeleteOpen}
                        onOpenChange={(visible) => {
                          if (visible) {
                            setDeleteOpenKey(key);
                            setDeleteConfirmText("");
                          } else if (isDeleteOpen) {
                            setDeleteOpenKey("");
                            setDeleteConfirmText("");
                          }
                        }}
                        content={
                          <div className="flex w-72 flex-col gap-2">
                            <div className="text-sm text-gray-800">
                              Pour confirmer, écris{" "}
                              <span className="font-semibold">{CONFIRM_TEXT}</span>.
                            </div>
                            <Input
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder={CONFIRM_TEXT}
                              maxLength={40}
                              disabled={isDeleting}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="small"
                                onClick={() => {
                                  setDeleteOpenKey("");
                                  setDeleteConfirmText("");
                                }}
                                disabled={isDeleting}
                              >
                                Annuler
                              </Button>
                              <Button
                                size="small"
                                type="primary"
                                danger
                                loading={isDeleting}
                                disabled={deleteConfirmText !== CONFIRM_TEXT}
                                onClick={() => handleUnsubscribe(st)}
                              >
                                Désinscrire
                              </Button>
                            </div>
                          </div>
                        }
                      >
                        <Tooltip title="Désinscrire" mouseEnterDelay={0.3}>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            loading={isDeleting}
                            disabled={isDeleting}
                          />
                        </Tooltip>
                      </Popover>
                    </div>
                  </div>
                </li>
              );
            })}

            {!students.length && (
              <li className="py-4 text-center text-gray-600 text-sm">
                Aucun élève.
              </li>
            )}
          </ul>
        )}

        <button
          type="button"
          onClick={handleReturn}
          className="text-blue-600 hover:underline "
        >
          Retour à la page précédente
        </button>
      </div>
      <div className="text-center mt-4"></div>
    </div>
  );
}
