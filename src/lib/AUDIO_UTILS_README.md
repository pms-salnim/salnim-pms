# Audio Utilities

This module provides notification sound functionality using the Web Audio API.

## Usage

### Playing a Test Sound

```typescript
import { playTestSound } from '@/lib/audio-utils';

// Play a test sound
playTestSound('bell', 70); // preset, volume (0-100)
```

### Playing a Notification Sound

```typescript
import { playNotificationSound } from '@/lib/audio-utils';

playNotificationSound({
  preset: 'alert',
  volume: 80,
  duration: 0.5 // optional, default 0.5 seconds
});
```

### Checking Audio Support

```typescript
import { isAudioSupported } from '@/lib/audio-utils';

if (isAudioSupported()) {
  // Web Audio API is available
}
```

## Sound Presets

- **bell** - Gentle chime (frequency sweep 800→600 Hz)
- **chime** - Musical notification (frequency sweep 1200→400 Hz)
- **beep** - Electronic sound (constant 1000 Hz, shorter duration)
- **alert** - Attention-grabbing (frequency sweep 1500→900 Hz, shorter duration)
- **notification** - Soft ping (frequency sweep 700→500 Hz)
- **ding** - Classic notification (frequency sweep 950→650 Hz)

## Features

- Cross-browser compatible (with WebKit fallback)
- Volume control (0-100%)
- Customizable duration
- Automatic audio context suspension handling
- Error handling and logging
- Reusable across the application

## Browser Support

- Chrome 14+
- Firefox 25+
- Safari 6+
- Edge 12+
- Opera 10.6+

All modern browsers support the Web Audio API. The utility gracefully degrades on unsupported browsers.
