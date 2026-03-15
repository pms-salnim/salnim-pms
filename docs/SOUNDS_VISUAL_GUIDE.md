# Notification Sounds - Visual Reference Guide

## 17 Available Sound Presets

### 🎵 How to Use This Guide

Each sound is described with:
- **Name** - Preset identifier for code
- **Waveform** - Type of sound wave (sine = smooth, square = digital, triangle = punchy, sawtooth = complex)
- **Frequency Range** - Hz from start to end
- **Duration** - How long it plays
- **Feel** - Emotional tone
- **Best For** - Suggested event types
- **Visual** - ASCII representation of the frequency sweep

---

## Original Sounds (Classic - 6 sounds)

### 1. 🔔 BELL
```
Frequency:  800Hz ──→ 600Hz
Duration:   0.5s
Waveform:   Sine (smooth, round)
Feel:       Warm, pleasant, musical
ASCII:      ╮                    ╭─
            │ ╭──────────────╮ ╭─
            │╭─              ─╯

Best for:   General notifications, payment received
Alternatives: chime, ding
```

### 2. 🎼 CHIME
```
Frequency:  1200Hz ──→ 400Hz
Duration:   0.5s
Waveform:   Sine (smooth ascent then descent)
Feel:       Musical, uplifting, ascending
ASCII:             ╭─────
                 ╭─       ─╮
              ╭─             ╰─
           ╭─                   ╰──

Best for:   Positive events, guest arrival, booking confirmed
Alternatives: bell, ping
```

### 3. 📢 BEEP
```
Frequency:  1000Hz (constant)
Duration:   0.3s
Waveform:   Sine (steady tone)
Feel:       Electronic, familiar, system
ASCII:      ─────────────────────
            │ Steady 1000Hz tone

Best for:   System notifications, quick alerts
Alternatives: notification, ping
```

### 4. ⚠️ ALERT
```
Frequency:  1500Hz ──→ 900Hz
Duration:   0.3s
Waveform:   Sine (urgent descent)
Feel:       Attention-grabbing, urgent, descending
ASCII:      ────╮
              ╰─╰──
                 ╰───

Best for:   Important alerts, payment failed, errors
Alternatives: buzz, whoosh
```

### 5. 🔕 NOTIFICATION
```
Frequency:  700Hz ──→ 500Hz
Duration:   0.5s
Waveform:   Sine (soft, subtle descent)
Feel:       Gentle, non-intrusive, soft
ASCII:      ╭─────────╮
           ╱           ╲
          ╱             ╲

Best for:   Messages, reminders, background alerts
Alternatives: ping, chirp
```

### 6. 🔔 DING
```
Frequency:  950Hz ──→ 650Hz
Duration:   0.5s
Waveform:   Sine (classic bell sound)
Feel:       Friendly, classic, familiar
ASCII:      ╭───────╮
           ╱         ╲
          ╱           ╰──

Best for:   Check-in notifications, confirmations
Alternatives: bell, chime
```

---

## Modern Sounds (New - 11 sounds)

### 7. 💨 WHOOSH
```
Frequency:  2000Hz ──→ 200Hz
Duration:   0.4s (fast sweep)
Waveform:   Triangle (punchy, sharp edges)
Feel:       Fast, urgent, action-oriented
ASCII:      ╭────────
           ╱
          ╱
        ╱
      ╱
     ╱____

Best for:   Urgent actions, critical alerts, system events
Alternatives: alert, buzz
```

### 8. 💥 POP
```
Frequency:  1200Hz ──→ 600Hz
Duration:   0.1s (very short!)
Waveform:   Square (digital, bouncy)
Feel:       Quick, punchy, immediate
ASCII:      ╮
           ╭─╯

Best for:   Confirmations, quick acknowledgments, check-in
Alternatives: ding, ping
```

### 9. 📍 PING
```
Frequency:  1600Hz ──→ 1400Hz
Duration:   0.25s (slight variation)
Waveform:   Sine (high-pitched, bright)
Feel:       Bright, uplifting, social
ASCII:      ─╮╭─
            ╰─╰

Best for:   Messages, new booking, social notifications
Alternatives: notification, chirp
```

### 10. 🎺 CLING
```
Frequency:  1800Hz ──→ 1600Hz
Duration:   0.35s (sustained)
Waveform:   Triangle (metallic, distinctive)
Feel:       Metallic, distinct, recognizable
ASCII:      ─────╮╭─
           │     ╰─╰

Best for:   Distinct alerts, inventory notifications, unique events
Alternatives: ping, sparkle
```

### 11. ✨ SPARKLE
```
Frequency:  2200Hz ──→ 1000Hz
Duration:   0.45s (long sweep)
Waveform:   Sawtooth (rich, complex, shimmering)
Feel:       Magical, positive, descending fairy tale
ASCII:      ╱────────────
           ╱            ╰─
          ╱               ╰──
         ╱

Best for:   Positive milestones, low inventory (subtle), rewards
Alternatives: ping, cling
```

