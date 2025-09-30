// CelebrationOverlay.jsx
import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Howl, Howler } from 'howler';
import './celebration.css';

export default function CelebrationOverlay({ show, onClose, title = "DEAL CLOSED!", subtitle, videoSrc = "/celebrate/victory.mp4" }) {
  const cleanups = useRef([]);
  const airhornRef = useRef(null);
  const crowdRef = useRef(null);
  const videoRef = useRef(null);

  // Fire confetti bursts for ~6s
  const startConfetti = () => {
    const end = Date.now() + 6000;
    const colors = ['#ffd600', '#ff0059', '#00f5d4', '#845ef7', '#ff7b00', '#00b4d8'];

    const frame = () => {
      confetti({
        particleCount: 80,
        startVelocity: 45,
        scalar: 1.1,
        spread: 70,
        angle: 60,
        origin: { x: 0, y: 0.6 },
        colors,
        zIndex: 999999,
      });
      confetti({
        particleCount: 80,
        startVelocity: 45,
        scalar: 1.1,
        spread: 70,
        angle: 120,
        origin: { x: 1, y: 0.6 },
        colors,
        zIndex: 999999,
      });

      if (Date.now() < end) {
        cleanups.current.push(setTimeout(frame, 350 + Math.random() * 200));
      }
    };
    frame();

    // Finale
    cleanups.current.push(setTimeout(() => {
      confetti({
        particleCount: 300,
        startVelocity: 55,
        spread: 120,
        origin: { x: 0.5, y: 0.4 },
        colors,
        zIndex: 999999,
      });
    }, 2000));
  };

  // Big sounds (airhorn once, crowd loop quietly under it)
  const startAudio = async () => {
    try {
      // ensure context unlocked (must be called after a user gesture)
      await Howler.ctx.resume();
    } catch {}

    airhornRef.current = new Howl({ src: ['/celebrate/airhorn.mp3'], volume: 1.0 });
    crowdRef.current  = new Howl({ src: ['/celebrate/crowd.mp3'],  volume: 0.5, loop: true });

    // Staggered start for extra drama
    airhornRef.current.play();
    cleanups.current.push(setTimeout(() => crowdRef.current?.play(), 400));
  };

  const stopAudio = () => {
    airhornRef.current?.stop();
    crowdRef.current?.stop();
  };

  useEffect(() => {
    if (!show) return;
    startConfetti();
    startAudio();

    // Attempt to autoplay video (will likely work since user interacted)
    cleanups.current.push(setTimeout(() => {
      try { videoRef.current?.play(); } catch {}
    }, 100));

    return () => {
      // cleanup timers
      cleanups.current.forEach(c => clearTimeout(c));
      cleanups.current = [];
      stopAudio();
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className="celebrate-overlay" role="dialog" aria-modal="true">
      <div className="celebrate-inner">
        <h1 className="celebrate-title">{title}</h1>
        {subtitle && <div className="celebrate-subtitle">{subtitle}</div>}

        {/* Prefer a video (MP4 / WebM). If you like a GIF, just swap the tag. */}
        {videoSrc?.endsWith('.gif') ? (
          <img src={videoSrc} alt="celebration" className="celebrate-media" />
        ) : (
          <video
            ref={videoRef}
            className="celebrate-media"
            src={videoSrc}
            autoPlay
            playsInline
            // intentionally not muted — we’re using Howler for loud audio track
            onEnded={() => {}}
          />
        )}

        <div className="celebrate-controls">
          <button className="btn btn-light me-2" onClick={() => crowdRef.current?.mute(!crowdRef.current?._muted)}>
            {crowdRef.current?._muted ? 'Unmute Crowd' : 'Mute Crowd'}
          </button>
          <button className="btn btn-danger" onClick={onClose}>
            OK, enough 🎉
          </button>
        </div>
      </div>
    </div>
  );
}
