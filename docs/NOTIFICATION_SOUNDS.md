# Notification Sounds - Complete Guide

This document provides guidance on using and customizing notification sounds in the Salnim PMS app.

## Table of Contents
1. [Built-in Synthesized Sounds](#built-in-synthesized-sounds)
2. [Using Custom Audio Files](#using-custom-audio-files)
3. [External Sound Sources](#external-sound-sources)
4. [Best Practices](#best-practices)
5. [Implementation Guide](#implementation-guide)

---

## Built-in Synthesized Sounds

The app includes **17 synthesized sound presets** generated using the Web Audio API. These sounds require no external files and work offline.

### Sound Presets (Organized by Type)

#### Classic Notifications (6 sounds)
| Preset | Description | Use Case |
|--------|-------------|----------|
| **bell** | Pleasant chime sound | General notifications |
| **chime** | Ascending musical tone | Positive events |
| **ding** | Classic notification sound | Friendly alerts |
| **beep** | Electronic beep | System notifications |
| **alert** | Descending urgency tone | Important alerts |
| **notification** | Soft ping | Non-intrusive alerts |

#### Modern Sounds (11 sounds)
| Preset | Waveform | Description | Use Case |
|--------|----------|-------------|----------|
| **whoosh** | Triangle | Fast descending sweep | Urgent, action-oriented |
| **pop** | Square | Short burst pop | Quick acknowledgment |
| **ping** | Sine | High-pitched ping | Bright, uplifting |
| **cling** | Triangle | Metal cling sound | Distinct, recognizable |
| **sparkle** | Sawtooth | Descending sparkle | Positive, magical feel |
| **buzz** | Sawtooth | Electronic buzz | System alerts |
| **chirp** | Sine | Ascending chirp | Friendly, bird-like |
| **twang** | Triangle | Twangy pluck | Guitar-like |
| **boing** | Sine | Rubber bouncing sound | Playful |
| **pluck** | Square | Guitar string pluck | Musical |
| **tone** | Sine | Pure sine wave tone | Consistent, simple |

### Sound Characteristics

Each synthesized sound is defined by:
- **Start Frequency**: Initial tone frequency (Hz)
- **End Frequency**: Final tone frequency (Hz)
- **Duration**: 0.1 - 0.9 seconds
- **Waveform Type**: sine, square, triangle, or sawtooth

### Example: Using a Built-in Sound

```typescript
import { playNotificationSound } from '@/lib/audio-utils';

// Play a bell sound
playNotificationSound({
  preset: 'bell',
  volume: 70, // 0-100
  duration: 0.5 // seconds
});
```

---

## Using Custom Audio Files

You can replace synthesized sounds with audio files from external sources.

### Supported Formats
- **MP3** (best compatibility)
- **WAV** (highest quality)
- **OGG** (modern browsers)
- **FLAC** (some browsers)
- **WEBM** (modern browsers)

### Implementation

#### 1. Upload Audio File to Your Storage

Place audio files in Firebase Cloud Storage or a CDN:
```
gs://your-project.appspot.com/notification-sounds/new-booking.mp3
gs://your-project.appspot.com/notification-sounds/payment-received.mp3
```

#### 2. Use in Notifications Form

```typescript
import { playCustomSound, preloadAudioFile } from '@/lib/audio-utils';

// Preload audio file on component mount
useEffect(() => {
  preloadAudioFile('https://your-storage.com/sounds/ding.mp3');
}, []);

// Play custom sound
const handleTestSound = async () => {
  await playCustomSound(
    'https://your-storage.com/sounds/ding.mp3',
    70 // volume 0-100
  );
};
```

#### 3. Store URL in Firestore

```typescript
// Preferences document
{
  notificationSounds: {
    newReservation: {
      type: 'custom',
      url: 'https://your-storage.com/sounds/positive-ding.mp3',
      volume: 70
    },
    paymentReceived: {
      type: 'preset',
      preset: 'bell',
      volume: 80
    }
  }
}
```

### Audio File Best Practices

- **File Size**: Keep under 200KB per sound (MP3 is smallest)
- **Duration**: 0.5 - 2.0 seconds for notifications
- **Volume**: Normalize to -3dB to prevent clipping
- **Format**: Use MP3 for best browser compatibility
- **Silence**: Avoid long silence at beginning/end

---

## External Sound Sources

### 🆓 Free Sources

#### 1. **Freesound.org**
- **URL**: https://freesound.org
- **License**: Creative Commons (check each sound)
- **Best For**: Diverse sounds, large catalog
- **Quality**: High
- **Search Tips**: Use tags like "notification", "alert", "chime"

#### 2. **Zapsplat.com**
- **URL**: https://www.zapsplat.com
- **License**: Free with attribution
- **Best For**: Clean notification sounds
- **Quality**: Professional
- **Benefit**: Fast downloads, no login required

#### 3. **Notification Sounds**
- **URL**: https://notificationsounds.com
- **License**: Various (check each)
- **Best For**: Pre-curated notification sounds
- **Quality**: Good
- **Benefit**: Specifically designed for notifications

#### 4. **BBC Sound Library**
- **URL**: https://sound-effects.bbcrewind.co.uk
- **License**: Creative Commons
- **Best For**: Professional, broadcast-quality sounds
- **Quality**: Excellent
- **Benefit**: Authoritative source

#### 5. **Pixabay Sounds**
- **URL**: https://pixabay.com/sound-effects
- **License**: Free (Pixabay License)
- **Best For**: Clean, professional sounds
- **Quality**: High
- **Benefit**: No attribution required

#### 6. **YouTube Audio Library**
- **URL**: https://www.youtube.com/audiolibrary
- **License**: Free (with YouTube account)
- **Best For**: Curated collections
- **Quality**: Good
- **Benefit**: Integrated with YouTube

#### 7. **OpenGameArt.org**
- **URL**: https://opengameart.org
- **License**: Creative Commons
- **Best For**: Game-like sounds, effects
- **Quality**: Variable
- **Benefit**: Diverse catalog

#### 8. **Incompetech**
- **URL**: https://incompetech.com/music/royalty-free/sound-effects
- **License**: Creative Commons
- **Best For**: Consistent, reliable sounds
- **Quality**: Good
- **Benefit**: Well-organized, searchable

### 💳 Premium Sources

| Source | Cost | Best For | Quality |
|--------|------|----------|---------|
| **AudioJungle** | Per-file or subscription | Extensive library | Excellent |
| **Epidemic Sound** | Subscription | Music + effects | Professional |
| **Artlist.io** | Subscription | Royalty-free complete | Excellent |
| **Shutterstock Music** | Subscription | Enterprise use | Professional |

---

## Recommended Sounds for Each Event

### Reservation Events
| Event | Recommended | Alternative |
|-------|-------------|-------------|
| New Booking | **ping**, chime | bell, sparkle |
| Booking Modified | **notification** | chirp |
| Booking Cancelled | **alert** | whoosh |
| Booking Confirmed | **ding**, bell | chime |

### Guest Events
| Event | Recommended | Alternative |
|-------|-------------|-------------|
| Guest Check-In | **pop**, ding | ping |
| Guest Check-Out | **cling** | notification |
| Guest Message | **chirp** | ping |
| Guest Feedback | **sparkle** | bell |

### Payment Events
| Event | Recommended | Alternative |
|-------|-------------|-------------|
| Payment Received | **ding**, chime | bell |
| Payment Failed | **buzz**, alert | whoosh |
| Invoice Generated | **notification** | ping |

### Staff & Operations
| Event | Recommended | Alternative |
|-------|-------------|-------------|
| Task Assigned | **pop** | ping |
| System Alert | **buzz** | alert |
| Inventory Low | **sparkle**, cling | alert |

### System Events
| Event | Recommended | Alternative |
|-------|-------------|-------------|
| Backup Complete | **bell** | ding |
| System Error | **alert**, buzz | whoosh |
| Maintenance Notice | **notification** | chime |

---

## Best Practices

### 1. Sound Selection
- ✅ Use distinct sounds for different event types
- ✅ Keep notification sounds brief (0.5-2.0 seconds)
- ✅ Test sounds in actual working environment
- ✅ Consider audio accessibility (not too harsh)
- ❌ Avoid sounds that sound like system alerts
- ❌ Don't use music tracks as notifications
- ❌ Avoid overly long or complex sounds

### 2. Volume Management
- Set volume based on event importance
- Urgent events: 80-100% volume
- Standard events: 60-80% volume
- Low-priority events: 40-60% volume
- Always allow user to adjust

### 3. Do Not Disturb Integration
- Respect DND schedule (6 PM - 8 AM default)
- Allow exceptions for critical events
- Show silent notification indicator
- Queue notifications for when DND ends

### 4. Accessibility
- Provide visual notification alongside sound
- Use distinct, non-harsh tones
- Include option to disable sound entirely
- Log all notifications for reference

### 5. Testing
- Test on different devices/browsers
- Verify audio file loading
- Check volume levels
- Test with slow network connections
- Verify DND scheduling works

---

## Implementation Guide

### Step 1: Add Custom Sound to Preferences

Edit `NotificationsForm` component:

```typescript
interface SoundSetting {
  type: 'preset' | 'custom';
  preset?: SoundPreset;
  customUrl?: string;
  volume: number;
}

const [soundSettings, setSoundSettings] = useState<SoundSetting>({
  type: 'preset',
  preset: 'bell',
  volume: 70
});
```

### Step 2: Update Notifications Backend Function

In `/functions/source/property-settings/system/notifications.ts`:

```typescript
export const saveNotifications = async (
  data: NotificationsData,
  context: functions.https.CallableContext
) => {
  const { soundSettings } = data;
  
  // Store custom URLs in Firestore
  if (soundSettings.type === 'custom' && soundSettings.customUrl) {
    // Validate URL is safe
    validateUrl(soundSettings.customUrl);
  }
  
  await db.collection('properties').doc(context.auth!.uid)
    .update({ soundSettings });
};
```

### Step 3: Implement Audio File Upload

```typescript
const handleUploadSound = async (file: File) => {
  const storage = getStorage();
  const soundRef = ref(
    storage,
    `notification-sounds/${propertyId}/${file.name}`
  );
  
  const result = await uploadBytes(soundRef, file);
  const url = await getDownloadURL(result.ref);
  
  setSoundSettings({ ...soundSettings, customUrl: url });
};
```

### Step 4: Play Sound When Notification Fires

```typescript
const handleNotification = async (event: NotificationEvent) => {
  const soundSettings = await loadSoundSettings();
  
  if (soundSettings.type === 'preset') {
    playNotificationSound({
      preset: soundSettings.preset,
      volume: soundSettings.volume
    });
  } else if (soundSettings.type === 'custom') {
    await playCustomSound(
      soundSettings.customUrl!,
      soundSettings.volume
    );
  }
};
```

---

## Troubleshooting

### Sound Not Playing
1. Check notification permission granted
2. Verify audio context initialized
3. Check browser console for errors
4. Ensure volume is not muted
5. Try test sound in AudioDebugPanel

### Audio File Not Loading
1. Verify URL is accessible
2. Check file format is supported
3. Check CORS headers if cross-origin
4. Try preloading file first
5. Check browser console for network errors

### Volume Issues
1. Verify volume slider working (0-100)
2. Check system volume is not muted
3. Test with different volumes
4. Consider OS notification settings

---

## Recommended Notification Sound Packs

### Professional Quality
- **Epidemic Sound** - Comprehensive notification library
- **AudioJungle** - Individual high-quality sounds
- **Envato Elements** - Unlimited downloads

### Free Collections
- **Freesound.org** - "Notification" collection
- **BBC Sound Effects** - Professional library
- **Pixabay Sounds** - Clean, simple sounds

---

## API Reference

### Playing Sounds

```typescript
// Synthesized sound
playNotificationSound({
  preset: 'bell',
  volume: 70,
  duration: 0.5
});

// Custom audio file
await playCustomSound('https://example.com/sound.mp3', 70);

// Test sound
playTestSound('bell', 70);

// Preload audio file
await preloadAudioFile('https://example.com/sound.mp3');
```

### Getting Information

```typescript
// Get available sounds
const sounds = getAvailableSounds();

// Get sound description
const desc = getSoundDescription('bell');

// Clear cache
clearAudioCache();
```

### Notification Permission

```typescript
const permission = await requestNotificationPermission();
const isSupported = isAudioSupported();
```

---

## Summary

**For Most Users:**
- Use the 17 built-in synthesized sounds
- No external files required
- Works offline
- No storage needed

**For Premium Customization:**
- Download sounds from Freesound.org or Zapsplat.com
- Upload to Firebase Cloud Storage
- Configure per-event sounds in settings
- Test with AudioDebugPanel

**For Enterprise:**
- Purchase professional sound packs
- Implement custom audio processing
- Create audio branding
- Integrate with existing sound libraries