### 12. 🐝 BUZZ
```
Frequency:  900Hz ──→ 800Hz
Duration:   0.4s
Waveform:   Sawtooth (complex, buzzy, rough)
Feel:       Electronic, busy, alarming
ASCII:      ─╮╭─╮╭─╮╭─
            ╰─╰─╰─╰─╰

Best for:   System alerts, payment failed, errors
Alternatives: alert, whoosh
```

### 13. 🐤 CHIRP
```
Frequency:  1400Hz ──→ 1800Hz
Duration:   0.3s (ascending!)
Waveform:   Sine (smooth ascending)
Feel:       Bird-like, ascending, positive
ASCII:                    ╭─
                      ╭─╱
                  ╭─╱
              ╭─╱
          ╭─╱

Best for:   Friendly alerts, messages, social events
Alternatives: ping, notification
```

### 14. 🎸 TWANG
```
Frequency:  1100Hz ──→ 700Hz
Duration:   0.25s (quick pluck)
Waveform:   Triangle (plucky, twangy)
Feel:       Guitar-like, twangy, percussive
ASCII:      ╭────╮
           ╱      ╰─
          ╱

Best for:   Quick alerts, task assignments, reminders
Alternatives: ding, pop
```

### 15. 🚀 BOING
```
Frequency:  600Hz ──→ 400Hz
Duration:   0.35s (bouncy)
Waveform:   Sine (smooth bouncy descent)
Feel:       Playful, bouncy, rubber-like
ASCII:      ╭──────╮
           ╱        ╰─
          ╱           ╰──

Best for:   Playful confirmations, game-like alerts, team notifications
Alternatives: pop, ding
```

### 16. 🎻 PLUCK
```
Frequency:  1300Hz ──→ 800Hz
Duration:   0.2s (quick pluck)
Waveform:   Square (digital pluck)
Feel:       Digital pluck, percussive, sharp
ASCII:      ╮────
           ╭─╰───
          ╱

Best for:   Quick confirmations, task alerts, brief notifications
Alternatives: twang, pop
```

### 17. 🎹 TONE
```
Frequency:  1000Hz (constant)
Duration:   0.4s (sustained)
Waveform:   Sine (pure steady tone)
Feel:       Pure, steady, professional
ASCII:      ──────────────────────
            │ Perfect 1000Hz sine wave

Best for:   Professional alerts, system notifications, tests
Alternatives: beep, notification
```

---

## Sound Characteristics Comparison

### By Frequency Range
| Sound | Start | End | Range | Character |
|-------|-------|-----|-------|-----------|
| Whoosh | 2000 | 200 | 1800 | Very sweeping |
| Sparkle | 2200 | 1000 | 1200 | Long sweep |
| Ping | 1600 | 1400 | 200 | Slight variation |
| Cling | 1800 | 1600 | 200 | High & sustained |
| Chime | 1200 | 400 | 800 | Musical descent |
| Alert | 1500 | 900 | 600 | Urgent descent |
| Chirp | 1400 | 1800 | 400 | Ascending |
| Twang | 1100 | 700 | 400 | Quick pluck |
| Pluck | 1300 | 800 | 500 | Percussive |
| Beep | 1000 | 1000 | 0 | Steady tone |
| Tone | 1000 | 1000 | 0 | Pure tone |
| Pop | 1200 | 600 | 600 | Abrupt drop |
| Buzz | 900 | 800 | 100 | Electronic |
| Boing | 600 | 400 | 200 | Playful drop |
| Ding | 950 | 650 | 300 | Classic |
| Bell | 800 | 600 | 200 | Warm descent |
| Notification | 700 | 500 | 200 | Soft descent |

### By Duration
| Duration | Sounds | Best For |
|----------|--------|----------|
| 0.1-0.2s | Pop, Pluck | Quick confirmations |
| 0.25-0.3s | Ping, Chirp, Buzz, Twang | Brief alerts |
| 0.35-0.4s | Cling, Whoosh, Boing, Tone | Standard notifications |
| 0.45-0.5s | Sparkle, Bell, Chime, Ding, Notification | Full notifications |

### By Waveform Type
| Waveform | Sounds | Character |
|----------|--------|-----------|
| **Sine** | Bell, Chime, Beep, Alert, Notification, Ding, Ping, Chirp, Boing, Tone | Smooth, round, pleasant |
| **Square** | Pop, Pluck | Digital, bouncy, sharp |
| **Triangle** | Whoosh, Cling, Twang | Punchy, distinctive, metallic |
| **Sawtooth** | Sparkle, Buzz | Complex, rich, rough, shimmering |

---

## Sound Selection Decision Tree

```
What type of event?

├─ POSITIVE (Guest arrival, booking, payment)
│  ├─ Quick response? → POP or PING
│  ├─ Friendly tone?  → DING or CHIRP
│  └─ Musical tone?   → BELL or CHIME

├─ URGENT (Payment failed, system error, alert)
│  ├─ Critical?       → WHOOSH or ALERT
│  ├─ System event?   → BUZZ or ALERT
│  └─ Attention?      → ALERT or BUZZ

├─ ROUTINE (Reminder, message, task)
│  ├─ Social?         → PING or CHIRP
│  ├─ Background?     → NOTIFICATION or TONE
│  └─ Quick task?     → TWANG or PLUCK

├─ SPECIAL (Inventory, milestone, reward)
│  ├─ Celebration?    → SPARKLE or DING
│  ├─ Magical feel?   → SPARKLE
│  └─ Playful?        → BOING or TWANG

└─ DEFAULT
   └─ When in doubt?  → DING or BELL
```

