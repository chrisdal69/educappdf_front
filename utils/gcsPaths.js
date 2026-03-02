const DEFAULT_BUCKET = "educapp";

const getBucketName = () =>
  process.env.NEXT_PUBLIC_BUCKET_NAME || DEFAULT_BUCKET;

const getGcsEnvFolder = () => {
  const override = process.env.NEXT_PUBLIC_GCS_ENV_FOLDER;
  if (typeof override === "string" && override.trim()) return override.trim();
  return process.env.NODE_ENV === "production" ? "eap" : "eap-test";
};

const normalizeSegment = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return `${value}`.replace(/^\/+|\/+$/g, "");
};

const joinGcsPath = (...segments) => {
  const cleaned = segments.map(normalizeSegment).filter(Boolean);
  return cleaned.join("/");
};

export const buildCardBasePath = ({ classeDirectoryname, classe, repertoire, num }) => {
  const rep = normalizeSegment(repertoire);
  const tagNumber =
    typeof num === "number" || (typeof num === "string" && num.trim())
      ? `${num}`.trim()
      : "";
  if (!rep || !tagNumber) return "";

  const cls = normalizeSegment(classeDirectoryname || classe);
  if (!cls) {
    return joinGcsPath(rep, `tag${tagNumber}`) + "/";
  }

  const envFolder = getGcsEnvFolder();
  return joinGcsPath(envFolder, cls, rep, `tag${tagNumber}`) + "/";
};

export const buildCardBaseUrl = ({ classeDirectoryname, classe, repertoire, num }) => {
  const bucket = getBucketName();
  const basePath = buildCardBasePath({ classeDirectoryname, classe, repertoire, num });
  if (!bucket || !basePath) return "";
  return `https://storage.googleapis.com/${bucket}/${basePath}`;
};
