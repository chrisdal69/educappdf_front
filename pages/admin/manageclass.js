"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { Button, Input, Popover, Radio, Upload } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
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
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [isVeilVisible, setIsVeilVisible] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [classCodeExpires, setClassCodeExpires] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenDuration, setRegenDuration] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addNom, setAddNom] = useState("");
  const [addPrenom, setAddPrenom] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkFileList, setBulkFileList] = useState([]);
  const [bulkUploadKey, setBulkUploadKey] = useState(0);
  const [bulkLoading, setBulkLoading] = useState(false);
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
    setIsCardVisible(true);
    const veilTimeout = setTimeout(() => setIsVeilVisible(true), 1000);
    return () => clearTimeout(veilTimeout);
  }, []);

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
        { credentials: "include" },
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

  const fetchClassCode = useCallback(async () => {
    if (!canManage) return;
    setCodeLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${urlFetch}/users/admin/class/${classId}/code`, {
        credentials: "include",
      });
      throwIfUnauthorized(res);
      const payload = await res.json();
      if (!res.ok) {
        setErrorMessage(payload?.message || "Erreur lors du chargement du code.");
        return;
      }
      setClassCode(String(payload?.code || ""));
      setClassCodeExpires(payload?.codeExpires || null);
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) setErrorMessage("Erreur serveur.");
    } finally {
      setCodeLoading(false);
    }
  }, [canManage, classId, dispatch, router]);

  useEffect(() => {
    fetchClassCode();
  }, [fetchClassCode]);

  const formatFrDate = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  };

  const handleRegenerateCode = async () => {
    if (!regenDuration) return;

    setRegenLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `${urlFetch}/users/admin/class/${classId}/code/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ duration: regenDuration }),
        },
      );
      throwIfUnauthorized(res);
      const payload = await res.json();
      if (!res.ok) {
        setErrorMessage(payload?.message || "Erreur lors de la régénération.");
        return;
      }
      setClassCode(String(payload?.code || ""));
      setClassCodeExpires(payload?.codeExpires || null);
      setRegenOpen(false);
      setRegenDuration("");
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) setErrorMessage("Erreur serveur.");
    } finally {
      setRegenLoading(false);
    }
  };

  const handleAddStudent = async () => {
    const trimmedNom = String(addNom || "").trim();
    const trimmedPrenom = String(addPrenom || "").trim();
    if (!trimmedNom || !trimmedPrenom) return;

    setAddLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `${urlFetch}/users/admin/class/${classId}/students`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ nom: trimmedNom, prenom: trimmedPrenom }),
        },
      );
      throwIfUnauthorized(res);
      const payload = await res.json();
      if (!res.ok) {
        setErrorMessage(payload?.message || "Erreur lors de l'inscription.");
        return;
      }
      setAddOpen(false);
      setAddNom("");
      setAddPrenom("");
      await fetchStudents();
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) setErrorMessage("Erreur serveur.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleBulkAddStudents = async () => {
    if (!bulkFile) return;

    setBulkLoading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);

      const res = await fetch(
        `${urlFetch}/users/admin/class/${classId}/students/upload`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );
      throwIfUnauthorized(res);
      const payload = await res.json();
      if (!res.ok) {
        setErrorMessage(payload?.message || "Erreur lors de l'inscription.");
        return;
      }

      setBulkOpen(false);
      setBulkFile(null);
      setBulkFileList([]);
      setBulkUploadKey((prev) => prev + 1);
      await fetchStudents();
    } catch (err) {
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) setErrorMessage("Erreur serveur.");
    } finally {
      setBulkLoading(false);
    }
  };

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
        },
      );
      throwIfUnauthorized(res);
      const payload = await res.json();
      if (!res.ok) {
        setErrorMessage(
          payload?.message || "Erreur lors de la désinscription.",
        );
        return;
      }
      setStudents((prev) =>
        prev.filter((st) => String(st?.studentId) !== studentKey),
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
      className="relative w-full min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ backgroundColor: "#b8b8b6" }}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-10 bg-black/25 backdrop-blur-sm transition-opacity duration-300 ${
          isVeilVisible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative z-20 w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white shadow-lg rounded-xl p-6 transform-gpu origin-top-right transition-transform transition-opacity duration-1000 ease-out motion-reduce:transition-none motion-reduce:transform-none flex flex-col min-h-0 ${
          isCardVisible
            ? "scale-100 opacity-100"
            : "scale-0 opacity-0 pointer-events-none"
        }`}
      >
        <h2 className="text-2xl font-semibold text-center mb-6">
          Gérer la classe de {className}
        </h2>
        <div className="pb-4 px-[10%]">
          <div>
            <p className="py-1">
              Code d'inscription :{" "}
              <span className="font-mono">
                {codeLoading ? "…" : classCode || "—"}
              </span>
            </p>
            <p className="py-1">
              Expire le :{" "}
              <span className="font-mono">
                {codeLoading ? "…" : formatFrDate(classCodeExpires) || "—"}
              </span>
            </p>

            <Popover
              trigger="click"
              open={regenOpen}
              onOpenChange={(visible) => {
                setRegenOpen(visible);
                if (visible) {
                  setRegenDuration("");
                  setAddOpen(false);
                  setBulkOpen(false);
                  setBulkFile(null);
                  setBulkFileList([]);
                  setBulkUploadKey((prev) => prev + 1);
                  setDeleteOpenKey("");
                  setDeleteConfirmText("");
                }
              }}
              content={
                <div className="flex w-72 flex-col gap-2">
                  <Radio.Group
                    onChange={(e) => setRegenDuration(e.target.value)}
                    value={regenDuration}
                  >
                    <div className="flex flex-col gap-1">
                      <Radio value="3d">3 jours</Radio>
                      <Radio value="1w">1 semaine</Radio>
                      <Radio value="2w">2 semaines</Radio>
                    </div>
                  </Radio.Group>

                  <div className="flex justify-end gap-2">
                    <Button
                      size="small"
                      onClick={() => {
                        setRegenOpen(false);
                        setRegenDuration("");
                      }}
                      disabled={regenLoading}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      loading={regenLoading}
                      disabled={!regenDuration}
                      onClick={handleRegenerateCode}
                    >
                      Valider
                    </Button>
                  </div>
                </div>
              }
            >
              <Tooltip title="Régénérer un code d’inscription" mouseEnterDelay={0.3}>
                <Button className="my-1" type="primary">
                  Régénérer un code
                </Button>
              </Tooltip>
            </Popover>
          </div>
        </div>

        <div className="text-center pb-4">
          Liste des élèves inscrits dans cette classe
        </div>

        <div className="flex justify-end gap-2 pb-4">
          <Popover
            trigger="click"
            open={addOpen}
            onOpenChange={(visible) => {
              setAddOpen(visible);
              if (visible) {
                setDeleteOpenKey("");
                setDeleteConfirmText("");
                setBulkOpen(false);
                setBulkFile(null);
                setBulkFileList([]);
                setBulkUploadKey((prev) => prev + 1);
              }
            }}
            content={
              <div className="flex w-72 flex-col gap-2">
                <Input
                  value={addNom}
                  onChange={(e) => setAddNom(e.target.value)}
                  placeholder="Nom"
                  maxLength={80}
                  disabled={addLoading}
                />
                <Input
                  value={addPrenom}
                  onChange={(e) => setAddPrenom(e.target.value)}
                  placeholder="Prénom"
                  maxLength={80}
                  disabled={addLoading}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="small"
                    onClick={() => {
                      setAddOpen(false);
                      setAddNom("");
                      setAddPrenom("");
                    }}
                    disabled={addLoading}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    loading={addLoading}
                    disabled={
                      !String(addNom || "").trim() ||
                      !String(addPrenom || "").trim()
                    }
                    onClick={handleAddStudent}
                  >
                    Inscrire
                  </Button>
                </div>
              </div>
            }
          >
            <Tooltip
              title="Ajouter un élève (saisie manuelle)"
              mouseEnterDelay={0.3}
            >
              <Button type="primary">Ajouter un élève</Button>
            </Tooltip>
          </Popover>

          <Popover
            trigger="click"
            open={bulkOpen}
            onOpenChange={(visible) => {
              setBulkOpen(visible);
              if (visible) {
                setDeleteOpenKey("");
                setDeleteConfirmText("");
                setAddOpen(false);
                setAddNom("");
                setAddPrenom("");
                setBulkFile(null);
                setBulkFileList([]);
                setBulkUploadKey((prev) => prev + 1);
              } else {
                setBulkFile(null);
                setBulkFileList([]);
                setBulkUploadKey((prev) => prev + 1);
              }
            }}
            content={
              <div className="flex w-80 flex-col gap-2">
                <Upload
                  key={bulkUploadKey}
                  accept=".csv,.txt"
                  maxCount={1}
                  beforeUpload={() => false}
                  fileList={bulkFileList}
                  showUploadList={false}
                  onChange={(info) => {
                    const nextList = Array.isArray(info?.fileList)
                      ? info.fileList.slice(-1)
                      : [];
                    setBulkFileList(nextList);
                    const nextFile = nextList?.[0]?.originFileObj || null;
                    setBulkFile(nextFile);
                  }}
                  onRemove={() => {
                    setBulkFile(null);
                    setBulkFileList([]);
                    setBulkUploadKey((prev) => prev + 1);
                  }}
                >
                  <Tooltip
                    title="Choisir un fichier (.csv ou .txt)"
                    mouseEnterDelay={0.3}
                  >
                    <Button icon={<UploadOutlined />} disabled={bulkLoading}>
                      Choisir un fichier
                    </Button>
                  </Tooltip>
                </Upload>
                {bulkFile?.name && (
                  <div className="text-xs text-gray-700 truncate">
                    Fichier : {bulkFile.name}
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  Format attendu (une ligne par élève) : <br />
                  nom,prenom
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="small"
                    onClick={() => {
                      setBulkOpen(false);
                      setBulkFile(null);
                      setBulkFileList([]);
                      setBulkUploadKey((prev) => prev + 1);
                    }}
                    disabled={bulkLoading}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    loading={bulkLoading}
                    disabled={!bulkFile}
                    onClick={handleBulkAddStudents}
                  >
                    Inscrire
                  </Button>
                </div>
              </div>
            }
          >
            <Tooltip
              title="Ajouter plusieurs élèves via fichier (.csv/.txt)"
              mouseEnterDelay={0.3}
            >
              <Button>Ajouter des élèves</Button>
            </Tooltip>
          </Popover>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center py-6">
              <ClimbingBoxLoader color="#6C6C6C" size={12} />
            </div>
          )}

          {!loading && errorMessage && (
            <p className="text-center text-red-500 text-sm pb-3">
              {errorMessage}
            </p>
          )}

          {!loading && !errorMessage && (
            <ul className="list-none m-0 p-0 divide-y divide-gray-100">
              {students.map((st, idx) => {
                const key = st?.studentId ? String(st.studentId) : String(idx);
                const email = st?.email ? String(st.email) : "—";
                const displayName =
                  `${st?.nom || ""} ${st?.prenom || ""}`.trim();
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
                        <div className="truncate text-sm text-gray-600">
                          {email}
                        </div>
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
                                <span className="font-semibold">
                                  {CONFIRM_TEXT}
                                </span>
                                .
                              </div>
                              <Input
                                value={deleteConfirmText}
                                onChange={(e) =>
                                  setDeleteConfirmText(e.target.value)
                                }
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
        </div>

        <button
          type="button"
          onClick={handleReturn}
          className="text-primary font-medium hover:underline mt-4 text-right"
        >
          Retour à la page précédente
        </button>
      </div>
    </div>
  );
}
