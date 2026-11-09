import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  DRIVE_DATABASE_FILENAME,
  DriveDatabasePayload,
  parseDriveDatabasePayload,
} from './localWordDatabase';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token strictly in memory (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export interface DriveDatabaseFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Searches the user's Google Drive (within app-created files) for `kotonoha_dojo_database.json`.
 */
export async function findDriveDatabaseFile(
  accessToken: string
): Promise<DriveDatabaseFileInfo | null> {
  const q = encodeURIComponent(
    `name = '${DRIVE_DATABASE_FILENAME}' and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=5`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Google Drive 查詢失敗 (${res.status})`);
  }
  const data = await res.json();
  if (Array.isArray(data.files) && data.files.length > 0) {
    return data.files[0] as DriveDatabaseFileInfo;
  }
  return null;
}

/**
 * Creates a brand-new `kotonoha_dojo_database.json` file in the user's Google Drive.
 */
export async function createDriveDatabaseFile(
  accessToken: string,
  payload: DriveDatabasePayload
): Promise<DriveDatabaseFileInfo> {
  const metadata = {
    name: DRIVE_DATABASE_FILENAME,
    mimeType: 'application/json',
    description: '言の葉道場 Kotonoha Dojo 日語學習資料庫 (字庫 + SRS + 學習進度)',
  };

  const boundary = 'kotonoha_drive_boundary_v1';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(payload, null, 2)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(`建立 Google Drive 資料庫檔案失敗 (${res.status})`);
  }
  return (await res.json()) as DriveDatabaseFileInfo;
}

/**
 * Updates/overwrites an existing `kotonoha_dojo_database.json` file in Google Drive.
 * IMPORTANT: Must only be called after explicit user confirmation in the UI dialog!
 */
export async function updateDriveDatabaseFile(
  accessToken: string,
  fileId: string,
  payload: DriveDatabasePayload
): Promise<DriveDatabaseFileInfo> {
  const metadata = {
    name: DRIVE_DATABASE_FILENAME,
    mimeType: 'application/json',
  };

  const boundary = 'kotonoha_drive_update_boundary_v1';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(payload, null, 2)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,modifiedTime,size`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(`更新 Google Drive 資料庫檔案失敗 (${res.status})`);
  }
  return (await res.json()) as DriveDatabaseFileInfo;
}

/**
 * Downloads and parses `kotonoha_dojo_database.json` from the user's Google Drive.
 */
export async function downloadDriveDatabaseFile(
  accessToken: string,
  fileId: string
): Promise<DriveDatabasePayload> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`讀取 Google Drive 資料庫失敗 (${res.status})`);
  }
  const raw = await res.json();
  const parsed = parseDriveDatabasePayload(raw);
  if (!parsed) {
    throw new Error('Google Drive 資料庫檔案格式無效');
  }
  return parsed;
}

/**
 * Deletes the database file from the user's Google Drive.
 * IMPORTANT: Must only be called after explicit user confirmation in the UI dialog!
 */
export async function deleteDriveDatabaseFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`刪除 Google Drive 檔案失敗 (${res.status})`);
  }
}
