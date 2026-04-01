import { DockerMuiV6ThemeProvider } from '@docker/docker-mui-theme';
import CssBaseline from '@mui/material/CssBaseline';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DockerMuiV6ThemeProvider>
      <CssBaseline />
      <App />
    </DockerMuiV6ThemeProvider>
  </React.StrictMode>,
);
