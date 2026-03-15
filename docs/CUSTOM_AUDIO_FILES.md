# Custom Audio Files Implementation Guide

This guide explains how to integrate custom audio files into the Salnim PMS notification system.

## Quick Start

### Option 1: Use Built-in Synthesized Sounds (Easiest)
- 17 pre-made sounds available
- No external files needed
- Works offline
- Zero configuration

### Option 2: Use Custom Audio Files (Advanced)
- Download sounds from external sources
- Upload to Firebase Cloud Storage or CDN
- Configure in settings
- Per-event customization

---

## Step 1: Get Audio Files

### Free Sources (Recommended for Testing)

#### Freesound.org
1. Go to https://freesound.org
2. Search for "notification" or "alert"
3. Filter by license: Creative Commons
4. Listen and download MP3 version
5. Download quality: 128 kbps or higher

**Best Notification Sounds to Search:**
- "notification ding"
- "bell chime"
- "alert beep"
- "chime notification"
- "magic sparkle"

#### Zapsplat.com
1. Go to https://www.zapsplat.com
2. Search "notification sounds"
3. No login required
4. Download MP3 directly
5. Recommended: 128-192 kbps

#### Notification Sounds
1. Go to https://notificationsounds.com
2. Browse collections
3. Download MP3 files
4. Good for standard notification sounds

### Pro Tip: Audio Format
- **Best for Web**: MP3 (smallest file, best compatibility)
- **Alternative**: WAV (larger, highest quality)
- **Modern Browsers**: OGG, WebM
- **Avoid**: FLAC (inconsistent support)

**File Size Guide:**
- 0.5 second sound: 8-20 KB (MP3)
- 1.0 second sound: 16-30 KB (MP3)
- 2.0 second sound: 32-60 KB (MP3)

---

## Step 2: Upload to Firebase Cloud Storage

### Setup Firebase Storage

1. **Go to Firebase Console**
   - https://console.firebase.google.com
   - Select your project

2. **Enable Cloud Storage**
   - Left sidebar → "Storage"
   - Click "Get Started"
   - Accept default security rules
   - Create bucket

3. **Create Folder Structure**
   - Create folder: `notification-sounds`
   - Inside create folder: `presets` (for reusable sounds)
   - Inside create folder: `custom` (for user-uploaded sounds)

### Upload via Firebase Console

1. Go to Storage → notification-sounds/presets
2. Upload → Select your MP3 files
3. Wait for upload to complete
4. Click file → Copy path
5. Get download URL:
   - Right-click file
   - Copy link (or get from properties)

### Upload via Code (For Users)

```typescript
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadNotificationSound = async (
  file: File,
  propertyId: string
): Promise<string> => {
  const storage = getStorage();
  const soundRef = ref(
    storage,
    `notification-sounds/custom/${propertyId}/${file.name}`
  );
  
  // Upload the file
  const result = await uploadBytes(soundRef, file);
  
  // Get download URL
  const downloadUrl = await getDownloadURL(result.ref);
  
  return downloadUrl;
};
```

---

## Step 3: Update Notifications Form

### Extend Sound Settings Interface

```typescript
interface SoundSettings {
  type: 'preset' | 'custom';
  preset?: SoundPreset;           // For preset sounds
  customUrl?: string;             // For custom audio files
  volume: number;                 // 0-100
  muteInDND: boolean;
}

interface NotificationsData {
  // ... existing settings ...
  
  // Updated sound settings
  soundSettings: SoundSettings;
}
```

### Add Custom File Upload Input

```typescript
const [soundSettings, setSoundSettings] = useState<SoundSettings>({
  type: 'preset',
  preset: 'bell',
  volume: 70,
  muteInDND: false
});

const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Validate file
  if (!['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'].includes(file.type)) {
    alert('Please select an MP3, WAV, OGG, or WebM file');
    return;
  }
  
  if (file.size > 500000) { // 500 KB limit
    alert('File must be less than 500 KB');
    return;
  }
  
  try {
    // Upload file
    const url = await uploadNotificationSound(file, propertyId);
    
    // Update settings
    setSoundSettings({
      type: 'custom',
      customUrl: url,
      volume: soundSettings.volume,
      muteInDND: soundSettings.muteInDND
    });
  } catch (error) {
    alert('Failed to upload audio file');
    console.error(error);
  }
};
```

---

## Step 4: Play Custom Audio

### Simple Playback

