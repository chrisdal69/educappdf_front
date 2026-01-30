import {
  Form,
  Upload,
  Button,
  Input,
  List,
  Space,
  message,
  Typography,
  Popover,
  Select,
  Image,
} from "antd";
import NextImage from "next/image";
import ClimbingBoxLoader from "react-spinners/ClimbingBoxLoader";
import {
  InboxOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  MailOutlined,
  ExclamationCircleOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileUnknownOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  DownloadOutlined,
  ExpandAltOutlined,
  CompressOutlined,
} from "@ant-design/icons";
import { useState, useEffect, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Tooltip from "./TooltipClickClose";
import { handleAuthError, throwIfUnauthorized } from "../../../utils/auth";

const NODE_ENV = process.env.NODE_ENV;
const URL_BACK = process.env.NEXT_PUBLIC_URL_BACK;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";
const CLOUD_SCROLL_HEIGHT = 200;
const { Dragger } = Upload;
const { Text } = Typography;
const { Option } = Select;

const CloudBlock = ({ num, repertoire, _id, bg, expanded }) => {
  const [form] = Form.useForm();
  const [upload, setUpload] = useState(false);
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [filesCloud, setFilesCloud] = useState([]);
  const [zipLoading, setZipLoading] = useState(false);
  const [scrollExpanded, setScrollExpanded] = useState(false);
  const [listContentHeight, setListContentHeight] =
    useState(CLOUD_SCROLL_HEIGHT);
  // Filtres / tri
  const [searchTerm, setSearchTerm] = useState("");
  const [fileType, setFileType] = useState("all");
  const [sortOrder, setSortOrder] = useState("asc");

  // États pour popovers
  const [renameVisible, setRenameVisible] = useState(null);
  const [deleteVisible, setDeleteVisible] = useState(null);
  const [newName, setNewName] = useState("");
  const [messageVisible, setMessageVisible] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);

  const dispatch = useDispatch();
  const router = useRouter();
  const authFetch = async (url, options) => {
    const response = await fetch(url, options);
    throwIfUnauthorized(response);
    return response;
  };
  const deleteTimer = useRef(null);
  const listContainerRef = useRef(null);
  const toBlurFile = (filename = "") => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return `${filename}Blur`;
    return `${filename.slice(0, lastDot)}Blur${filename.slice(lastDot)}`;
  };
  const bgRoot = `https://storage.googleapis.com/${
    process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"
  }/${repertoire}/tag${num}/`;
  const blurBg = bg ? toBlurFile(bg) : "";
  const isExpanded = expanded !== false;
  const showBackground = Boolean(isExpanded && bg);
  useEffect(() => {
    // Exécuté uniquement côté client
    const style = document.createElement("style");
    style.innerHTML = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: rgba(0,0,0,0.25);
      border-radius: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: rgba(0,0,0,0.4);
    }
    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,0.25) transparent;
    }
  `;
    document.head.appendChild(style);
    return () => style.remove(); // Nettoyage lors du démontage
  }, []);

  useEffect(() => {
    if (isAuthenticated) onRecup();
  }, [isAuthenticated, user]);

  const onFinish = async (values) => {
    setUpload(true);
    const formData = new FormData();
    if (!values.files) {
      setUpload(false);
      message.error("Aucun fichier sélectionné");
      return;
    }
    formData.append("parent", "cloud");
    formData.append("repertoire", `${repertoire}tag${num}`);

    values.files?.forEach((fileWrapper) => {
      formData.append("fichiers", fileWrapper.originFileObj);
    });

    try {
      const res = await authFetch(`${urlFetch}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}

      if (!res.ok || data.result === false) {
        const msg = data.error || data.message || "Erreur lors de l’upload";
        console.error("Upload error:", msg);
        setUpload(false);
        message.error(msg);
        form.resetFields();
        return;
      }

      if (data.result) {
        await onRecup();
        form.resetFields();
        setUpload(false);
        message.success("Fichiers uploadés avec succès !");
      }
    } catch (err) {
      console.error("Erreur upload:", err);
      const handled = handleAuthError(err, { dispatch, router });
      setUpload(false);
      if (!handled) {
        message.error("Erreur lors de l’upload");
      }
      form.resetFields();
    }
  };

  const onRecup = async () => {
    const formData = new FormData();
    formData.append("parent", "cloud");
    formData.append("repertoire", `${repertoire}tag${num}`);
    try {
      const res = await authFetch(`${urlFetch}/upload/recupA`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      setFilesCloud(data);
      //console.log(data);
    } catch (err) {
      console.error("Erreur upload:", err);
      handleAuthError(err, { dispatch, router });
    }
  };

  const handleDelete = async (fileName) => {
    try {
    const res = await authFetch(`${urlFetch}/upload/deleteA`, {
        method: "POST",
        body: JSON.stringify({
          parent: "cloud",
          repertoire: `${repertoire}tag${num}`,
          file: fileName,
        }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        message.success("Fichier supprimé !");
        await onRecup();
      } else {
        message.error(data.message || "Erreur de suppression");
      }
    } catch (err) {
      console.error(err);
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) {
        message.error("Erreur de communication avec le serveur");
      }
    }
    setDeleteVisible(null);
  };

  const handleRenameClick = (file, index) => {
    setRenameVisible(index);
    setNewName(file.name.split("/").pop().split("___").pop());
  };

  const handleDeleteClick = (index) => {
    setDeleteVisible(index);
    clearTimeout(deleteTimer.current);
    deleteTimer.current = setTimeout(() => setDeleteVisible(null), 2000);
  };

  const handleMessageClick = (index) => {
    setMessageVisible(index);
    setMessageText("");
  };

  const handleConfirmRename = async (file) => {
    //console.log("handleConfirmRename : ", file.name, newName);
    try {
    const res = await authFetch(`${urlFetch}/upload/renameA`, {
        method: "POST",
        body: JSON.stringify({
          parent: "cloud",
          repertoire: `${repertoire}tag${num}`,
          oldName: file.name.split("/").pop(),
          newName,
        }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        message.success("Fichier renommé !");
        await onRecup();
      } else {
        message.error(data.message || "Erreur de renommage");
      }
    } catch (err) {
      console.error(err);
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) {
        message.error("Erreur de communication avec le serveur");
      }
    }
    setRenameVisible(null);
  };

  const handleSendMessage = async ({ nom, prenom, text, filename }) => {
    const normalizedNom =
      typeof nom === "string" ? nom.trim().toUpperCase() : "";
    const normalizedPrenom =
      typeof prenom === "string" ? prenom.trim().toLowerCase() : "";
    const trimmedText = typeof text === "string" ? text.trim() : "";
    const trimmedFilename =
      typeof filename === "string" ? filename.trim() : "";

    if (!_id) {
      message.error("Id de carte manquant.");
      return;
    }
    if (!normalizedNom || !normalizedPrenom) {
      message.error("Nom ou prenom introuvable pour ce fichier.");
      return;
    }
    if (!trimmedText) {
      message.error("Le message est vide.");
      return;
    }
    if (!trimmedFilename) {
      message.error("Nom de fichier manquant.");
      return;
    }

    setMessageSending(true);
    try {
    const res = await authFetch(`${urlFetch}/cards/cloud`, {
        method: "POST",
        body: JSON.stringify({
          id_card: _id,
          nom: normalizedNom,
          prenom: normalizedPrenom,
          message: trimmedText,
          filename: trimmedFilename,
        }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}

      if (!res.ok || data?.error) {
        message.error(
          data?.message || data?.error || "Erreur lors de l'envoi du message"
        );
        return;
      }

      message.success("Message envoye !");
      setMessageVisible(null);
      setMessageText("");
    } catch (err) {
      console.error(err);
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) {
        message.error("Erreur de communication avec le serveur");
      }
    } finally {
      setMessageSending(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!filesCloud.length || zipLoading) return;
    setZipLoading(true);
    try {
    const res = await authFetch(`${urlFetch}/upload/downloadZipA`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          parent: "cloud",
          repertoire: `${repertoire}tag${num}`,
        }),
      });
      if (!res.ok) {
        let errorMessage = "Impossible de générer l'archive ZIP";
        try {
          const data = await res.json();
          errorMessage = data?.message || errorMessage;
        } catch (_) {
          const text = await res.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${repertoire}tag${num}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      message.success("Archive ZIP téléchargée");
    } catch (err) {
      console.error("Erreur download zip:", err);
      const handled = handleAuthError(err, { dispatch, router });
      if (!handled) {
        message.error(err?.message || "Erreur lors du téléchargement ZIP");
      }
    } finally {
      setZipLoading(false);
    }
  };

  /** 🔍 Type de fichier */
  const getFileType = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    if (["doc", "docx"].includes(ext)) return "word";
    if (["xls", "xlsx"].includes(ext)) return "excel";
    if (["txt", "md"].includes(ext)) return "text";
    if (ext === "py") return "python";
    if (ext === "html") return "html";
    if (ext === "css") return "css";
    if (["js", "jsx"].includes(ext)) return "javascript";
    return "other";
  };

  /** 🧩 Miniature ou icône */
  const getFilePreview = (file) => {
    const type = getFileType(file);
    if (type === "image") {
      return (
        <Image
          src={file.url}
          alt={file.name}
          width={36}
          height={36}
          style={{
            objectFit: "cover",
            borderRadius: "6px",
            border: "1px solid #f0f0f0",
          }}
          preview={false}
        />
      );
    }
    const iconMap = {
      pdf: <FilePdfOutlined style={{ color: "#ff4d4f", fontSize: 26 }} />,
      word: <FileWordOutlined style={{ color: "#1890ff", fontSize: 26 }} />,
      excel: <FileExcelOutlined style={{ color: "#52c41a", fontSize: 26 }} />,
      text: <FileTextOutlined style={{ color: "#8c8c8c", fontSize: 26 }} />,
      python: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 128 128"
          width="26"
          height="26"
        >
          <path
            fill="#3776AB"
            d="M63.4 0C48.3 0 49.4 6.6 49.4 6.6v9.6h14.5v4.8H39.4c-8.6 0-16.2 7.6-16.2 16.3v18.9h44.2v-6.5H46.4v-4.8H67c8.6 0 16.2-7.6 16.2-16.3V6.6C83.2 6.6 78.5 0 63.4 0zM52.3 5.9c2.4 0 4.3 1.9 4.3 4.3s-1.9 4.3-4.3 4.3-4.3-1.9-4.3-4.3S49.9 5.9 52.3 5.9z"
          />
          <path
            fill="#FFD43B"
            d="M64.6 128c15.1 0 14-6.6 14-6.6v-9.6H64.1v-4.8h24.5c8.6 0 16.2-7.6 16.2-16.3V71.8H60.6v6.5h20.9v4.8H61c-8.6 0-16.2 7.6-16.2 16.3v22.1c0 0-4.8 6.5 19.8 6.5zM75.7 122c-2.4 0-4.3-1.9-4.3-4.3s1.9-4.3 4.3-4.3 4.3 1.9 4.3 4.3S78.1 122 75.7 122z"
          />
        </svg>
      ),
      html: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 128 128"
          width="26"
          height="26"
        >
          <path fill="#E34F26" d="M19 0l8 90 37 10 37-10 8-90H19z" />
          <path fill="#EF652A" d="M64 117l30-8 6-72H64v80z" />
          <path
            fill="#EBEBEB"
            d="M64 66H48l-1-10h17V47H38l3 33h23V66zm0 27l-14-4-1-11H38l2 21 24 7V93z"
          />
          <path
            fill="#FFF"
            d="M64 66v9h14l-1 14-13 3v9l24-7 2-28H64zm0-19v9h26l1-9H64z"
          />
        </svg>
      ),
      css: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 128 128"
          width="26"
          height="26"
        >
          <path fill="#1572B6" d="M19 0l8 90 37 10 37-10 8-90H19z" />
          <path fill="#33A9DC" d="M64 117l30-8 6-72H64v80z" />
          <path
            fill="#fff"
            d="M64 67H48l-1-10h17V48H38l3 33h23V67zm0 26l-14-4-1-11H38l2 21 24 7V93z"
          />
          <path
            fill="#EBEBEB"
            d="M64 67v9h14l-1 14-13 3v9l24-7 2-28H64zm0-19v9h26l1-9H64z"
          />
        </svg>
      ),
      javascript: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 128 128"
          width="26"
          height="26"
        >
          <path fill="#F7DF1E" d="M2 2h124v124H2z" />
          <path
            d="M34 96l9-5c2 4 4 7 8 7 4 0 7-2 7-9V55h11v34c0 11-6 19-18 19-9 0-15-5-17-12zm41-1l9-6c2 4 5 8 10 8 4 0 7-2 7-5 0-3-2-5-7-7l-3-1c-9-4-14-9-14-19 0-9 7-16 17-16 7 0 12 2 16 9l-9 6c-2-3-4-5-7-5s-5 2-5 5c0 3 2 4 7 6l3 1c10 4 15 9 15 19 0 11-8 17-19 17-10 0-17-5-20-11z"
            fill="#000"
          />
        </svg>
      ),
      other: <FileUnknownOutlined style={{ color: "#bfbfbf", fontSize: 26 }} />,
    };
    return iconMap[type];
  };

  /** 🧮 Filtres et tri */
  const filteredFiles = useMemo(() => {
    let result = filesCloud;

    if (searchTerm) {
      result = result.filter((f) =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (fileType !== "all") {
      result = result.filter((f) => getFileType(f) === fileType);
    }
    result = result.filter((f) => {
      const fileName = f.name?.split("/").pop() ?? "";
      return fileName.trim() !== "";
    });
    result = [...result].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });
    return result;
  }, [filesCloud, searchTerm, fileType, sortOrder]);

  useEffect(() => {
    const updateHeight = () => {
      if (listContainerRef.current) {
        const scrollHeight = listContainerRef.current.scrollHeight || 0;
        setListContentHeight(Math.max(scrollHeight, CLOUD_SCROLL_HEIGHT));
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [filteredFiles]);

  function splitMajMin(value) {
    const str = typeof value === "string" ? value : "";
    const index = str.search(/[a-z]/);
    if (index === -1) return [str.toUpperCase(), ""];
    if (index === 0) return ["", str.toLowerCase()];
    return [str.slice(0, index).toUpperCase(), str.slice(index).toLowerCase()];
  }

  return (
    <div className="relative" aria-busy={upload}>
      {showBackground && (
        <>
          <div className="absolute inset-0 z-0">
            <NextImage
              src={`${bgRoot}${bg}`}
              alt=""
              fill
              placeholder="blur"
              blurDataURL={`${bgRoot}${blurBg}`}
              sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover object-center"
            />
          </div>
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ background: "rgba(255,255,255,0.8)" }}
          />
        </>
      )}
      <div className="relative z-20">
      {!isAuthenticated && (
        <h1 className="text-3xl text-center p-4">
          Il faut d'abord se loguer pour pouvoir uploader
        </h1>
      )}

      {isAuthenticated && (
        <Form form={form} onFinish={onFinish} className="upload-form">
          {/* 🎛️ Filtres */}
          <div className="mb-6 flex flex-wrap gap-3 items-center justify-center md:justify-start">
            <Input
              placeholder="Rechercher un fichier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 220 }}
              disabled={upload}
            />
            <Select
              value={fileType}
              onChange={setFileType}
              style={{ width: 200 }}
              suffixIcon={<FilterOutlined />}
              disabled={upload}
            >
              <Option value="all">Tous les types</Option>
              <Option value="image">Images</Option>
              <Option value="pdf">PDF</Option>
              <Option value="word">Word</Option>
              <Option value="excel">Excel</Option>
              <Option value="text">Texte</Option>
              <Option value="python">Python 🐍</Option>
              <Option value="html">HTML 🌐</Option>
              <Option value="css">CSS 🎨</Option>
              <Option value="javascript">JavaScript ⚡</Option>
              <Option value="other">Autres</Option>
            </Select>
            <Tooltip
              title={sortOrder === "asc" ? "Trier de A à Z" : "Trier de Z à A"}
              mouseEnterDelay={0.3}
            >
              <Button
                icon={
                  sortOrder === "asc" ? (
                    <SortAscendingOutlined />
                  ) : (
                    <SortDescendingOutlined />
                  )
                }
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
              >
                {sortOrder === "asc" ? "A → Z" : "Z → A"}
              </Button>
            </Tooltip>
            <Tooltip
              title="Télécharger tous les fichiers en ZIP"
              mouseEnterDelay={0.3}
            >
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadZip}
                loading={zipLoading}
                disabled={!filesCloud.length || upload}
              >
                Télécharger le ZIP
              </Button>
            </Tooltip>
            <Tooltip
              title={scrollExpanded ? "Réduire la liste" : "Agrandir la liste"}
              mouseEnterDelay={0.3}
            >
              <Button
                icon={
                  scrollExpanded ? <CompressOutlined /> : <ExpandAltOutlined />
                }
                onClick={() => setScrollExpanded((prev) => !prev)}
                disabled={!filteredFiles.length}
              >
                {scrollExpanded ? "Réduire la liste" : "Agrandir la liste"}
              </Button>
            </Tooltip>
          </div>

          {/* 📂 Liste avec scroll */}
          <div
            ref={listContainerRef}
            style={{
              maxHeight: `${
                scrollExpanded ? listContentHeight : CLOUD_SCROLL_HEIGHT
              }px`,
              overflowY: scrollExpanded ? "visible" : "auto",
              border: "1px solid #f0f0f0",
              borderRadius: "6px",
              padding: "4px 12px 4px 4px",
              transition: "max-height 0.6s ease",
            }}
            className="custom-scrollbar"
          >
            <List
              bordered={false}
              dataSource={filteredFiles}
              locale={{ emptyText: "Aucun fichier trouvé" }}
              renderItem={(file, index) => {
                const fullName = file.name?.split("/").pop() ?? "";
                const isRenameOpen = renameVisible === index;
                const isDeleteOpen = deleteVisible === index;
                const isMessageOpen = messageVisible === index;

                const nomPrenom = fullName.split("___")[0] ?? "";
                const [nom, prenom] = splitMajMin(nomPrenom);
                const reduceName = fullName.split("___")[1] ?? "";

                return (
                  <List.Item className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-2 py-1 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center gap-2">
                      {getFilePreview(file)}
                      <a href={file.url} target="_blank" rel="noreferrer">
                        <Text className="file-name">{fullName}</Text>
                      </a>
                    </div>

                    <div className="flex gap-2 justify-center md:justify-end">
                      <Popover
                        placement="bottom"
                        open={isRenameOpen}
                        onOpenChange={(visible) =>
                          setRenameVisible(visible ? index : null)
                        }
                        trigger="click"
                        content={
                          <Space>
                            <Input
                              size="small"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Nouveau nom"
                            />
                            <Tooltip
                              title="Valider le nouveau nom"
                              mouseEnterDelay={0.3}
                            >
                              <Button
                                type="primary"
                                size="small"
                                icon={<CheckOutlined />}
                                onClick={() => handleConfirmRename(file)}
                              />
                            </Tooltip>
                            <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                              <Button
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => setRenameVisible(null)}
                              />
                            </Tooltip>
                          </Space>
                        }
                      >
                        <Tooltip
                          title="Renommer le fichier"
                          mouseEnterDelay={0.3}
                        >
                          <Button
                            icon={<EditOutlined />}
                            size="small"
                            className={isRenameOpen ? "btn-active" : ""}
                            onClick={() => handleRenameClick(file, index)}
                          />
                        </Tooltip>
                      </Popover>

                      <Popover
                        placement="bottom"
                        open={isMessageOpen}
                        onOpenChange={(visible) =>
                          setMessageVisible(visible ? index : null)
                        }
                        trigger="click"
                        content={
                          <Space direction="vertical">
                            <Input.TextArea
                              rows={5}
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              placeholder= {`message à ${nom} ${prenom}`}
                              style={{ width: "min(600px, 85vw)" }}
                              disabled={messageSending}
                            />
                            <Space>
                              <Tooltip
                                title="Valider le message"
                                mouseEnterDelay={0.3}
                              >
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<CheckOutlined />}
                                  loading={messageSending}
                                  onClick={() =>
                                    handleSendMessage({
                                      nom,
                                      prenom,
                                      text: messageText,
                                      filename: reduceName,
                                    })
                                  }
                                />
                              </Tooltip>
                              <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                                <Button
                                  size="small"
                                  icon={<CloseOutlined />}
                                  onClick={() => setMessageVisible(null)}
                                  disabled={messageSending}
                                />
                              </Tooltip>
                            </Space>
                          </Space>
                        }
                      >
                        <Tooltip
                          title="Envoyer un message"
                          mouseEnterDelay={0.3}
                        >
                          <Button
                            icon={<MailOutlined />}
                            size="small"
                            className={isMessageOpen ? "btn-active" : ""}
                            onClick={() => handleMessageClick(index)}
                          />
                        </Tooltip>
                      </Popover>

                      <Popover
                        placement="bottom"
                        open={isDeleteOpen}
                        onOpenChange={(visible) => {
                          setDeleteVisible(visible ? index : null);
                          if (visible) {
                            clearTimeout(deleteTimer.current);
                            deleteTimer.current = setTimeout(
                              () => setDeleteVisible(null),
                              2000
                            );
                          }
                        }}
                        trigger="click"
                        content={
                          <Space>
                            <ExclamationCircleOutlined
                              style={{ color: "#faad14" }}
                            />
                            <span>Supprimer ?</span>
                            <Tooltip
                              title="Confirmer la suppression"
                              mouseEnterDelay={0.3}
                            >
                              <Button
                                danger
                                size="small"
                                icon={<CheckOutlined />}
                                onClick={() => handleDelete(fullName)}
                              />
                            </Tooltip>
                            <Tooltip title="Annuler" mouseEnterDelay={0.3}>
                              <Button
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => setDeleteVisible(null)}
                              />
                            </Tooltip>
                          </Space>
                        }
                      >
                        <Tooltip
                          title="Supprimer ce fichier"
                          mouseEnterDelay={0.3}
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            className={isDeleteOpen ? "btn-active" : ""}
                            onClick={() => handleDeleteClick(index)}
                          />
                        </Tooltip>
                      </Popover>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        </Form>
      )}
      </div>
      {upload && (
        <div className="absolute inset-0 z-30 rounded-xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <ClimbingBoxLoader color="#6C6C6C" size={12} speedMultiplier={1} />
        </div>
      )}
    </div>
  );
};

export default CloudBlock;
