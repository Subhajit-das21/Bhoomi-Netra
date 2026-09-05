import React, { useState, useEffect } from 'react';

const BOOT_MESSAGES = [
  '> CONNECTING TO SENSOR GRID...',
  '> LOADING INTELLIGENCE LAYERS...',
  '> CALIBRATING HAZARD DETECTION...',
  '> SYNCING SATELLITE FEEDS...',
  '> INITIALIZING MAP ENGINE...',
  '> SYSTEM ONLINE ✓'
];

export default function SplashScreen({ onComplete }) {
  const [messages, setMessages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    let messageIndex = 0;
    
    // Message interval
    const msgInterval = setInterval(() => {
      if (messageIndex < BOOT_MESSAGES.length) {
        setMessages(prev => [...prev, BOOT_MESSAGES[messageIndex]]);
        messageIndex++;
      } else {
        clearInterval(msgInterval);
      }
    }, 200);

    // Progress bar animation
    const duration = 2000;
    const interval = 20;
    let currentProgress = 0;
    const progInterval = setInterval(() => {
      currentProgress += (interval / duration) * 100;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(progInterval);
      }
      setProgress(currentProgress);
    }, interval);

    // Complete sequence
    const timeout = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 500); // Wait for fade out
    }, 2500);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progInterval);
      clearTimeout(timeout);
    };
  }, []); // Empty dependency array so the boot sequence only runs once

  return (
    <div className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center font-mono text-[10px] transition-opacity duration-500 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}>
      
      <div className="w-80 flex flex-col items-center">
        {/* Logo */}
        <div className="text-2xl font-bold tracking-widest text-white/90 mb-2 glitch-container">
          <span className="mr-2">🌱</span>
          BHOOMI-NETRA
        </div>
        
        {/* Subtitle */}
        <div className="text-white/40 tracking-[0.2em] mb-12 text-center">
          ENVIRONMENTAL INTELLIGENCE GRID
        </div>

        {/* Loading Bar */}
        <div className="w-full bg-white/10 h-[2px] mb-8 overflow-hidden rounded-full">
          <div 
            className="h-full bg-amber-500 transition-all duration-[20ms] ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Console Messages */}
        <div className="w-full flex flex-col gap-2 min-h-[150px]">
          {messages.map((msg, i) => {
            const isLast = i === BOOT_MESSAGES.length - 1;
            return (
              <div 
                key={i} 
                className={`${isLast ? 'text-emerald-400 font-bold' : 'text-amber-400/80'} animate-fade-in`}
              >
                {msg}
              </div>
            );
          })}
          {/* Blinking cursor */}
          {messages.length < BOOT_MESSAGES.length && (
            <div className="w-2 h-3 bg-amber-400/80 animate-pulse mt-1" />
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}} />
    </div>
  );
}