```typescript
import { playCustomSound, playNotificationSound } from '@/lib/audio-utils';

const playNotification = () => {
  if (soundSettings.type === 'preset') {
    // Play built-in sound
    playNotificationSound({
      preset: soundSettings.preset!,
      volume: soundSettings.volume
    });
  } else {
    // Play custom audio file
    playCustomSound(soundSettings.customUrl!, soundSettings.volume);
  }
};
```

### With Error Handling

```typescript
const playNotificationSafe = async () => {
  try {
    if (soundSettings.type === 'preset') {
      playNotificationSound({
        preset: soundSettings.preset!,
        volume: soundSettings.volume
      });
    } else if (soundSettings.customUrl) {
      await playCustomSound(soundSettings.customUrl, soundSettings.volume);
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error);
    // Fall back to silent notification or system sound
  }
};
```

---

## Step 5: Store in Firestore

### Save Sound Settings

```typescript
export const saveNotificationSettings = async (
  propertyId: string,
  soundSettings: SoundSettings
) => {
  const db = getFirestore();
  
  await updateDoc(
    doc(db, 'properties', propertyId, 'settings', 'notifications'),
    {
      soundSettings: {
        type: soundSettings.type,
        preset: soundSettings.preset,
        customUrl: soundSettings.customUrl,
        volume: soundSettings.volume,
        muteInDND: soundSettings.muteInDND,
        updatedAt: new Date()
      }
    }
  );
};
```

### Firestore Document Structure

```json
{
  "properties": {
    "[propertyId]": {
      "settings": {
        "notifications": {
          "enableSound": true,
          "soundSettings": {
            "type": "custom",
            "customUrl": "https://storage.googleapis.com/...",
            "volume": 70,
            "muteInDND": true,
            "updatedAt": "2025-01-15T10:30:00Z"
          },
          "enableDND": true,
          "dndStartTime": "22:00",
          "dndEndTime": "08:00"
        }
      }
    }
  }
}
```

---

## Step 6: Preload Audio Files

### On Component Mount

```typescript
useEffect(() => {
  // Preload all custom sounds on app start
  if (soundSettings.customUrl) {
    preloadAudioFile(soundSettings.customUrl)
      .catch(error => console.error('Failed to preload audio:', error));
  }
}, [soundSettings.customUrl]);
```

### On Notification Event

```typescript
const handleNewReservation = async (data: ReservationData) => {
  // Preload sound if using custom
  if (soundSettings.type === 'custom') {
    await preloadAudioFile(soundSettings.customUrl!);
  }
  
  // Show notification
  showNotification('New Reservation', {
    body: `${data.guestName} has booked ${data.roomNumber}`
  });
  
  // Play sound
  await playNotificationSafe();
};
```

---

## Complete Example UI

### Notifications Form - Sound Section

```tsx
{/* Sound Settings Section */}
<div className="space-y-4">
  <h3 className="text-lg font-semibold">🔊 Sound Notifications</h3>
  
  {/* Enable/Disable Toggle */}
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={formData.enableSound}
      onChange={(e) => handleChange('enableSound', e.target.checked)}
    />
    <span>Enable Sound Notifications</span>
  </label>

  {formData.enableSound && (
    <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
      
      {/* Sound Type Selection */}
      <div>
        <label className="block font-medium mb-2">Sound Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="preset"
              checked={soundSettings.type === 'preset'}
              onChange={() => setSoundSettings({...soundSettings, type: 'preset'})}
            />
            <span>Built-in Preset</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="custom"
              checked={soundSettings.type === 'custom'}
              onChange={() => setSoundSettings({...soundSettings, type: 'custom'})}
            />
            <span>Custom Audio File</span>
          </label>
        </div>
      </div>

      {/* Preset Selection */}
      {soundSettings.type === 'preset' && (
        <div>
          <label className="block font-medium mb-2">
            Select Sound Preset
          </label>
          <select
            value={soundSettings.preset}
            onChange={(e) => setSoundSettings({...soundSettings, preset: e.target.value as SoundPreset})}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="bell">Bell - Pleasant chime</option>
            <option value="chime">Chime - Ascending tone</option>
            <option value="ding">Ding - Classic notification</option>
            <option value="ping">Ping - High-pitched</option>
            <option value="sparkle">Sparkle - Descending</option>
            <option value="whoosh">Whoosh - Fast sweep</option>
            {/* ... more options ... */}
          </select>
        </div>
      )}

      {/* Custom File Upload */}
      {soundSettings.type === 'custom' && (
        <div>
          <label className="block font-medium mb-2">
            Upload Audio File (MP3, WAV, OGG)
          </label>
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
            onChange={handleAudioFileUpload}
            className="w-full px-3 py-2 border rounded-md"
          />
          <p className="text-xs text-gray-600 mt-1">
            Max 500 KB • Recommended: 0.5-2 seconds
          </p>
          {soundSettings.customUrl && (
            <p className="text-xs text-green-600 mt-2">
              ✓ Audio file loaded
            </p>
          )}
        </div>
      )}

      {/* Volume Control */}
      <div>
        <label className="block font-medium mb-2">
          Volume: {soundSettings.volume}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={soundSettings.volume}
          onChange={(e) => setSoundSettings({...soundSettings, volume: parseInt(e.target.value)})}
          className="w-full"
        />
      </div>

      {/* Test Sound Button */}
      <button
        type="button"
        onClick={async () => {
          if (soundSettings.type === 'preset') {
            playTestSound(soundSettings.preset!, soundSettings.volume);
          } else if (soundSettings.customUrl) {
            await playCustomSound(soundSettings.customUrl, soundSettings.volume);
          }
        }}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        🔊 Test Sound
      </button>

      {/* DND Mute */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={soundSettings.muteInDND}
          onChange={(e) => setSoundSettings({...soundSettings, muteInDND: e.target.checked})}
        />
        <span>Mute during Do Not Disturb hours</span>
      </label>
    </div>
  )}
</div>
```

