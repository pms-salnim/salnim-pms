/**
 * Audio utility for playing notification sounds
 * Supports multiple sound presets and volume control
 * Includes notification permission handling
 * Supports both synthesized and audio file-based sounds
 */

type SoundPreset = 
  | 'alert'
  | 'aurora'
  | 'bongo_sms'
  | 'chord'
  | 'nintendo_switch'
  | 'note'
  | 'notification_bell'
  | 'rebound'
  | 'tri_tone'
  | 'tweet'
  | 'water_drop';

interface SoundConfig {
  preset: SoundPreset;
  volume: number; // 0-100
  duration?: number; // seconds, default 0.5
}

interface CustomSoundConfig {
  url: string;
  volume: number; // 0-100
}

let audioContext: (AudioContext | WebkitAudioContext) | null = null;
let audioBuffer: Map<string, AudioBuffer> = new Map();

/**
 * Request notification permission from the browser
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    console.log('Notification permission already granted');
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  return Notification.permission;
};

/**
 * Check if notifications are supported
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window;
};

/**
 * Check if notification permission is granted
 */
export const hasNotificationPermission = (): boolean => {
  return isNotificationSupported() && Notification.permission === 'granted';
};

/**
 * Get or initialize the Web Audio Context
 */
export const getAudioContext = (): AudioContext | WebkitAudioContext | null => {
  try {
    if (!audioContext) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as any;
      if (!AudioContextClass) {
        console.warn('Web Audio API is not supported in this browser');
        return null;
      }
      audioContext = new AudioContextClass();
      console.log('Audio context initialized:', audioContext.state);
    }
    return audioContext;
  } catch (error) {
    console.error('Error initializing audio context:', error);
    return null;
  }
};

/**
 * Get custom sound URL for a preset
 */
const getSoundUrl = (preset: SoundPreset): string => {
  const urls: Record<SoundPreset, string> = {
    alert: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Falert.mp3?alt=media&token=d60b83e4-7509-4849-b01b-51e0191bf041',
    aurora: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Faurora.mp3?alt=media&token=039de223-d97b-4248-a09c-8c93bf35f5da',
    bongo_sms: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Fbongo_sms.mp3?alt=media&token=80912d69-d5eb-4ee6-aadf-7c6802cd76d3',
    chord: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Fchord.mp3?alt=media&token=f2cf76fe-6743-438b-8263-137c96f4a2b6',
    nintendo_switch: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Fnintendo_switch.mp3?alt=media&token=3b9e9bd5-b67e-4f7d-9698-2bc63651b274',
    note: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Fnote.mp3?alt=media&token=bf6c42e1-dcd2-4f57-8005-68bddc8e34c3',
    notification_bell: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Fnotification_bell.mp3?alt=media&token=e56bc938-760b-4279-ae57-7b4173a94c25',
    rebound: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Frebound.mp3?alt=media&token=a20b6681-9f68-4fb5-84f4-56cce72e2b06',
    tri_tone: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Ftri_tone.mp3?alt=media&token=5ac9319d-cbb1-4b72-9ffc-44abdb6cdd67',
    tweet: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Ftweet.mp3?alt=media&token=d4805179-3272-4249-be7f-a7a68f06a652',
    water_drop: 'https://firebasestorage.googleapis.com/v0/b/protrack-hub.firebasestorage.app/o/notification-sounds%2Fpresets%2Fwater_drop.mp3?alt=media&token=f7bace3b-4d80-4b1b-b050-195e14c09aae',
  };
  return urls[preset];
};

/**
 * Play a notification sound using custom audio files
 * @param config Sound configuration
 */
export const playNotificationSound = async (config: SoundConfig): Promise<void> => {
  try {
    const url = getSoundUrl(config.preset);
    await playCustomSound(url, config.volume);
    console.log(`Playing sound: ${config.preset}`);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

/**
 * Play a custom sound from an audio file
 * @param url URL to audio file (mp3, wav, ogg, etc.)
 * @param volume Volume level (0-100)
 */
export const playCustomSound = async (url: string, volume: number = 70): Promise<void> => {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      console.warn('Audio context is not available');
      return;
    }

    // Try to load from cache first
    let buffer = audioBuffer.get(url);
    if (!buffer) {
      console.log(`Loading audio file: ${url}`);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffer.set(url, buffer);
      console.log(`Audio file loaded and cached: ${url}`);
    }

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Set volume
    const volumeLevel = Math.max(0, Math.min(1, volume / 100));
    gainNode.gain.setValueAtTime(volumeLevel, ctx.currentTime);

    source.start(0);
    console.log(`Playing custom sound: ${url}, volume: ${volumeLevel}`);
  } catch (error) {
    console.error('Error playing custom sound:', error);
  }
};

/**
 * Preload an audio file for faster playback
 * @param url URL to audio file
 */
export const preloadAudioFile = async (url: string): Promise<void> => {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      console.warn('Audio context is not available');
      return;
    }

    if (!audioBuffer.has(url)) {
      console.log(`Preloading audio file: ${url}`);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffer.set(url, buffer);
      console.log(`Audio file preloaded: ${url}`);
    }
  } catch (error) {
    console.error('Error preloading audio file:', error);
  }
};

/**
 * List available sound presets
 */
export const getAvailableSounds = (): SoundPreset[] => {
  return [
    'alert',
    'aurora',
    'bongo_sms',
    'chord',
    'nintendo_switch',
    'note',
    'notification_bell',
    'rebound',
    'tri_tone',
    'tweet',
    'water_drop',
  ];
};

/**
 * Get description of a sound
 */
export const getSoundDescription = (preset: SoundPreset): string => {
  const descriptions: Record<SoundPreset, string> = {
    alert: 'Alert notification',
    aurora: 'Aurora sound',
    bongo_sms: 'Bongo SMS notification',
    chord: 'Musical chord',
    nintendo_switch: 'Nintendo Switch sound',
    note: 'Musical note',
    notification_bell: 'Notification bell',
    rebound: 'Rebound sound',
    tri_tone: 'Three-tone chime',
    tweet: 'Tweet sound',
    water_drop: 'Water drop sound',
  };
  return descriptions[preset] || 'Unknown sound';
};

/**
 * Clear cached audio buffers
 */
export const clearAudioCache = (): void => {
  audioBuffer.clear();
  console.log('Audio buffer cache cleared');
};

/**
 * Play a test sound (convenience function)
 */
export const playTestSound = async (preset: SoundPreset = 'alert', volume: number = 70): Promise<void> => {
  console.log('Test sound requested:', preset, volume);
  await playNotificationSound({ preset, volume, duration: 0.5 });
};

/**
 * Check if Web Audio API is available
 */
export const isAudioSupported = (): boolean => {
  return !!(window.AudioContext || (window as any).webkitAudioContext);
};

/**
 * Show a test notification with sound
 */
export const showTestNotification = async (title: string = 'Test Notification'): Promise<void> => {
  try {
    // Check and request permission if needed
    if (!hasNotificationPermission()) {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
      }
    }

    // Show notification
    const notification = new Notification(title, {
      icon: '/icon-192x192.png',
      tag: 'test-notification',
      requireInteraction: false,
    });

    // Play sound when notification is shown
    await playTestSound('alert', 70);

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    console.log('Test notification shown');
  } catch (error) {
    console.error('Error showing test notification:', error);
  }
};
