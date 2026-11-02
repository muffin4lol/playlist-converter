export function playlistReference(platform: string, value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Invalid playlist URL. Paste the full HTTPS playlist link.",
    );
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("Invalid playlist URL");
  const host = url.hostname;
  let id = "",
    storefront: string | undefined;
  if (platform === "spotify" && host === "open.spotify.com")
    id =
      url.pathname.match(
        /^\/(?:intl-[a-z]{2}\/)?playlist\/([A-Za-z0-9]+)\/?$/,
      )?.[1] || "";
  if (
    platform === "youtube" &&
    ["youtube.com", "www.youtube.com", "music.youtube.com"].includes(host) &&
    ["/playlist", "/watch"].includes(url.pathname)
  )
    id = url.searchParams.get("list") || "";
  if (platform === "apple" && host === "music.apple.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (/^[a-z]{2}$/.test(parts[0] || "") && parts[1] === "playlist") {
      storefront = parts[0];
      id = parts.at(-1) || "";
    }
  }
  if (platform === "deezer" && ["deezer.com", "www.deezer.com"].includes(host))
    id = url.pathname.match(/^\/(?:[a-z]{2}\/)?playlist\/(\d+)\/?$/)?.[1] || "";
  if (
    platform === "tidal" &&
    ["tidal.com", "www.tidal.com", "listen.tidal.com"].includes(host)
  )
    id =
      url.pathname.match(
        /^\/(?:browse\/)?playlist\/([A-Za-z0-9-]+)\/?$/,
      )?.[1] || "";
  if (
    platform === "soundcloud" &&
    ["soundcloud.com", "www.soundcloud.com"].includes(host) &&
    /^\/[^/]+\/sets\/[^/]+\/?$/.test(url.pathname)
  )
    id = url.href;
  if (!id || (platform !== "soundcloud" && !/^[A-Za-z0-9_.-]{1,200}$/.test(id)))
    throw new Error("Invalid playlist URL for the selected source platform");
  return { id, storefront };
}
