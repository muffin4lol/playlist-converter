type MusicKitInstance = {
  authorize(): Promise<string>;
  unauthorize(): Promise<void>;
};
type MusicKitApi = {
  configure(options: {
    developerToken: string;
    app: { name: string; build: string };
  }): Promise<MusicKitInstance>;
  getInstance(): MusicKitInstance;
};
declare global {
  interface Window {
    MusicKit?: MusicKitApi;
  }
}
export async function authorizeMusicKit(developerToken: string) {
  if (!window.MusicKit)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Apple Music authorization script failed to load"));
      document.head.appendChild(script);
    });
  if (!window.MusicKit)
    throw new Error("Apple Music authorization unavailable");
  const kit = await window.MusicKit.configure({
    developerToken,
    app: { name: "Playlist Converter", build: "1.0" },
  });
  return kit.authorize();
}
export async function disconnectMusicKit() {
  try {
    if (window.MusicKit) await window.MusicKit.getInstance().unauthorize();
  } catch {
    /* Server-side disconnection must still remove the encrypted token. */
  }
}
