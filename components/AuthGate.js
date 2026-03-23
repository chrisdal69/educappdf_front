import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";

const PUBLIC_PATHNAMES = new Set(["/", "/signup", "/forgot"]);

export default function AuthGate({ children }) {
  const router = useRouter();
  const { isAuthenticated, isReady } = useSelector((state) => state.auth);

  const isPublicRoute = useMemo(
    () => PUBLIC_PATHNAMES.has(router.pathname),
    [router.pathname]
  );

  const shouldRedirect =
    router.isReady && isReady && !isAuthenticated && !isPublicRoute;

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace("/");
  }, [router, shouldRedirect]);

  if (shouldRedirect) {
    return null;
  }

  return children;
}

