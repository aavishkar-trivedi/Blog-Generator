
import { useState, useMemo } from 'react';
import { CssBaseline, ThemeProvider, createTheme, IconButton, Box, Typography, CircularProgress, Paper } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import axios from 'axios';
import BlogForm from './components/BlogForm';
import BlogOutput from './components/BlogOutput';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6D28D9' },
    secondary: { main: '#EC4899' },
    background: { 
      default: 'linear-gradient(to right, #e0c3fc, #8ec5fc)',
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
      default: 'linear-gradient(to right, #232526, #414345)',
      paper: '#1F2937' 
    },
    text: { primary: '#F9FAFB', secondary: '#9CA3AF' }
  },
});

export default function App() {
  const [blogData, setBlogData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('light');

  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  const generateBlog = async (inputs) => {
    setIsLoading(true);
    setBlogData(null);
    try {
      const response = await axios.post('http://localhost:5000/generate', {
        topic: inputs.topic,
        tone: inputs.tone
      });
      setBlogData(response.data); 
    } catch (err) {
      let errorMessage = 'An unexpected error occurred.';
      if (err.response) {
        errorMessage = `Error: ${err.response.status} - ${err.response.data.error || err.message}`;
      } else if (err.request) {
        errorMessage = 'Error: No response from the server. Is the Python backend running?';
      } else {
        errorMessage = `Error: ${err.message}`;
      }
      setBlogData({ blogContent: errorMessage, summary: 'Error', keywords: [] });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <style>{`
        body {
          background: ${theme.palette.background.default};
        }
      `}</style>
      <Box sx={{ p: 2, minHeight: '100vh' }}>
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Typography 
            variant="h1" 
            component="h1" 
            sx={{ fontWeight: 'bold', color: 'primary.main', textShadow: '2px 2px 8px rgba(0,0,0,0.2)' }}
          >
            AI Blog Agent
          </Typography>
        </Box>
        
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr' },
          justifyItems: 'center',
          gap: 4,
        }}>
          <Box sx={{ gridColumn: '1 / -1', width: '100%', display: 'flex', justifyContent: 'flex-end', mb: -7, mt: -6, mr: -1 }}>
            <IconButton sx={{ ml: 1 }} onClick={toggleColorMode} color="inherit">
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Box>
          
          <Box sx={{ width: { xs: '100%', md: '66.66%' } }}>
            <BlogForm onGenerate={generateBlog} isLoading={isLoading} />
          </Box>
          
          <Box sx={{ width: { xs: '100%', md: '66.66%' }, minHeight: 400 }}>
            {/* --- THIS IS THE CHANGED PART --- */}
            {isLoading ? (
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 4, 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }} color="text.secondary">Generating content...</Typography>
                </Box>
              </Paper>
            ) : (
              <BlogOutput key={blogData?.blogContent} data={blogData} />
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}