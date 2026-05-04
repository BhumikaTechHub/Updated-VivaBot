import React, { useState, useEffect, useRef } from 'react';

/**
 * Realistic Female Avatar with real-time lip-sync animation.
 * 
 * Features:
 * - Detailed feminine face with long hair, eyelashes, soft features
 * - 5 viseme mouth shapes for realistic lip-sync
 * - Natural eye blinking
 * - Subtle head/breathing motion
 */

const VISEMES = {
  rest:   { mouth: 'M 85,148 Q 100,152 115,148',                           inner: null, openY: 0 },
  small:  { mouth: 'M 85,148 Q 100,155 115,148 Q 100,151 85,148',          inner: 'M 88,149 Q 100,153 112,149', openY: 3 },
  medium: { mouth: 'M 83,148 Q 100,160 117,148 Q 100,153 83,148',          inner: 'M 87,149 Q 100,157 113,149', openY: 6 },
  wide:   { mouth: 'M 82,147 Q 100,165 118,147 Q 100,155 82,147',          inner: 'M 86,149 Q 100,161 114,149', openY: 9 },
  round:  { mouth: 'M 90,147 Q 100,162 110,147 Q 100,153 90,147',          inner: 'M 93,149 Q 100,158 107,149', openY: 8 },
};

const VISEME_SEQ = ['rest','small','medium','wide','round','medium','small','wide','medium','round','small','rest'];

