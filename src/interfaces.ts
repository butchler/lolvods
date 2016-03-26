export interface Dict<T> {
    [index: string]: T;
}

export interface MatchInfo {
    id: string,
    tournamentId: string;
    games: Dict<GameInfo>;
    timestamp: number;
}

export interface GameInfo {
    id?: string;

    // All 3 of these are needed to construct the match details URL, which is
    // used to get game duration, game start time, team deaths, and team gold.
    gameId?: string;
    gameRealm?: string;
    gameHash?: string;

    // Maps video locale to video URL.
    videos?: Dict<string>;

    teams?: Array<TeamInfo>;

    stats?: GameStats;
}

export interface TeamInfo {
    acronym: string;
    name: string;
    logoUrl: string;
}

export interface GameStats {
    startTime: Date;
    durationSeconds: number;

    teamStats: Array<TeamStats>;
}

export interface TeamStats {
    kills: number;
    deaths: number;
    assists: number;
    gold: number;
}
