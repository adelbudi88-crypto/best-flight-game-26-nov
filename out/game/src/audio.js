// All sound is synthesised live with WebAudio: an engine drone that follows the
// throttle, wind noise that follows the speed, and short blips for rings, alarms
// and touchdowns. No audio files, no network, and nothing starts before the
// player's first gesture (browsers require it).
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);

      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      const length = context.sampleRate * 2;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 600;
      windFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0.0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function blip(frequency, duration, type, volume, when = 0) {
    if (!started || muted) return;
    try {
      const t = context.currentTime + when;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    } catch {
      // Sound is garnish: a failure here must never stop the game.
    }
  }

  function thud() {
    if (!started || muted) return;
    try {
      const t = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.35);
    } catch {
      // Ignore audio failures.
    }
  }

  return {
    unlock() {
      if (ensure() && context && context.state === 'suspended') context.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master && context) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    update(throttle, speedNorm, airborne) {
      if (!started || muted) return;
      try {
        const t = context.currentTime;
        const rpm = 48 + throttle * 72;
        engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
        engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
        engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
        engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.075 : 0.035, t, 0.1);
        windGain.gain.setTargetAtTime(airborne ? speedNorm * speedNorm * 0.11 : 0, t, 0.15);
        windFilter.frequency.setTargetAtTime(400 + speedNorm * 900, t, 0.15);
      } catch {
        // Ignore audio failures.
      }
    },
    ring() {
      blip(880, 0.35, 'sine', 0.32);
      blip(1318.5, 0.5, 'sine', 0.28, 0.09);
    },
    missed() {
      blip(220, 0.3, 'triangle', 0.2);
      blip(165, 0.4, 'triangle', 0.18, 0.1);
    },
    alarm() {
      blip(660, 0.16, 'square', 0.12);
      blip(660, 0.16, 'square', 0.12, 0.22);
    },
    click() {
      blip(1200, 0.06, 'sine', 0.15);
    },
    land() {
      thud();
      blip(523.25, 0.4, 'sine', 0.25, 0.05);
      blip(783.99, 0.6, 'sine', 0.22, 0.15);
    },
    crash() {
      thud();
      blip(110, 0.7, 'sawtooth', 0.3, 0.05);
    },
  };
}