export default function Avatar({ isSpeaking }) {
  const [viseme, setViseme] = useState('rest');
  const [blink, setBlink] = useState(false);
  const [breathe, setBreathe] = useState(0);
  const frameRef = useRef(null);
  const idxRef = useRef(0);
  const lastRef = useRef(0);

  // Lip-sync loop
  useEffect(() => {
    if (!isSpeaking) {
      setViseme('rest');
      idxRef.current = 0;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }
    const run = (t) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= 90 + Math.random() * 90) {
        idxRef.current = (idxRef.current + 1) % VISEME_SEQ.length;
        setViseme(VISEME_SEQ[idxRef.current]);
        lastRef.current = t;
      }
      frameRef.current = requestAnimationFrame(run);
    };
    frameRef.current = requestAnimationFrame(run);
    return () => { cancelAnimationFrame(frameRef.current); lastRef.current = 0; };
  }, [isSpeaking]);

  // Blinking
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
    }, 2800 + Math.random() * 2200);
    return () => clearInterval(id);
  }, []);

  // Subtle breathing
  useEffect(() => {
    let frame;
    const run = (t) => {
      setBreathe(Math.sin(t / 1500) * 1.2);
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, []);

  const v = VISEMES[viseme] || VISEMES.rest;
  const eyeRy = blink ? 0.8 : 7;

  return (
    <div className="flex flex-col items-center justify-center p-4 glass-card overflow-hidden h-full min-h-0">
      <div className="relative flex items-center justify-center">
        {/* Speaking aura */}
        {isSpeaking && (
          <>
            <div className="absolute w-52 h-52 rounded-full bg-primary-500/10 animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="absolute w-56 h-56 rounded-full bg-purple-500/8 animate-pulse" style={{ animationDuration: '2s' }} />
          </>
        )}

        <svg
          viewBox="0 0 200 240"
          className="relative z-10 w-full h-full max-w-[280px] max-h-[320px] object-contain"
          style={{ transform: `translateY(${breathe}px)` }}
        >
          <defs>
            <radialGradient id="skinG" cx="50%" cy="38%" r="55%">
              <stop offset="0%" stopColor="#fce4c8" />
              <stop offset="60%" stopColor="#f5cfa8" />
              <stop offset="100%" stopColor="#e6b888" />
            </radialGradient>
            <linearGradient id="hairG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a0a00" />
              <stop offset="40%" stopColor="#2d1608" />
              <stop offset="100%" stopColor="#3d200e" />
            </linearGradient>
            <linearGradient id="hairHL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5a3520" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <linearGradient id="lipG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e07080" />
              <stop offset="100%" stopColor="#c85565" />
            </linearGradient>
            <radialGradient id="irisG" cx="45%" cy="42%" r="50%">
              <stop offset="0%" stopColor="#6b4423" />
              <stop offset="50%" stopColor="#4a2d15" />
              <stop offset="100%" stopColor="#2a180a" />
            </radialGradient>
            <radialGradient id="blushG" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f0a090" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f0a090" stopOpacity="0" />
            </radialGradient>
            <filter id="softSh" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="0" dy="2" />
              <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
              <feFlood floodColor="#00000030" />
              <feComposite in2="SourceGraphic" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ===== NECK ===== */}
          <path d="M 88,165 Q 88,178 85,190 L 115,190 Q 112,178 112,165" fill="#f0c498" />
          {/* Neck shadow */}
          <ellipse cx="100" cy="167" rx="14" ry="3" fill="#ddb080" opacity="0.3" />

          {/* ===== SHOULDERS / TOP ===== */}
          <path d="M 40,215 Q 55,190 85,188 L 100,195 L 115,188 Q 145,190 160,215 L 165,240 L 35,240 Z" fill="#6366f1" />
          {/* Collar V-neck */}
          <path d="M 88,188 L 100,205 L 112,188" fill="#4f46e5" />
          <path d="M 88,188 L 100,205 L 112,188" fill="none" stroke="#818cf8" strokeWidth="0.8" />

          {/* ===== BACK HAIR (behind face) ===== */}
          <path d="M 38,95 Q 35,130 40,170 Q 42,180 48,175 Q 44,140 46,100 Z" fill="url(#hairG)" />
          <path d="M 162,95 Q 165,130 160,170 Q 158,180 152,175 Q 156,140 154,100 Z" fill="url(#hairG)" />
          {/* Long flowing hair behind shoulders */}
          <path d="M 40,170 Q 38,200 45,230 Q 48,235 52,228 Q 46,200 48,175 Z" fill="url(#hairG)" opacity="0.85" />
          <path d="M 160,170 Q 162,200 155,230 Q 152,235 148,228 Q 154,200 152,175 Z" fill="url(#hairG)" opacity="0.85" />

          {/* ===== FACE ===== */}
          <ellipse cx="100" cy="108" rx="52" ry="60" fill="url(#skinG)" filter="url(#softSh)" />

          {/* Face contour shadow */}
          <path d="M 52,95 Q 48,120 55,145 Q 60,155 70,162 Q 80,168 100,170 Q 120,168 130,162 Q 140,155 145,145 Q 152,120 148,95"
            fill="none" stroke="#ddb080" strokeWidth="0.5" opacity="0.4" />

          {/* ===== HAIR (front) ===== */}
          {/* Main hair volume */}
          <path d="M 42,92 Q 40,50 65,30 Q 80,20 100,18 Q 120,20 135,30 Q 160,50 158,92 
                   Q 158,70 148,55 Q 138,40 120,32 Q 105,28 100,28 Q 95,28 80,32 Q 62,40 52,55 Q 42,70 42,92 Z" 
            fill="url(#hairG)" />
          {/* Hair highlight */}
          <path d="M 70,30 Q 85,22 100,20 Q 100,24 85,30 Q 72,38 65,50 Q 60,40 70,30 Z"
            fill="url(#hairHL)" />
          {/* Bangs / fringe */}
          <path d="M 55,75 Q 58,55 72,42 Q 80,36 90,34 Q 82,50 75,65 Q 70,75 55,80 Z" fill="url(#hairG)" />
          <path d="M 145,75 Q 142,55 128,42 Q 120,36 110,34 Q 118,50 125,65 Q 130,75 145,80 Z" fill="url(#hairG)" />
          {/* Side hair framing face */}
          <path d="M 48,90 Q 44,78 48,65 Q 42,82 42,100 Q 43,115 50,120 Q 46,108 48,90 Z" fill="url(#hairG)" />
          <path d="M 152,90 Q 156,78 152,65 Q 158,82 158,100 Q 157,115 150,120 Q 154,108 152,90 Z" fill="url(#hairG)" />

          {/* ===== EYEBROWS ===== */}
          <path d="M 66,84 Q 72,78 80,79 Q 86,80 90,83" fill="none" stroke="#3d200e" strokeWidth="2" strokeLinecap="round" />
          <path d="M 110,83 Q 114,80 120,79 Q 128,78 134,84" fill="none" stroke="#3d200e" strokeWidth="2" strokeLinecap="round" />

          {/* ===== EYES ===== */}
          {/* Left eye */}
          <g>
            {/* Eye white */}
            <ellipse cx="78" cy="96" rx="13" ry={eyeRy} fill="white" style={{ transition: 'ry 100ms ease' }} />
            {!blink && (<>
              {/* Iris */}
              <circle cx="78" cy="96" r="5.5" fill="url(#irisG)" />
              {/* Pupil */}
              <circle cx="78" cy="96" r="2.8" fill="#0a0502" />
              {/* Catchlight */}
              <circle cx="80.5" cy="93.5" r="1.8" fill="white" opacity="0.9" />
              <circle cx="76" cy="98" r="0.8" fill="white" opacity="0.5" />
            </>)}
            {/* Upper eyelid line */}
            <path d={`M 65,${blink ? 96 : 90} Q 78,${blink ? 95 : 86} 91,${blink ? 96 : 90}`}
              fill="none" stroke="#3d200e" strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'all 100ms ease' }} />
            {/* Eyelashes */}
            {!blink && (<>
              <line x1="66" y1="90" x2="63" y2="86" stroke="#2d1608" strokeWidth="1" strokeLinecap="round" />
              <line x1="70" y1="88" x2="68" y2="84" stroke="#2d1608" strokeWidth="1" strokeLinecap="round" />
              <line x1="75" y1="87" x2="74" y2="83" stroke="#2d1608" strokeWidth="1" strokeLinecap="round" />
              <line x1="80" y1="87" x2="80" y2="83" stroke="#2d1608" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="85" y1="88" x2="86" y2="84" stroke="#2d1608" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="89" y1="90" x2="91" y2="87" stroke="#2d1608" strokeWidth="0.8" strokeLinecap="round" />
            </>)}
            {/* Lower lash line */}
            <path d="M 67,101 Q 78,104 89,101" fill="none" stroke="#c8a080" strokeWidth="0.5" opacity="0.5" />
          </g>

          {/* Right eye */}
          <g>
            <ellipse cx="122" cy="96" rx="13" ry={eyeRy} fill="white" style={{ transition: 'ry 100ms ease' }} />
            {!blink && (<>
              <circle cx="122" cy="96" r="5.5" fill="url(#irisG)" />
              <circle cx="122" cy="96" r="2.8" fill="#0a0502" />
              <circle cx="124.5" cy="93.5" r="1.8" fill="white" opacity="0.9" />
              <circle cx="120" cy="98" r="0.8" fill="white" opacity="0.5" />
            </>)}
            <path d={`M 109,${blink ? 96 : 90} Q 122,${blink ? 95 : 86} 135,${blink ? 96 : 90}`}
              fill="none" stroke="#3d200e" strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'all 100ms ease' }} />
            {!blink && (<>
              <line x1="110" y1="90" x2="108" y2="87" stroke="#2d1608" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="114" y1="88" x2="113" y2="84" stroke="#2d1608" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="119" y1="87" x2="118" y2="83" stroke="#2d1608" strokeWidth="1" strokeLinecap="round" />
              <line x1="124" y1="87" x2="124" y2="83" stroke="#2d1608" strokeWidth="1" strokeLinecap="round" />
              <line x1="129" y1="88" x2="130" y2="84" stroke="#2d1608" strokeWidth="1" strokeLinecap="round" />
              <line x1="133" y1="90" x2="136" y2="86" stroke="#2d1608" strokeWidth="1" strokeLinecap="round" />
            </>)}
            <path d="M 111,101 Q 122,104 133,101" fill="none" stroke="#c8a080" strokeWidth="0.5" opacity="0.5" />
          </g>

          {/* ===== NOSE ===== */}
          <path d="M 99,102 Q 97,115 93,125 Q 96,128 100,128.5 Q 104,128 107,125 Q 103,115 101,102"
            fill="none" stroke="#ddb080" strokeWidth="1.2" strokeLinecap="round" />
          {/* Nostril hints */}
          <circle cx="95" cy="126" r="1.5" fill="#ddb080" opacity="0.5" />
          <circle cx="105" cy="126" r="1.5" fill="#ddb080" opacity="0.5" />

          {/* ===== CHEEK BLUSH ===== */}
          <circle cx="62" cy="118" r="14" fill="url(#blushG)" />
          <circle cx="138" cy="118" r="14" fill="url(#blushG)" />

          {/* ===== MOUTH ===== */}
          <g>
            {/* Upper lip shape */}
            <path
              d={`M 85,147 Q 92,143 97,144 L 100,142 L 103,144 Q 108,143 115,147`}
              fill="url(#lipG)" stroke="#b8485a" strokeWidth="0.5"
            />
            {/* Cupid's bow highlight */}
            <path d="M 95,144 Q 100,141 105,144" fill="none" stroke="#f0a0a8" strokeWidth="0.5" opacity="0.6" />
            
            {/* Mouth opening / lower lip */}
            <path
              d={v.mouth}
              fill={viseme !== 'rest' && isSpeaking ? '#2a0810' : 'url(#lipG)'}
              stroke="#b8485a" strokeWidth="0.5"
              style={{ transition: 'all 80ms ease' }}
            />
            
            {/* Teeth visible when open */}
            {isSpeaking && v.openY > 3 && (
              <rect x="93" y="148.5" width="14" height={Math.min(v.openY * 0.5, 4)}
                rx="1.5" fill="white" opacity="0.9" style={{ transition: 'all 80ms ease' }} />
            )}

            {/* Inner mouth darkness */}
            {isSpeaking && v.inner && (
              <path d={v.inner} fill="#1a0508" opacity="0.6" style={{ transition: 'all 80ms ease' }} />
            )}

            {/* Lower lip highlight */}
            <path
              d={`M 88,${150 + v.openY * 0.4} Q 100,${153 + v.openY * 0.5} 112,${150 + v.openY * 0.4}`}
              fill="none" stroke="#f0b0b8" strokeWidth="0.8" opacity="0.4"
              style={{ transition: 'all 80ms ease' }}
            />
          </g>

          {/* ===== EARRINGS ===== */}
          <circle cx="48" cy="108" r="2.5" fill="#f0d080" opacity="0.7" />
          <circle cx="48" cy="113" r="1.5" fill="#f0d080" opacity="0.5" />
          <circle cx="152" cy="108" r="2.5" fill="#f0d080" opacity="0.7" />
          <circle cx="152" cy="113" r="1.5" fill="#f0d080" opacity="0.5" />

          {/* ===== SUBTLE FACE DETAILS ===== */}
          {/* Smile lines (faint) */}
          <path d="M 75,135 Q 78,140 82,143" fill="none" stroke="#ddb080" strokeWidth="0.4" opacity="0.3" />
          <path d="M 125,135 Q 122,140 118,143" fill="none" stroke="#ddb080" strokeWidth="0.4" opacity="0.3" />
        </svg>
      </div>

      <div className="mt-3 text-center">
        <h3 className="text-lg font-bold text-slate-900 mb-0.5">AI Examiner</h3>
        <p className={`text-sm transition-colors duration-300 ${isSpeaking ? 'text-primary-600 font-bold' : 'text-slate-500 font-medium'}`}>
          {isSpeaking ? (
            <span className="flex items-center justify-center gap-2">
              <span className="flex gap-0.5 items-end">
                <span className="w-1 h-2.5 bg-primary-600 rounded-full animate-[pulse_0.4s_ease-in-out_infinite]" />
                <span className="w-1 h-3.5 bg-primary-600 rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" style={{ animationDelay: '0.1s' }} />
                <span className="w-1 h-2.5 bg-primary-600 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" style={{ animationDelay: '0.2s' }} />
                <span className="w-1 h-4 bg-primary-600 rounded-full animate-[pulse_0.45s_ease-in-out_infinite]" style={{ animationDelay: '0.15s' }} />
                <span className="w-1 h-2 bg-primary-600 rounded-full animate-[pulse_0.55s_ease-in-out_infinite]" style={{ animationDelay: '0.25s' }} />
              </span>
              Speaking...
            </span>
          ) : 'Listening...'}
        </p>
      </div>
    </div>
  );
}
