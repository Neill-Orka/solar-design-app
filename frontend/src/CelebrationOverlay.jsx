import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Howl, Howler } from 'howler';
import './celebration.css';

// Array of celebration media for randomization and multiple displays
const CELEBRATION_VIDEOS = [
  '/celebrate/Dance Reaction GIF.gif',
  '/celebrate/Drunk On One GIF.gif',
  '/celebrate/Happy Birthday Reaction GIF.gif',
  '/celebrate/Happy So Excited GIF.gif',
  '/celebrate/Make It Rain Money GIF by SpongeBob SquarePants.gif',
  '/celebrate/Make It Rain Money GIF.gif',
  '/celebrate/money GIF.gif'
];

// Array of sound effects to play in sequence or together
const SOUND_EFFECTS = [
  { src: '/celebrate/98385__the-baron__laugh.wav', volume: 1, delay: 0 },
  { src: '/celebrate/In the Jungle.mp3', volume: 1, delay: 2500 }
];

export default function CelebrationOverlay({ 
  show, 
  onClose, 
  title = "JA MANNNEEEEEE!", 
  subtitle, 
  videoSrc
}) {
  const cleanups = useRef([]);
  const soundsRef = useRef([]);
  const crowdRef = useRef(null);
  const videoRef = useRef(null);
  const [shakeLevel, setShakeLevel] = useState(0);
  const [randomGifs, setRandomGifs] = useState([]);
  const [flashState, setFlashState] = useState(false);
  
  // Random video if none provided
  const mainVideo = videoSrc || CELEBRATION_VIDEOS[Math.floor(Math.random() * CELEBRATION_VIDEOS.length)];
  
  // Fire confetti bursts for ~30s with increased intensity
  const startConfetti = () => {
    const end = Date.now() + 30000;
    const colors = ['#ffd600', '#ff0059', '#00f5d4', '#845ef7', '#ff7b00', '#00b4d8', '#ff3d00', '#76ff03'];

    const frame = () => {
      // Left cannon
      confetti({
        particleCount: 100,
        startVelocity: 55,
        scalar: 1.2,
        spread: 80,
        angle: 60,
        origin: { x: 0, y: 0.6 },
        colors,
        zIndex: 999999,
      });
      
      // Right cannon
      confetti({
        particleCount: 100,
        startVelocity: 55,
        scalar: 1.2,
        spread: 80,
        angle: 120,
        origin: { x: 1, y: 0.6 },
        colors,
        zIndex: 999999,
      });
      
      // Random bursts from center
      if (Math.random() > 0.7) {
        confetti({
          particleCount: 150,
          startVelocity: 65,
          spread: 100,
          origin: { 
            x: 0.3 + Math.random() * 0.4, 
            y: 0.3 + Math.random() * 0.3 
          },
          colors,
          zIndex: 999999,
        });
      }

      if (Date.now() < end) {
        cleanups.current.push(setTimeout(frame, 200 + Math.random() * 150));
      }
    };
    frame();

    // Multiple finales over time
    [2000, 4000, 6000, 8000].forEach(delay => {
      cleanups.current.push(setTimeout(() => {
        confetti({
          particleCount: 400,
          startVelocity: 65,
          spread: 180,
          origin: { x: 0.5, y: 0.4 },
          colors,
          zIndex: 999999,
        });
      }, delay));
    });
  };

  // Start all audio effects
  const startAudio = async () => {
    try {
      await Howler.ctx.resume();
    } catch {}

    // Background crowd
    crowdRef.current = new Howl({ src: ['/celebrate/crowd.mp3'], volume: 0.6, loop: true });
    crowdRef.current.play();
    
    // Play all sound effects with their delays
    SOUND_EFFECTS.forEach(sound => {
      cleanups.current.push(setTimeout(() => {
        const sfx = new Howl({ src: [sound.src], volume: sound.volume });
        sfx.play();
        soundsRef.current.push(sfx);
      }, sound.delay));
    });
    
    // Every few seconds, play a random extra sound
    const randomSounds = ['/celebrate/yeah-boy.mp3', '/celebrate/cash.mp3', '/celebrate/laugh.mp3'];
    for (let i = 0; i < 5; i++) {
      cleanups.current.push(setTimeout(() => {
        const randomSound = randomSounds[Math.floor(Math.random() * randomSounds.length)];
        const sfx = new Howl({ src: [randomSound], volume: 0.8 });
        sfx.play();
        soundsRef.current.push(sfx);
      }, 2000 + i * 3000));
    }
  };

  // Shake the entire screen effect
  const startShakeEffect = () => {
    let intensity = 3;
    const shakeInterval = setInterval(() => {
      setShakeLevel(intensity * (Math.random() > 0.5 ? 1 : -1));
      intensity *= 0.95;
      if (intensity < 0.5) {
        clearInterval(shakeInterval);
        setShakeLevel(0);
      }
    }, 50);
    
    cleanups.current.push(() => clearInterval(shakeInterval));
    
    // Restart shake at random intervals
    [3000, 6000, 9000].forEach(delay => {
      cleanups.current.push(setTimeout(() => {
        intensity = 5;
      }, delay));
    });
  };
  
  // Add random floating GIFs that appear and disappear
  const startRandomGifs = () => {
    const gifOptions = [
      '/celebrate/money-eyes.gif',
      '/celebrate/success.gif',
      '/celebrate/thumbs-up.gif',
      '/celebrate/party-hat.gif',
      '/celebrate/dance.gif'
    ];
    
    const addRandomGif = () => {
      const gif = gifOptions[Math.floor(Math.random() * gifOptions.length)];
      const position = {
        top: `${10 + Math.random() * 80}%`,
        left: `${10 + Math.random() * 80}%`,
        transform: `rotate(${-20 + Math.random() * 40}deg) scale(${0.7 + Math.random() * 0.6})`,
        id: Date.now()
      };
      
      setRandomGifs(prev => [...prev, { ...position, gif }]);
      
      // Remove after a few seconds
      cleanups.current.push(setTimeout(() => {
        setRandomGifs(prev => prev.filter(g => g.id !== position.id));
      }, 3000 + Math.random() * 3000));
    };
    
    // Add initial gifs
    for (let i = 0; i < 3; i++) {
      cleanups.current.push(setTimeout(() => addRandomGif(), i * 800));
    }
    
    // Continue adding random gifs
    const interval = setInterval(() => {
      if (Math.random() > 0.4) addRandomGif();
    }, 1500);
    
    cleanups.current.push(() => clearInterval(interval));
  };
  
  // Flashing background colors
  const startFlashingEffect = () => {
    const flashInterval = setInterval(() => {
      setFlashState(prev => !prev);
    }, 300);
    
    cleanups.current.push(() => clearInterval(flashInterval));
  };

  const stopEverything = () => {
    soundsRef.current.forEach(sound => sound.stop());
    crowdRef.current?.stop();
    cleanups.current.forEach(c => {
      if (typeof c === 'function') c();
      else clearTimeout(c);
    });
    cleanups.current = [];
  };

  useEffect(() => {
    if (!show) return;
    
    startConfetti();
    startAudio();
    startShakeEffect();
    startRandomGifs();
    startFlashingEffect();

    // Attempt to autoplay video
    cleanups.current.push(setTimeout(() => {
      try { videoRef.current?.play(); } catch {}
    }, 100));

    return stopEverything;
  }, [show]);

  if (!show) return null;

  return (
    <div 
      className={`celebrate-overlay ${flashState ? 'flash' : ''}`} 
      role="dialog" 
      aria-modal="true"
      style={{ 
        transform: `translate(${shakeLevel}px, ${shakeLevel * 0.8}px)` 
      }}
    >
      {/* Floating emoji rain */}
      <div className="emoji-rain">
        {Array.from({ length: 15 }).map((_, i) => (
          <div 
            key={i} 
            className="falling-emoji"
            style={{ 
              left: `${(i * 7) % 100}%`, 
              animationDelay: `${Math.random() * 5}s`,
              fontSize: `${30 + Math.random() * 40}px`
            }}
          >
            {['💰', '💵', '🤑', '🎉', '🎊', '🔥', '⭐', '💸'][i % 8]}
          </div>
        ))}
      </div>
      
      <div className="celebrate-inner">
        <h1 className="celebrate-title">{title}</h1>
        {subtitle && <div className="celebrate-subtitle">{subtitle}</div>}
        
        {/* Main celebration video */}
        <div className="video-container">
          {mainVideo?.endsWith('.gif') ? (
            <img src={mainVideo} alt="celebration" className="celebrate-media main-media" />
          ) : (
            <video
              ref={videoRef}
              className="celebrate-media main-media"
              src={mainVideo}
              autoPlay
              playsInline
              loop
            />
          )}
          
          {/* Additional small videos that play simultaneously */}
          <div className="secondary-videos">
            {CELEBRATION_VIDEOS.slice(0, 3).map((vid, i) => (
              <div key={i} className={`mini-video mini-video-${i+1}`}>
                {vid.endsWith('.gif') ? (
                  <img src={vid} alt="" className="mini-media" />
                ) : (
                  <video src={vid} autoPlay playsInline loop muted className="mini-media" />
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Random floating GIFs */}
        {randomGifs.map((item, i) => (
          <img 
            key={i}
            src={item.gif}
            alt=""
            className="floating-gif"
            style={{
              position: 'absolute',
              top: item.top,
              left: item.left,
              transform: item.transform,
              zIndex: 1000000
            }}
          />
        ))}
        
        {/* Rotating dollar sign */}
        <div className="rotating-dollar">💰</div>
        
        <div className="celebrate-controls">
          <button className="btn btn-warning me-2" onClick={() => crowdRef.current?.mute(!crowdRef.current?._muted)}>
            {crowdRef.current?._muted ? '🔈 UNMUTE PARTY' : '🔇 MUTE PARTY'}
          </button>
          <button className="btn btn-danger" onClick={onClose}>
            MAKE IT STOP! 😵
          </button>
        </div>
      </div>
    </div>
  );
}