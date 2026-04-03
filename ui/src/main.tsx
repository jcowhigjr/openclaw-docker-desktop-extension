import { DockerMuiV6ThemeProvider } from '@docker/docker-mui-theme';
import CssBaseline from '@mui/material/CssBaseline';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

type ThemeWindow = Window & {
  __ddMuiV6Themes?: {
    light: unknown;
    dark: unknown;
  };
};

function ensureBrowserThemes() {
  const themeWindow = window as unknown as ThemeWindow;
  if (themeWindow.__ddMuiV6Themes) {
    return;
  }

  themeWindow.__ddMuiV6Themes = {
    light: {
      palette: {
        mode: 'light',
        primary: { main: '#0b57d0' },
        secondary: { main: '#00695f' },
        background: { default: '#f4f6fb', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: '#8ab4f8' },
        secondary: { main: '#5fd3bc' },
        background: { default: '#0f172a', paper: '#111827' },
      },
    },
  };
}

ensureBrowserThemes();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DockerMuiV6ThemeProvider>
      <CssBaseline />
      <App />
    </DockerMuiV6ThemeProvider>
  </React.StrictMode>,
);
