import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { App } from './App';
import './style.css';
import type { TreeAPI } from '../shared/types';

declare global { interface Window { tree: TreeAPI } }
const theme = createTheme({
  palette: { primary: { main: '#237455' }, background: { default: '#f5f7f4', paper: '#ffffff' },
    text: { primary: '#20332e', secondary: '#75847c' } },
  typography: { fontFamily: '"Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif', fontSize: 13,
    h4: { fontWeight: 700, fontSize: '1.8rem' }, h6: { fontWeight: 700, fontSize: '1rem' }, button: { textTransform: 'none', fontWeight: 600 } },
  shape: { borderRadius: 9 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0, variant: 'outlined' } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiChip: { defaultProps: { size: 'small' } },
  },
});
createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider theme={theme}><CssBaseline /><App /></ThemeProvider></React.StrictMode>);
