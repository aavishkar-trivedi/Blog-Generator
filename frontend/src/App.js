import { useState, useMemo } from 'react';
import { 
  CssBaseline, 
  ThemeProvider, 
  createTheme, 
  IconButton, 
  Box, 
  Typography
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import QABlogUI from './components/QABlogUI';


// --- THEMES ---
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6D28D9' },
    secondary: { main: '#EC4899' },
    background: { 
      default: '#f9fafb',
      paper: '#FFFFFF' 
    },
    text: { primary: '#111827', secondary: '#6B7280' }
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#A78BFA' },
    secondary: { main: '#F472B6' },
    background: { 
      default: '#111827',
      paper: '#1F2937' 
    },
    text: { primary: '#F9FAFB', secondary: '#9CA3AF' }
  },
});


export default function App() {
  const [mode, setMode] = useState('light');

  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <style>{` body { background: ${theme.palette.background.default}; } `}</style>
      
      {/* Top Bar */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>AI Blog Agent</Typography>
        <IconButton onClick={toggleColorMode} color="inherit">
          {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Box>
      
      {/* Main Content - Use QABlogUI Component */}
      <Box sx={{ p: 3 }}>
        <QABlogUI />
      </Box>
    </ThemeProvider>
  );
}
