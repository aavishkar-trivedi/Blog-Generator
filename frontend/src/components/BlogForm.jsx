import { useState } from 'react';
import { Box, TextField, Button, MenuItem, CircularProgress } from '@mui/material';

export default function BlogForm({ onGenerate, isLoading }) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Professional');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (topic.trim()) {
      onGenerate({ topic, tone });
    }
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit} 
      sx={{ 
        p: 4, 
        borderRadius: 4,
        height: '100%',
        bgcolor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }}
    >
      {/* The Typography component for the title inside the box has been removed */}
      
      <TextField
        label="Blog Topic"
        variant="outlined"
        fullWidth
        required
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        margin="normal"
        sx={{
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              transition: 'border-color 0.3s ease-in-out',
              borderColor: 'rgba(255, 255, 255, 0.5)',
            },
            '&:hover fieldset': {
              borderColor: 'primary.main',
            },
             '& .MuiInputBase-input': { color: 'text.primary' },
          },
           '& .MuiInputLabel-root': { color: 'text.secondary' },
        }}
      />
      
      <TextField
        select
        label="Tone"
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        fullWidth
        margin="normal"
         sx={{
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
            },
          },
        }}
      >
        <MenuItem value="Professional">Professional</MenuItem>
        <MenuItem value="Casual">Casual</MenuItem>
        <MenuItem value="Enthusiastic">Enthusiastic</MenuItem>
        <MenuItem value="Witty">Witty</MenuItem>
      </TextField>
      
      <Button 
        type="submit" 
        variant="contained" 
        size="large" 
        fullWidth 
        disabled={isLoading}
        sx={{ 
          mt: 2, 
          py: 1.5,
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.02)',
            boxShadow: '0 4px 20px -5px rgba(0,0,0,0.4)',
          },
          '&:active': {
            transform: 'scale(0.98)',
          }
        }}
      >
        {isLoading ? (
          <>
            <CircularProgress size={24} sx={{ color: 'white', mr: 1 }} />
            Generating...
          </>
        ) : 'Generate Blog'}
      </Button>
    </Box>
  );
}