---

## Test Procedure for All Sounds

1. Open app → Settings → Notifications (System tab)
2. Scroll to "Sound Notifications" section
3. Enable toggle: "Enable Sound Notifications"
4. For each sound:
   - Select from dropdown
   - Set volume to 70%
   - Click "Test Sound"
   - Note the characteristics

**Testing Checklist:**
- [ ] Bell - Warm, musical
- [ ] Chime - Ascending tone
- [ ] Beep - Electronic steady
- [ ] Alert - Urgent descent
- [ ] Notification - Soft, subtle
- [ ] Ding - Classic, friendly
- [ ] Whoosh - Fast sweep, urgent
- [ ] Pop - Quick burst
- [ ] Ping - Bright, high
- [ ] Cling - Metallic, distinct
- [ ] Sparkle - Magical, shimmering
- [ ] Buzz - Rough, electronic
- [ ] Chirp - Bird-like ascending
- [ ] Twang - Twangy pluck
- [ ] Boing - Playful bounce
- [ ] Pluck - Guitar-like pluck
- [ ] Tone - Pure steady tone

---

## Pairing Sounds with Events

### Recommended Pairings

**Reservation Events**
- New Booking Received → **PING** (bright, social)
- Booking Modified → **NOTIFICATION** (soft, attentive)
- Booking Cancelled → **ALERT** (attention needed)
- Booking Confirmed → **DING** (friendly confirmation)

**Guest Events**
- Check-In Reminder → **CHIRP** (friendly, ascending)
- Check-Out Reminder → **NOTIFICATION** (soft reminder)
- Check-In Confirmed → **POP** (quick acknowledgment)
- Check-Out Completed → **DING** (completion sound)

**Payment Events**
- Payment Received → **BELL** (positive, musical)
- Payment Failed → **BUZZ** (urgent alert)
- Payment Reminder → **PING** (attention-getting)
- Refund Processed → **SPARKLE** (positive completion)

**Staff Events**
- Task Assigned → **POP** (quick, attention-getting)
- Task Completed → **DING** (completion confirmation)
- Maintenance Report → **TWANG** (quick alert)
- Housekeeping Report → **TWANG** (quick alert)

**System Events**
- Backup Complete → **DING** (success confirmation)
- System Alert → **WHOOSH** (urgent, action-needed)
- Low Inventory → **SPARKLE** (subtle, magical attention)
- Price Update → **NOTIFICATION** (background event)

---

## Volume Recommendations

| Type | Volume | Reason |
|------|--------|--------|
| Critical alerts | 90-100% | Must be heard |
| Important notifications | 70-80% | Clear but not startling |
| Standard notifications | 60-70% | Normal audibility |
| Background reminders | 40-50% | Non-intrusive |
| Testing | 40-70% | Comfortable listening |

---

## Audio Processing Details

All sounds are generated using **Web Audio API Oscillators**:

- **Attack Time**: Instant (0.01s fade-in)
- **Release Time**: Exponential decay over duration
- **Post-processing**: None (raw oscillator output)
- **Bit Depth**: 32-bit float (browser native)
- **Sample Rate**: 44100 or 48000 Hz (browser dependent)

**Why Oscillators?**
✅ No file dependencies
✅ Works offline
✅ Perfect for testing
✅ Instant playback
✅ Zero storage needed

---

## Accessibility Notes

**High-pitched sounds** (Ping, Cling, Sparkle):
- May be uncomfortable for some
- Consider volume reduction
- Good for getting attention quickly

**Low-pitched sounds** (Boing, Notification, Bell):
- More comfortable for extended listening
- Better for frequent notifications
- Less jarring

**Recommendation:**
- Use variety to prevent audio fatigue
- Pair high-pitched with low-pitched events
- Allow customization per event
- Always offer silent mode option

---

## Exporting for Sharing

If you find the perfect combination of sounds for your property:

```json
{
  "soundConfiguration": {
    "newBooking": "ping",
    "paymentReceived": "bell",
    "systemAlert": "whoosh",
    "checkIn": "pop",
    "volume": 70,
    "muteInDND": true
  }
}
```

Can be:
1. Exported as JSON
2. Shared with team
3. Imported by other properties
4. Documented for future reference

---

## Summary

**Choose based on:**
1. **Event importance** - More urgent? Use sweeping sounds
2. **Frequency** - Frequent alerts? Use pleasant sounds
3. **Team preference** - Ask users which they prefer
4. **Workplace environment** - Quiet office? Lower volume

**Pro Tip:** Don't use same sound for different event types - users need audio differentiation to understand what happened without looking at screen.

