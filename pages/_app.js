import '../styles/globals.css';
import '../styles/theme.css';
import Head from 'next/head';
import '@ant-design/v5-patch-for-react-19';
import { ConfigProvider, unstableSetRender } from 'antd';
import themeTokens from '../themeTokens';
import { appFonts, fontFamily } from '../themeFonts';
import { createRoot } from 'react-dom/client';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from "../reducers/authSlice";
import cardsMaths from "../reducers/cardsMathsSlice";
import { useEffect } from "react";
import { setAuthenticated, setAuthReady } from "../reducers/authSlice";

const store = configureStore({
 reducer: {
    auth: authReducer,
    cardsMaths,
  },
}); 

const cssVars = `
:root {
  --color-bg: ${themeTokens.colors.bg};
  --color-bg2: ${themeTokens.colors.bg2};
  --color-bg3: ${themeTokens.colors.bg3};
  --color-surface: ${themeTokens.colors.surface};
  --color-primary: ${themeTokens.colors.primary};
  --color-text: ${themeTokens.colors.text};
  --color-muted: ${themeTokens.colors.muted};
  --color-bouton: ${themeTokens.colors.bouton};
  --radius-lg: ${themeTokens.radius.lg};
}
`;

const antTheme = {
  token: {
    colorBgLayout: themeTokens.colors.bg,
    colorBgContainer: themeTokens.colors.surface,
    colorPrimary: themeTokens.colors.primary,
    colorText: themeTokens.colors.text,
    colorTextSecondary: themeTokens.colors.muted,
    fontFamily: fontFamily.sans,
  },
};

unstableSetRender((node, container) => {
  container._reactRoot ||= createRoot(container);
  const root = container._reactRoot;
  root.render(node);
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    root.unmount();
  };
});


function App({ Component, pageProps }) {
  useEffect(() => {
    const current = store.getState()?.auth;
    if (current?.isReady) {
      return;
    }

    const NODE_ENV = process.env.NODE_ENV;
    const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

    fetch(`${urlFetch}/auth/me`, { credentials: "include" })
      .then(async (res) => {
        const latest = store.getState()?.auth;
        if (latest?.isAuthenticated) {
          return;
        }
        if (!res.ok) {
          store.dispatch(setAuthReady());
          return;
        }
        const payload = await res.json();
        const user = payload?.user || null;
        if (user) {
          store.dispatch(setAuthenticated(user));
        } else {
          store.dispatch(setAuthReady());
        }
      })
      .catch(() => {
        store.dispatch(setAuthReady());
      });
  }, []);

  return (
    <Provider store={store}>
      <ConfigProvider theme={antTheme}>
        <Head>
          <title>Mathsapp</title>
        </Head>
        <style jsx global>
          {cssVars}
        </style>
        <div className={`${appFonts.sans.variable} ${appFonts.display.variable} ${appFonts.script.variable} app-root`}>
          <Component {...pageProps} />
          <Footer/>
        </div>
      </ConfigProvider>
    </Provider>
  );
}

export default App;
