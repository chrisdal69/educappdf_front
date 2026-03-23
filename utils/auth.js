import { message } from "antd";
import { clearAuth } from "../reducers/authSlice";

export const SESSION_EXPIRED_MESSAGE =
  "Session expirée - Se reconnecter";

export const createSessionExpiredRedirect = ({
  dispatch,
  router,
  notify,
  delayMs = 3000,
  redirectTo = "/",
} = {}) => {
  let timeoutId = null;
  let triggered = false;

  const cancel = () => {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  const trigger = () => {
    if (triggered) return;
    triggered = true;

    if (typeof notify === "function") {
      notify(SESSION_EXPIRED_MESSAGE);
    }

    timeoutId = setTimeout(() => {
      if (dispatch) dispatch(clearAuth());
      if (router && typeof router.replace === "function") {
        router.replace(redirectTo);
      }
    }, delayMs);
  };

  return { trigger, cancel };
};

export const throwIfUnauthorized = (response) => {
  if (!response) return;
  if (response.status === 401) {
    const error = new Error(SESSION_EXPIRED_MESSAGE);
    error.status = response.status;
    error.isAuthError = true;
    throw error;
  }
};

export const handleAuthError = (
  error,
  { dispatch, router, silent = false } = {}
) => {
  if (!error) return false;
  const status = error.status;
  if (error.isAuthError || status === 401) {
    if (!silent) {
      message.error(SESSION_EXPIRED_MESSAGE);
    }
    if (dispatch) dispatch(clearAuth());
    if (router && typeof router.replace === "function") {
      router.replace("/");
    }
    return true;
  }
  return false;
};
