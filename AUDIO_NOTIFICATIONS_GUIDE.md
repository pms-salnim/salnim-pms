# Audio Notifications - Complete Setup & Troubleshooting Guide

## ✅ Features Implemented

### 1. **Sound Test Button**
- Click the "🔊 Test Sound" button to preview selected notification sounds
- Volume slider (0-100%) for volume control
- 6 different sound presets to choose from

### 2. **Browser Permissions**
- Automatically requests notification permissions when needed
- Shows permission status in the UI
- Graceful handling if permissions are denied

### 3. **Audio Debug Panel**
- Located at the bottom of the Notifications page
- Comprehensive diagnostic tools to verify audio functionality
- One-click test to check all 6 sounds sequentially

## 🔧 Troubleshooting Steps

### Step 1: Check System Audio
1. Make sure your device volume is **not muted**
2. Check speaker/headphone volume (usually at bottom-right of screen)
3. Test audio on another website to ensure sound works

### Step 2: Use the Audio Debug Panel
1. Navigate to **System → Notifications**
2. Scroll to the bottom to find the **"🔧 Audio Debug Panel"**
3. Click **"🧪 Run Full Test"**
4. Watch the console output for any errors

Expected output:
```
✅ Web Audio API is supported
✅ Audio context initialized: running
✅ Notification permission is already granted
🔊 Playing test sounds...
✅ bell sound played successfully
✅ chime sound played successfully
... (etc)
✅ Audio test completed!
```

### Step 3: Check Browser Console (F12)
1. Press **F12** to open Developer Tools
2. Go to the **"Console"** tab
3. Click the test button and look for:
   - `Test sound button clicked`
   - `Playing test sound with preset: bell volume: 70`
   - `Sound started successfully`
4. Look for any error messages in red

### Step 4: Grant Notification Permissions
When you click the test button, your browser may ask:
- **Allow notifications?** → Click **"Allow"**
- If you clicked "Block" previously:
  - Chrome: Click the 🔒 lock icon in the address bar → Clear permissions
  - Firefox: Preferences → Privacy → Notifications → Clear site permissions
  - Safari: Preferences → Websites → Notifications → Allow
  - Edge: Settings → Privacy → Notifications → Clear site permissions

### Step 5: Check Browser Sound Settings
Some browsers have independent volume controls:
- **Chrome**: Settings → Advanced → Sound → Check volume isn't muted
- **Firefox**: about:preferences → "Browsing" section
- **Safari**: System Preferences → Sound
- **Edge**: Settings → Appearance → Sounds

## 🎵 Audio Format Details

### Sound Presets
Each preset has a unique frequency profile:

| Preset | Type | Frequency Range | Use Case |
|--------|------|-----------------|----------|
| **Bell** | Gentle | 800→600 Hz | Default, calming notification |
| **Chime** | Musical | 1200→400 Hz | Bookings, reservations |
| **Beep** | Electronic | 1000 Hz (constant) | Simple, direct alerts |
| **Alert** | Urgent | 1500→900 Hz | Payment failures, critical |
| **Notification** | Soft | 700→500 Hz | Low-priority updates |
| **Ding** | Classic | 950→650 Hz | Traditional notification |

### Volume Levels
- **0-30%**: Silent/very quiet (for DND/shared spaces)
- **30-70%**: Normal use (recommended: 70%)
- **70-100%**: Loud (for noisy environments)

## 🌐 Browser Compatibility

| Browser | Web Audio API | Notifications | Status |
|---------|---------------|---------------|--------|
| Chrome 14+ | ✅ | ✅ | Fully supported |
| Firefox 25+ | ✅ | ✅ | Fully supported |
| Safari 6+ | ✅ | ✅ | Fully supported |
| Edge 12+ | ✅ | ✅ | Fully supported |
| Opera 10.6+ | ✅ | ✅ | Fully supported |
| Internet Explorer | ❌ | ❌ | Not supported |

## 📋 Quick Test Checklist

- [ ] Device volume is ON
- [ ] Speaker/Headphone volume is ON
- [ ] Browser is not in mute mode
- [ ] Notification permissions are GRANTED
- [ ] Audio Debug Panel shows ✅ Web Audio API: Supported
- [ ] Audio Debug Panel shows ✅ Notifications: Supported
- [ ] Test button shows "🔊 Test Sound" (not "Not Supported")
- [ ] Run full test and hear all 6 sounds
- [ ] Console (F12) shows no errors
- [ ] Manually test each sound preset

## 🔊 What You Should Hear

When running the full test, you should hear **6 different sounds** in sequence:

1. **Bell** - Pleasant chime sound
2. **Chime** - Ascending musical tone
3. **Beep** - Electronic beep sound
4. **Alert** - Descending urgency tone
5. **Notification** - Soft ping sound
6. **Ding** - Classic notification sound

Each sound plays for ~0.5 seconds with a fade-out effect.

## 🐛 Advanced Debugging

### Check Audio Context State
Open console (F12) and run:
```javascript
import { getAudioContext } from '@/lib/audio-utils';
const ctx = getAudioContext();
console.log('Audio context state:', ctx?.state);
console.log('Sample rate:', ctx?.sampleRate);
console.log('Output channels:', ctx?.destination.maxChannelCount);
```

### Enable Verbose Logging
The audio utilities include detailed console logging. Check the console output for:
- `Audio context initialized: running`
- `Resuming suspended audio context`
- `Playing sound: bell, volume: 0.7, duration: 0.5s`
- `Frequency sweep: 800Hz → 600Hz over 0.5s`
- `Sound started successfully`

### Test Individual Components
In console:
```javascript
import { playTestSound } from '@/lib/audio-utils';
playTestSound('bell', 70);      // Test bell at 70%
playTestSound('alert', 100);    // Test alert at 100%
```

## 🎯 Common Issues & Solutions

### Issue: "No sound heard"
**Solutions:**
1. Check all 5 volume levels (device → browser → page → audio control)
2. Check microphone/speaker settings
3. Try a different browser
4. Restart browser completely
5. Check if website has permission to play audio

### Issue: "Audio Debug Panel shows 'Not Supported'"
**Solutions:**
1. Use a modern browser (Chrome, Firefox, Safari, Edge)
2. Make sure you're on HTTPS (required for some browsers)
3. Try incognito/private mode
4. Check if your browser has audio access disabled in system settings

### Issue: "Permission keeps showing 'denied'"
**Solutions:**
1. Go to browser settings → Notifications
2. Find this website in the list
3. Change permission from "Deny" to "Allow"
4. Refresh the page
5. Try the test button again

### Issue: "Sound is very quiet"
**Solutions:**
1. Increase volume slider to 100%
2. Check OS volume settings
3. Check browser independent volume (if applicable)
4. Check speaker/headphone physical volume
5. Try different sound preset

## 📞 Support

If issues persist:
1. **Take a screenshot** of the Audio Debug Panel results
2. **Note your browser** and version
3. **Check browser console** (F12) for error messages
4. **Try incognito mode** to rule out extensions
5. **Test on different device** to isolate the issue

---

**Last Updated:** February 2026  
**Version:** 1.0  
**Tested Browsers:** Chrome, Firefox, Safari, Edge
