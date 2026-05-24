import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranscript } from './TranscriptContext';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { ArrowLeft, MicOff } from 'lucide-react';

const VoiceSphere = () => {
  const { setTranscript: setSavedTranscript } = useTranscript();
  const bgCanvasRef = useRef(null);
  const waveCanvasRef = useRef(null);
  const [localTranscript, setLocalTranscript] = useState("Listening...");
  const navigate = useNavigate();
  const requestRef = useRef();
  const timeoutRef = useRef(null);

  const { transcript, listening, resetTranscript } = useSpeechRecognition();

  // Auto-submit after 5 seconds of silence (no transcript change)
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (localTranscript && localTranscript !== "Listening...") {
      timeoutRef.current = setTimeout(() => {
        handleStop();
      }, 5000); // 5 seconds
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localTranscript]); // Run this effect every time the transcript updates

  // Update local state when speech recognition transcription changes
  useEffect(() => {
    if (transcript) {
      setLocalTranscript(transcript);
    }
  }, [transcript]);

  const handleStop = () => {
    SpeechRecognition.stopListening();
    if (localTranscript && localTranscript.trim() !== "" && localTranscript !== "Listening...") {
      setSavedTranscript(localTranscript);
    } else {
      setSavedTranscript("");
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    navigate("/");
  };

  useEffect(() => {
    const lang = localStorage.getItem('voiceLang') || 'en-US';
    SpeechRecognition.startListening({ continuous: true, language: lang });
    return () => {
      SpeechRecognition.stopListening();
    };
  }, []);

  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const bgCtx = bgCanvas.getContext("2d");
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext("2d");

    let animationFrameId;
    let audioCtx, analyser, dataArray;
    let source;

    const resizeCanvas = () => {
      if (canvas && bgCanvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    let centerX = canvas.width / 2;
    let centerY = canvas.height / 2;

    let baseParticles = 500;
    let maxParticles = 800;
    let particles = [];

    const generateParticles = (count) => {
      const arr = [];
      for (let i = 0; i < count; i++) {
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = 2 * Math.PI * Math.random();
        arr.push({ theta, phi });
      }
      return arr;
    };
    particles = generateParticles(baseParticles);

    const stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random(),
      speed: Math.random() * 0.002 + 0.001,
    }));

    // Setup Audio with Noise Suppression and Echo Cancellation
    const setupMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaStreamSource(stream);

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);
      } catch (err) {
        console.error("Mic access denied", err);
      }
    };
    setupMic();

    let angleY = 0;
    let smoothedPitch = 0;

    const animate = () => {
      if (!canvas || !bgCanvas) return;

      // Draw Stars Background
      bgCtx.fillStyle = '#050505'; // Deep dark background
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      stars.forEach((star) => {
        star.alpha += star.speed * (Math.random() > 0.5 ? 1 : -1);
        if (star.alpha > 1) star.alpha = 1;
        if (star.alpha < 0.2) star.alpha = 0.2;
        bgCtx.beginPath();
        bgCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        bgCtx.fill();
      });


      // Audio Data
      let rawPitch = 0;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        // Simple average for intensity/pitch sim
        const sum = dataArray.reduce((a, b) => a + b, 0);
        rawPitch = sum / dataArray.length;
      }

      smoothedPitch = 0.9 * smoothedPitch + 0.1 * rawPitch;
      const pitchNorm = Math.min(smoothedPitch / 100, 1); // Normalize 0-1

      // Update Particles
      const targetCount = Math.floor(baseParticles + pitchNorm * (maxParticles - baseParticles));
      if (Math.abs(targetCount - particles.length) > 20) {
        if (targetCount > particles.length) {
            const added = generateParticles(targetCount - particles.length);
            particles.push(...added);
        } else {
            particles.splice(0, particles.length - targetCount);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const radius = Math.min(canvas.width, canvas.height) / 3.5;
      const fov = 300;

      angleY += 0.002 + (pitchNorm * 0.01); // Spin faster with sound

      // Sphere Color
      const r = 0;
      const g = Math.floor(50 + pitchNorm * 200);
      const b = 255;
      const color = `rgba(${r}, ${g}, ${b}, ${0.5 + pitchNorm * 0.5})`;

      for (let i = 0; i < particles.length; i++) {
        const { theta, phi } = particles[i];

        let modRadius = radius + (Math.random() * pitchNorm * 50); // Jitter effect

        const x3d = modRadius * Math.sin(theta) * Math.cos(phi + angleY);
        const y3d = modRadius * Math.cos(theta);
        const z3d = modRadius * Math.sin(theta) * Math.sin(phi + angleY);

        if (fov + z3d <= 0.1) continue; // Prevent division by zero, negative scale, and particle rendering behind the camera

        const scale = fov / (fov + z3d);
        const x2d = centerX + x3d * scale;
        const y2d = centerY + y3d * scale;
        const size = Math.max(0.1, scale * 2);

        ctx.beginPath();
        ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.shadowBlur = Math.max(0, 10 * scale);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
      if (audioCtx) audioCtx.close();
      if (source) source.disconnect();
    };
  }, []);


  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas ref={bgCanvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
      <canvas ref={waveCanvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />

      {/* Overlay UI */}
      <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 10 }}>
        <button
          onClick={handleStop}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'white',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80%',
        maxWidth: '800px',
        textAlign: 'center',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        pointerEvents: 'auto'
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: '1.5rem',
          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          background: 'rgba(0,0,0,0.3)',
          padding: '20px',
          borderRadius: '15px',
          backdropFilter: 'blur(5px)',
          width: '100%',
          boxSizing: 'border-box',
          margin: 0
        }}>
          {localTranscript}
        </p>

        <button
          onClick={handleStop}
          style={{
            background: 'rgba(231, 76, 60, 0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(231, 76, 60, 0.3)',
            color: '#ff6b6b',
            padding: '12px 32px',
            borderRadius: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            boxShadow: '0 8px 32px rgba(231, 76, 60, 0.15)',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.background = 'rgba(231, 76, 60, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(231, 76, 60, 0.5)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(231, 76, 60, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(231, 76, 60, 0.3)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(231, 76, 60, 0.15)';
          }}
        >
          <MicOff size={18} /> Stop Listening
        </button>
      </div>
    </div>
  );
};

export default VoiceSphere;
