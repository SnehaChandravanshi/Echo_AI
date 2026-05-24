// TranscriptContext.js
import React, { createContext, useContext, useState } from 'react';

export const TranscriptContext = createContext();

export const TranscriptProvider = ({ children }) => {
  const [transcript, setTranscript] = useState('');
  return (
    <TranscriptContext.Provider value={{ transcript, setTranscript }}>
      {children}
    </TranscriptContext.Provider>
  );
};

// ✅ THIS WAS MISSING:
export const useTranscript = () => useContext(TranscriptContext);
