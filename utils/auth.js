import { message } from "antd";
import { clearAuth } from "../reducers/authSlice";

export const SESSION_EXPIRED_MESSAGE =
  "Session expirée, veuillez vous reconnecter.";

export const throwIfUnauthorized = (response) => {
  if (!response) return;
  if (response.status === 401) {
    const error = new Error(SESSION_EXPIRED_MESSAGE);
    error.status = response.status;
    error.isAuthError = true;
    throw error;
  }
};

export const handleAuthError = (error, { dispatch, router } = {}) => {
  if (!error) return false;
  const status = error.status;
  if (error.isAuthError || status === 401) {
    message.error(SESSION_EXPIRED_MESSAGE);
    if (dispatch) dispatch(clearAuth());
    if (router && typeof router.replace === "function") {
      router.replace("/");
    }
    return true;
  }
  return false;
};
