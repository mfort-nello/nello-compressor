"use client";

// Google Drive integration — OAuth, Picker (pull), and Upload (push).
// Uses modern Google Identity Services (GSI) for auth. The drive.file scope
// limits access to files this app created or files the user explicitly
// selects via the Picker — we never see the user's whole Drive.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

const SCOPES = "https://www.googleapis.com/auth/drive.file";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
// The app ID is the GCP project number — the numeric prefix of the OAuth
// client ID. Required by Google Picker so Drive can link picked files to
// this app under the drive.file scope. Without it, downloads 404.
const APP_ID = CLIENT_ID.split("-")[0] ?? "";

export function isDriveConfigured(): boolean {
  return Boolean(CLIENT_ID && API_KEY);
}

// ---- Script loaders (idempotent) ------------------------------------------

let gapiLoadPromise: Promise<void> | null = null;
function loadGapi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject("SSR");
  if (window.gapi) return Promise.resolve();
  if (gapiLoadPromise) return gapiLoadPromise;
  gapiLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google API script"));
    document.head.appendChild(s);
  });
  return gapiLoadPromise;
}

let gsiLoadPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject("SSR");
  if (window.google?.accounts) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;
  gsiLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gsiLoadPromise;
}

let pickerLoaded = false;
function loadPicker(): Promise<void> {
  if (pickerLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (!window.gapi) return reject(new Error("gapi not loaded"));
    window.gapi.load("picker", () => {
      pickerLoaded = true;
      resolve();
    });
  });
}

// ---- Token / auth ---------------------------------------------------------

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}
let cachedToken: CachedToken | null = null;

export function hasValidToken(): boolean {
  return !!cachedToken && cachedToken.expiresAt > Date.now() + 30_000;
}

export function clearToken(): void {
  cachedToken = null;
}

async function getAccessToken(): Promise<string> {
  if (hasValidToken()) return cachedToken!.accessToken;
  await loadGsi();

  return new Promise<string>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(`Authentication failed: ${resp.error}`));
          return;
        }
        cachedToken = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + resp.expires_in * 1000,
        };
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

// ---- Pull: Picker + download ----------------------------------------------

export interface DrivePickedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export async function pickFromDrive(): Promise<DrivePickedFile[]> {
  if (!isDriveConfigured()) {
    throw new Error("Drive integration is not configured.");
  }
  await loadGapi();
  await loadPicker();
  const token = await getAccessToken();

  return new Promise<DrivePickedFile[]>((resolve, reject) => {
    try {
      const view = new window.google.picker.DocsView(
        window.google.picker.ViewId.DOCS_IMAGES_AND_VIDEOS,
      )
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const picker = new window.google.picker.PickerBuilder()
        .setTitle("Pick files from Drive")
        .setAppId(APP_ID)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const files: DrivePickedFile[] = (data.docs ?? []).map(
              (d: any) => ({
                id: d.id,
                name: d.name,
                mimeType: d.mimeType,
                size: Number(d.sizeBytes ?? 0),
              }),
            );
            resolve(files);
          } else if (data.action === window.google.picker.Action.CANCEL) {
            resolve([]);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      reject(err);
    }
  });
}

export async function downloadDriveFile(
  picked: DrivePickedFile,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  const token = await getAccessToken();
  const url = `https://www.googleapis.com/drive/v3/files/${picked.id}?alt=media`;

  return new Promise<File>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "blob";
    xhr.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response as Blob;
        const file = new File([blob], picked.name, {
          type: picked.mimeType || blob.type,
        });
        resolve(file);
      } else {
        reject(new Error(`Drive download failed: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error downloading file"));
    xhr.send();
  });
}

// ---- Push: create folder + upload files -----------------------------------

export async function createDriveFolder(name: string): Promise<string> {
  const token = await getAccessToken();
  const resp = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to create Drive folder: HTTP ${resp.status}`);
  }
  const json = await resp.json();
  return json.id as string;
}

export interface UploadedFile {
  id: string;
  name: string;
  webViewLink?: string;
}

// Multipart upload — single request, fine for files <~50MB. For larger
// files we'd want resumable uploads; our compressed outputs should rarely
// exceed that ceiling.
export async function uploadBlobToDrive(
  blob: Blob,
  name: string,
  folderId?: string,
  onProgress?: (ratio: number) => void,
): Promise<UploadedFile> {
  const token = await getAccessToken();

  const metadata = {
    name,
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const boundary = "---------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadataPart =
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata);

  const bodyParts = [
    delimiter,
    metadataPart,
    delimiter,
    `Content-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`,
  ];
  const body = new Blob(
    [...bodyParts.map((p) => new Blob([p])), blob, new Blob([closeDelim])],
    { type: `multipart/related; boundary="${boundary}"` },
  );

  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader(
      "Content-Type",
      `multipart/related; boundary="${boundary}"`,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve({
            id: json.id,
            name: json.name,
            webViewLink: json.webViewLink,
          });
        } catch {
          reject(new Error("Upload succeeded but response was unparseable"));
        }
      } else {
        reject(new Error(`Drive upload failed: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}
