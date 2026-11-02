// Only booleans leave the server; credentials never reach the browser.
export function platformAvailability() {
  return {
    spotify: !!process.env.SPOTIFY_CLIENT_ID,
    youtube: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    apple: !!process.env.APPLE_MUSIC_DEVELOPER_TOKEN,
    deezer: !!(process.env.DEEZER_APP_ID && process.env.DEEZER_APP_SECRET),
    tidal: !!process.env.TIDAL_CLIENT_ID,
    soundcloud: !!(
      process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET
    ),
  };
}

export function publicPlaylistAvailability() {
  return {
    spotify: !!(
      process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    ),
    youtube: !!process.env.YOUTUBE_API_KEY,
    apple: !!process.env.APPLE_MUSIC_DEVELOPER_TOKEN,
    deezer: true,
    tidal: false,
    soundcloud: false,
  };
}