---

## Troubleshooting

### Audio File Not Playing

**Problem**: Custom audio file doesn't play

**Solutions:**
1. Check file size (< 500 KB)
2. Verify file format (MP3, WAV, OGG)
3. Check CORS headers on CDN/storage
4. Verify URL is accessible
5. Check browser console for errors

```typescript
// Test URL accessibility
const testUrl = async (url: string) => {
  try {
    const response = await fetch(url);
    console.log('URL status:', response.status);
    console.log('Content-Type:', response.headers.get('Content-Type'));
  } catch (error) {
    console.error('URL not accessible:', error);
  }
};
```

### CORS Issues

**Problem**: "Cross-origin request blocked"

**Solution for Firebase Storage:**
1. Go to Firebase Console → Storage
2. Rules tab
3. Update to allow public read:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /notification-sounds/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Volume Not Working

**Problem**: Volume slider doesn't change sound loudness

**Solutions:**
1. Verify Web Audio API supported
2. Check system volume is not muted
3. Test with different volumes (0%, 50%, 100%)
4. Check browser audio output

```typescript
// Debug volume
const testVolume = () => {
  const volumes = [30, 50, 70, 90];
  volumes.forEach(vol => {
    setTimeout(() => {
      playCustomSound(url, vol);
      console.log(`Playing at ${vol}%`);
    }, 2000);
  });
};
```

---

## Best Practices

### Audio File Optimization

1. **File Format**
   - Convert to MP3 for best compatibility
   - Use 128 kbps bitrate (good quality, small size)

2. **Duration**
   - Keep 0.5-2.0 seconds for notifications
   - Shorter for frequent events
   - Longer for important alerts

3. **Volume Normalization**
   - Normalize audio to -3dB
   - Prevents clipping at high volumes
   - Use Audacity or FFmpeg:

```bash
# Normalize audio with FFmpeg
ffmpeg -i input.mp3 -af loudnorm=I=-23:TP=-1.5:LRA=11 output.mp3
```

### Naming Convention

```
notification-sounds/
├── presets/
│   ├── new-booking.mp3
│   ├── payment-received.mp3
│   ├── guest-checkin.mp3
│   └── system-alert.mp3
└── custom/
    └── [propertyId]/
        ├── my-custom-sound.mp3
        └── brand-notification.mp3
```

### Caching Strategy

```typescript
// Pre-cache all sounds on app start
const preloadAllSounds = async (soundUrls: string[]) => {
  await Promise.all(
    soundUrls.map(url => preloadAudioFile(url))
  );
  console.log('All sounds cached');
};

// On app initialization
useEffect(() => {
  preloadAllSounds([
    'https://storage.googleapis.com/sounds/booking.mp3',
    'https://storage.googleapis.com/sounds/payment.mp3'
  ]);
}, []);
```

---

## Summary

| Aspect | Built-in Sounds | Custom Files |
|--------|-----------------|--------------|
| Setup | Instant | Requires upload |
| File Size | 0 KB | 20-60 KB per sound |
| Customization | Limited | Unlimited |
| Offline | Yes | No (unless cached) |
| Browser Support | Excellent | Good (MP3) |
| Cost | Free | Free (storage may apply) |
| Best For | Quick setup | Branding, specific sounds |

**Recommended Approach:**
- Use built-in sounds for standard notifications
- Use custom audio for brand-specific alerts
- Mix and match based on event type

