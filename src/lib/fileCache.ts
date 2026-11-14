import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";

const CACHE_DIR = `${FileSystem.documentDirectory || ""}media_cache/`;
let isDirReady = false;

async function ensureCacheDir(): Promise<void> {
  if (isDirReady) return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    isDirReady = true;
  } catch {}
}

function getCacheFilename(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  const cleanExt = (url.split("?")[0].split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "");
  return `cached_${Math.abs(hash)}.${cleanExt}`;
}

export function isLocalUri(uri?: string | null): boolean {
  if (!uri) return false;
  return (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("data:")
  );
}

export async function getCachedOrRemoteUri(url?: string | null): Promise<string> {
  if (!url) return "";
  if (isLocalUri(url)) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;

  await ensureCacheDir();
  const filename = getCacheFilename(url);
  const localPath = `${CACHE_DIR}${filename}`;

  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists && (info as any).size > 0) {
      return localPath;
    }

    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      const downloadResult = await FileSystem.downloadAsync(url, localPath);
      if (downloadResult.status === 200) {
        return downloadResult.uri;
      }
    }
  } catch {}

  return url;
}

export async function prefetchMediaFiles(urls: (string | null | undefined)[]): Promise<void> {
  const validUrls = Array.from(
    new Set(
      urls.filter(
        (u): u is string =>
          Boolean(u) &&
          !isLocalUri(u) &&
          (u!.startsWith("http://") || u!.startsWith("https://"))
      )
    )
  );

  if (validUrls.length === 0) return;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  await ensureCacheDir();

  const BATCH_SIZE = 3;
  for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
    const batch = validUrls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const filename = getCacheFilename(url);
          const localPath = `${CACHE_DIR}${filename}`;
          const info = await FileSystem.getInfoAsync(localPath);
          if (!info.exists || (info as any).size === 0) {
            await FileSystem.downloadAsync(url, localPath);
          }
        } catch {}
      })
    );
  }
}

