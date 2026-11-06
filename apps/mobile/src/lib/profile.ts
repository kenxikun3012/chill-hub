export interface CatalogueGame {
  id: string;
  name: string;
  inGameIdLabel: string;
  ranks: { id: string; name: string }[]; // lowest first
  roles: { id: string; name: string }[];
}

export interface InGameAccount {
  id: string;
  game: { id: string; name: string };
  inGameName: string;
  rank: { id: string; name: string } | null;
  preferredRoles: { id: string; name: string }[];
}

export interface Profile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  year: number | null;
  department: string | null;
  inGameAccounts: InGameAccount[];
}

export interface Reputation {
  good: number;
  noShowRate: number;
  lobbiesPlayed: number;
}
