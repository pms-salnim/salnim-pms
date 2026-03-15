'use client';

import React, { useState, useEffect } from 'react';
import { 
  isAudioSupported, 
  getAudioContext,
  playTestSound,
  isNotificationSupported,
  hasNotificationPermission,
  requestNotificationPermission
} from '@/lib/audio-utils';

export function AudioDebugPanel() {
  const [audioStatus, setAudioStatus] = useState<{
    supported: boolean;
    contextState: string;
    notificationSupported: boolean;
    notificationPermission: NotificationPermission;
  }>({
    supported: false,
    contextState: 'unknown',
    notificationSupported: false,
    notificationPermission: 'default',
  });

  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    // Check audio support
    const supported = isAudioSupported();
    const ctx = getAudioContext();
    const notifSupported = isNotificationSupported();

    setAudioStatus({
      supported,
      contextState: ctx?.state || 'unavailable',
      notificationSupported: notifSupported,
      notificationPermission: notifSupported ? Notification.permission : 'denied',
    });
  }, []);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTest = async () => {
    setTestResults([]);
    addTestResult('Starting audio test...');

    // Test 1: Check audio API
    if (!isAudioSupported()) {
      addTestResult('❌ Web Audio API is not supported');
      return;
    }
    addTestResult('✅ Web Audio API is supported');

    // Test 2: Get audio context
    const ctx = getAudioContext();
    if (!ctx) {
      addTestResult('❌ Could not initialize audio context');
      return;
    }
    addTestResult(`✅ Audio context initialized: ${ctx.state}`);

    // Test 3: Request notification permission
    if (isNotificationSupported()) {
      if (Notification.permission === 'denied') {
        addTestResult('⚠️ Notification permission is denied by browser. Reset permissions and try again.');
      } else if (Notification.permission !== 'granted') {
        addTestResult('🔔 Requesting notification permission...');
        const permission = await requestNotificationPermission();
        addTestResult(`Notification permission: ${permission}`);
      } else {
        addTestResult('✅ Notification permission is already granted');
      }
    } else {
      addTestResult('⚠️ Notifications not supported in this browser');
    }

    // Test 4: Play test sounds
    addTestResult('🔊 Playing test sounds (check your speaker volume!)...');
    
    const presets: Array<'alert' | 'aurora' | 'bongo_sms' | 'chord' | 'nintendo_switch' | 'note' | 'notification_bell' | 'rebound' | 'tri_tone' | 'tweet' | 'water_drop'> = [
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

    for (const preset of presets) {
      try {
        addTestResult(`Playing ${preset} sound...`);
        await playTestSound(preset, 70);
        await new Promise(resolve => setTimeout(resolve, 600)); // Wait for sound to finish
        addTestResult(`✅ ${preset} sound played successfully`);
      } catch (error) {
        addTestResult(`❌ Error playing ${preset}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    addTestResult('✅ Audio test completed! If you heard all 11 sounds, audio is working correctly.');
  };

  return (
    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">🔧 Audio Debug Panel</h3>

      {/* Status Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-700">Web Audio API</p>
          <p className={`text-lg font-bold ${audioStatus.supported ? 'text-green-600' : 'text-red-600'}`}>
            {audioStatus.supported ? '✅ Supported' : '❌ Not Supported'}
          </p>
          {audioStatus.supported && (
            <p className="text-xs text-slate-600 mt-1">Context: {audioStatus.contextState}</p>
          )}
        </div>

        <div className="bg-white rounded p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-700">Notifications</p>
          <p className={`text-lg font-bold ${audioStatus.notificationSupported ? 'text-green-600' : 'text-red-600'}`}>
            {audioStatus.notificationSupported ? '✅ Supported' : '❌ Not Supported'}
          </p>
          {audioStatus.notificationSupported && (
            <p className="text-xs text-slate-600 mt-1">Permission: {audioStatus.notificationPermission}</p>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white rounded p-4 border border-slate-200 space-y-2">
        <h4 className="font-medium text-slate-900 text-sm">Test Results:</h4>
        <div className="bg-slate-100 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
          {testResults.length === 0 ? (
            <p className="text-slate-500">Click "Run Full Test" to start</p>
          ) : (
            testResults.map((result, idx) => (
              <p key={idx} className="text-slate-700">
                {result}
              </p>
            ))
          )}
        </div>
      </div>

      {/* Quick Test Buttons */}
      <div className="space-y-2">
        <button
          onClick={runTest}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          🧪 Run Full Test
        </button>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['alert', 'aurora', 'bongo_sms', 'chord', 'nintendo_switch', 'note', 'notification_bell', 'rebound', 'tri_tone', 'tweet', 'water_drop'] as const).map(preset => (
            <button
              key={preset}
              onClick={async () => {
                addTestResult(`Testing ${preset}...`);
                await playTestSound(preset, 70);
              }}
              className="px-2 py-1 bg-slate-200 text-slate-900 rounded hover:bg-slate-300 text-xs font-medium transition-colors"
            >
              {preset.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 Troubleshooting Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Make sure your speaker volume is turned on</li>
          <li>Check browser volume (some browsers have independent volume controls)</li>
          <li>Open browser DevTools (F12) and check Console for any errors</li>
          <li>Some browsers require page interaction before audio can play</li>
          <li>Grant notification permissions when prompted</li>
          <li>Check your OS sound settings</li>
        </ul>
      </div>
    </div>
  );
}
