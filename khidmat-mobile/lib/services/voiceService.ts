import { Audio } from 'expo-av';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { getApiBaseUrl } from '../util/apiConfig';

export interface VoiceTranscriptionResult {
  rawTranscript: string;
  normalizedText: string;
  language: string;
  dialect?: string;
}

let activeRecording: Audio.Recording | null = null;

/**
 * Requests microphone permission from the user.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('[voiceService] Failed to request microphone permission:', error);
    return false;
  }
}

/**
 * Safely reads a local file URI as a base64 string across Expo SDK versions.
 * Supports both the modern SDK 54+ `File.base64()` API and `expo-file-system/legacy`.
 */
async function readAudioFileAsBase64(uri: string): Promise<string> {
  // Try modern File API first
  try {
    const audioFile = new File(uri);
    if (typeof audioFile.base64 === 'function') {
      const b64 = await audioFile.base64();
      if (b64 && typeof b64 === 'string') {
        return b64;
      }
    }
  } catch (err) {
    console.warn('[voiceService] File.base64() fallback to legacy:', err);
  }

  // Fallback to expo-file-system/legacy
  return await FileSystemLegacy.readAsStringAsync(uri, {
    encoding: FileSystemLegacy.EncodingType.Base64,
  });
}

/**
 * Safely deletes a local temporary audio recording file.
 */
async function deleteLocalAudioFile(uri: string): Promise<void> {
  try {
    const audioFile = new File(uri);
    if (typeof audioFile.delete === 'function') {
      audioFile.delete();
      return;
    }
  } catch {
    // ignore and fallback
  }

  try {
    await FileSystemLegacy.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

/**
 * Starts recording audio using the device microphone.
 */
export async function startVoiceRecording(): Promise<boolean> {
  try {
    // If a recording is already active, cancel it first
    if (activeRecording) {
      await cancelVoiceRecording();
    }

    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      throw new Error('Microphone permission not granted');
    }

    // Set audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();

    activeRecording = recording;
    return true;
  } catch (error) {
    console.error('[voiceService] Failed to start voice recording:', error);
    activeRecording = null;
    throw error;
  }
}

/**
 * Cancels and cleans up the active recording without transcribing.
 */
export async function cancelVoiceRecording(): Promise<void> {
  if (!activeRecording) return;

  try {
    const recording = activeRecording;
    activeRecording = null;

    const status = await recording.getStatusAsync();
    if (status.canRecord || status.isRecording) {
      await recording.stopAndUnloadAsync();
    }

    const uri = recording.getURI();
    if (uri) {
      await deleteLocalAudioFile(uri);
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
  } catch (error) {
    console.warn('[voiceService] Error cancelling voice recording:', error);
  }
}

/**
 * Stops the active recording, reads the file as base64, and sends it to the server for transcription.
 */
export async function stopVoiceRecordingAndTranscribe(): Promise<VoiceTranscriptionResult> {
  if (!activeRecording) {
    throw new Error('No active recording in progress');
  }

  const recording = activeRecording;
  activeRecording = null;

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    if (!uri) {
      throw new Error('Failed to retrieve recording file URI');
    }

    // Read the recorded audio file as base64 using compatible helper
    const audioBase64 = await readAudioFileAsBase64(uri);

    // Delete the local temporary recording file
    deleteLocalAudioFile(uri).catch(() => {});

    // Send to backend speech transcription endpoint
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/voice/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioBase64,
        mimeType: 'audio/m4a',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[voiceService] Server transcription returned error:', response.status, errBody);
      throw new Error(`Server returned error ${response.status}`);
    }

    const resJson = await response.json();
    const data = resJson.data || {};

    const rawTranscript = data.rawTranscript || '';
    const normalizedText = data.normalizedText || rawTranscript || '';
    const language = data.language || 'ur-Latn';
    const dialect = data.dialect;

    if (!normalizedText && !rawTranscript) {
      throw new Error('No transcription detected');
    }

    return {
      rawTranscript,
      normalizedText,
      language,
      dialect,
    };
  } catch (error) {
    console.error('[voiceService] Transcription process failed:', error);
    throw error;
  }
}
