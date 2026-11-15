import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  BarcodeScanner,
  BarcodeFormat,
} from '@capacitor-mlkit/barcode-scanning';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { GeoReading } from '@admin/management/fieldStore';
import type { KV, KeyStore } from './offline/vault';

/**
 * Native adapters. On Android/iOS these use the device keystore/keychain, ML
 * Kit, the camera and GPS. In a desktop browser (tests, previews) the same
 * calls fall back to web APIs; the vault key then lives only for the browser
 * session, so nothing decryptable outlives it.
 */
export const isNative = Capacitor.isNativePlatform();
export const platformName = Capacitor.getPlatform();

export const keyStore: KeyStore = isNative
  ? {
      get: async (k) => {
        const v = await SecureStorage.get(k).catch(() => null);
        return typeof v === 'string' ? v : null;
      },
      set: async (k, v) => {
        await SecureStorage.set(k, v);
      },
      remove: async (k) => {
        await SecureStorage.remove(k).catch(() => false);
      },
    }
  : {
      get: async (k) => sessionStorage.getItem(k),
      set: async (k, v) => sessionStorage.setItem(k, v),
      remove: async (k) => sessionStorage.removeItem(k),
    };
/** Holds ciphertext only. */
export const kv: KV = isNative
  ? {
      get: async (k) => (await Preferences.get({ key: k })).value,
      set: async (k, v) => Preferences.set({ key: k, value: v }),
      remove: async (k) => Preferences.remove({ key: k }),
      keys: async () => (await Preferences.keys()).keys,
    }
  : {
      get: async (k) => localStorage.getItem(k),
      set: async (k, v) => localStorage.setItem(k, v),
      remove: async (k) => localStorage.removeItem(k),
      keys: async () => Object.keys(localStorage),
    };

export type GeoResult =
  | { ok: true; reading: GeoReading }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' };
/** One reading for an explicit action. The app never tracks location in the background. */
export async function getLocation(): Promise<GeoResult> {
  try {
    if (isNative) {
      let p = await Geolocation.checkPermissions();
      if (p.location !== 'granted')
        p = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (p.location !== 'granted') return { ok: false, reason: 'denied' };
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
    return {
      ok: true,
      reading: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: new Date(pos.timestamp || Date.now()),
      },
    };
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (/denied|permission/i.test(msg) || (e as { code?: number }).code === 1)
      return { ok: false, reason: 'denied' };
    if (/timeout/i.test(msg) || (e as { code?: number }).code === 3)
      return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'unavailable' };
  }
}

export type ScanResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'cancelled' | 'denied' | 'unsupported' };
/** Native ML Kit scanner (Google code scanner on Android, camera scanner on iOS). */
export async function scanNative(): Promise<ScanResult> {
  if (!isNative) return { ok: false, reason: 'unsupported' };
  try {
    if (platformName === 'android') {
      const { available } =
        await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
    } else {
      const p = await BarcodeScanner.requestPermissions();
      if (p.camera !== 'granted' && p.camera !== 'limited')
        return { ok: false, reason: 'denied' };
    }
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    });
    const text = barcodes[0]?.rawValue;
    return text ? { ok: true, text } : { ok: false, reason: 'cancelled' };
  } catch (e) {
    return {
      ok: false,
      reason: /cancel/i.test(String((e as Error)?.message))
        ? 'cancelled'
        : /permission|denied/i.test(String((e as Error)?.message))
          ? 'denied'
          : 'unsupported',
    };
  }
}

export type Photo = {
  jpegBase64: string;
  width: number;
  height: number;
  bytes: number;
  capturedAt: string;
};
/** Captures and compresses a photo (max 1280 px, JPEG ~60%). */
export async function takePhoto(): Promise<
  | { ok: true; photo: Photo }
  | { ok: false; reason: 'cancelled' | 'denied' | 'unsupported' }
> {
  try {
    if (isNative) {
      let p = await Camera.checkPermissions();
      if (p.camera !== 'granted')
        p = await Camera.requestPermissions({ permissions: ['camera'] });
      if (p.camera !== 'granted' && p.camera !== 'limited')
        return { ok: false, reason: 'denied' };
      const r = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 60,
        width: 1280,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!r.base64String) return { ok: false, reason: 'cancelled' };
      return { ok: true, photo: await measure(r.base64String) };
    }
    const file = await pickFile();
    if (!file) return { ok: false, reason: 'cancelled' };
    return { ok: true, photo: await compress(file) };
  } catch (e) {
    return {
      ok: false,
      reason: /denied|permission/i.test(String((e as Error)?.message))
        ? 'denied'
        : /cancel/i.test(String((e as Error)?.message))
          ? 'cancelled'
          : 'unsupported',
    };
  }
}
function pickFile() {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
async function compress(file: Blob): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.6);
  const b64 = url.slice(url.indexOf(',') + 1);
  return {
    jpegBase64: b64,
    width: canvas.width,
    height: canvas.height,
    bytes: Math.round((b64.length * 3) / 4),
    capturedAt: new Date().toISOString(),
  };
}
async function measure(b64: string): Promise<Photo> {
  const img = new Image();
  img.src = 'data:image/jpeg;base64,' + b64;
  await img.decode().catch(() => undefined);
  return {
    jpegBase64: b64,
    width: img.naturalWidth,
    height: img.naturalHeight,
    bytes: Math.round((b64.length * 3) / 4),
    capturedAt: new Date().toISOString(),
  };
}

export async function onlineNow() {
  try {
    return (await Network.getStatus()).connected;
  } catch {
    return navigator.onLine;
  }
}
export function watchNetwork(cb: (online: boolean) => void) {
  const h = Network.addListener('networkStatusChange', (s) => cb(s.connected));
  return () => void h.then((x) => x.remove());
}

/**
 * Evidence upload adapter. Cloud Storage needs the Firebase Blaze plan, which
 * is not approved, so the configured adapter reports "pending activation" and
 * photos stay encrypted on the device. Replace with a Storage-backed adapter
 * once storage is approved; nothing else in the app needs to change.
 */
export interface EvidenceUploader {
  readonly active: boolean;
  readonly reason: string;
  upload(photo: Photo, path: string): Promise<string>;
}
export const uploader: EvidenceUploader = {
  active: false,
  reason:
    'Photo upload needs Firebase Cloud Storage (Blaze plan), which has not been approved. Photos stay encrypted on this device.',
  async upload() {
    throw new Error(this.reason);
  },
};
