export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: number;
  album?: string;
  isrc?: string;
  explicit: boolean | null;
  selected: boolean;
};
export type Playlist = {
  id: string;
  name: string;
  count: number;
  image?: string;
};
export type Token = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  displayName: string;
  avatar?: string;
};
export type Role = "source" | "destination";
export interface PlatformAdapter {
  id: string;
  name: string;
  mode: "oauth" | "musickit";
  getAuthUrl(state: string, challenge: string, role: Role): string;
  handleCallback(code: string, verifier: string): Promise<Token>;
  refreshToken?(token: Token): Promise<Token>;
  fetchPublicPlaylist?(
    id: string,
    storefront?: string,
  ): Promise<{ name: string; tracks: Track[] }>;
  fetchUserPlaylists(token: Token): Promise<Playlist[]>;
  fetchPlaylist(
    token: Token,
    id: string,
  ): Promise<{ name: string; tracks: Track[] }>;
  searchTrack(token: Token, track: Track, clean?: boolean): Promise<Track[]>;
  createPlaylist(
    token: Token,
    name: string,
    description?: string,
  ): Promise<{ id: string; url: string }>;
  addTracks(token: Token, id: string, tracks: string[]): Promise<void>;
  revoke(token: Token): Promise<void>;
}
