// Shared by the app and the seed script (no server-only marker).

export type UploadLimits = { imageMb: number; documentMb: number; audioMb: number; videoMb: number };
export type SiteInfo = {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  facebookUrl: string;
  zaloUrl: string;
};

export const DEFAULT_SETTINGS = {
  /** videoMb is 90 (not 100) while the site is served through Cloudflare Tunnel — see docs/DEPLOYMENT.md §0. */
  "upload.limits": { imageMb: 10, documentMb: 30, audioMb: 30, videoMb: 90 } satisfies UploadLimits,
  "site.info": {
    name: "Sala English Corner",
    tagline: "Lớp học tiếng Anh cho trẻ em, học sinh và người lớn",
    phone: "",
    email: "",
    address: "",
    facebookUrl: "",
    zaloUrl: "",
  } satisfies SiteInfo,
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
