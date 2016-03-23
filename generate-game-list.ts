import * as fs from 'fs';
// Must use the require() syntax for modules that export non-module entities.
// See https://github.com/Microsoft/TypeScript/issues/2242#issuecomment-83694181)
import validator = require('is-my-json-valid');
import { forEach } from 'lodash';

// UUIDs are a string of hexidecimal digits separated with hyphens in a
// 8-4-4-4-12 format (.e.g e4e64922-2172-4099-b5b7-80dca6b47159).
const uuid_pattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

const validateGame = validator({
    type: 'object',
    required: ['gameId', 'gameRealm'],
    additionalProperties: true,
    properties: {
        gameId: {
            // TODO: pattern
            type: 'string'
        },
        gameRealm: {
            // TODO: pattern
            type: 'string'
        }
    }
});
const validateMatch = validator({
    type: 'object',
    required: ['id', 'games'],
    additionalProperties: true,
    properties: {
        id: {
            type: 'string',
            pattern: uuid_pattern
        },
        games: {
            type: 'object',
            additionalProperties: false,
            patternProperties: {
                [uuid_pattern]: {
                    type: 'object'
                }
            }
        }
    }
});
const validateBracket = validator({
    type: 'object',
    required: ['matches'],
    additionalProperties: true,
    properties: {
        matches: {
            type: 'object',
            // Each property must be a UUID.
            additionalProperties: false,
            patternProperties: {
                [uuid_pattern]: {
                    type: 'object'
                }
            }
        }
    }
});
const validateTournament = validator({
    type: 'object',
    required: ['id', 'brackets'],
    additionalProperties: true,
    properties: {
        id: {
            type: 'string',
            pattern: uuid_pattern
        },
        brackets: {
            type: 'object',
            // Each property must be a UUID.
            additionalProperties: false,
            patternProperties: {
                [uuid_pattern]: {
                    type: 'object'
                }
            }
        }
    }
});
const validateLeague = validator({
    type: 'object',
    required: ['highlanderTournaments'],
    additionalProperties: true,
    properties: {
        highlanderTournaments: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: {
                type: 'object'
            }
        }
    },
});

/*interface LeagueInfo {
    matches: MatchInfo[];
    games: Map<string, { gameId: string, gameRealm: string }>;
}

interface MatchInfo {
    tournamentId: string;
    matchId: string;
}

interface League_GameInfo {
    gameId: string;
    gameRealm: string;
}

interface MatchDetails {
    games: Array<MatchDetails_GameInfo>;
}

interface MatchDetails_GameInfo {
    gameHash: string;
    videoUrl: string;
    teams: MatchDetails_TeamInfo[];
}

interface MatchDetails_TeamInfo {
    name: string;
    logoUrl: string;
}

interface MatchHistory_GameInfo {
    startTimestamp: number;
    durationSeconds: number;
    teams: MatchHistory_TeamInfo[];
}

interface MatchHistory_TeamInfo {
    numDeaths: number;
    gold: number;
}*/

interface LeagueInfo {
    matches: Array<MatchInfo>;
    games: Map<string, GameInfo>;
}

interface MatchInfo {
    tournamentId: string;
    matchId: string;
}

interface GameInfo {
    // All 3 of these are needed to construct the match details URL, which is
    // used to get game duration, game start time, team deaths, and team gold.
    gameId?: string;
    gameRealm?: string;
    gameHash?: string;

    // Maps locale to video URL.
    videos?: Map<string, string>;

    teams?: Array<TeamInfo>;

    startTime?: Date;
    durationSeconds?: number;
}

interface TeamInfo {
    acronym?: string;
    name?: string;
    logoUrl?: string;

    kills?: number;
    deaths?: number;
    assists?: number;
    gold?: number;
}

function parseLeagueInfo(leagueInfo: any): LeagueInfo | void {
    if (validateLeague(leagueInfo) !== true) {
        console.error('Dropping invalid league:', validateLeague.errors);
        return null;
    }

    const games = new Map<string, GameInfo>();
    const matches = new Array<MatchInfo>();
    const league = {
        matches,
        games
    };

    forEach(leagueInfo.highlanderTournaments, (tournament) => {
        if (validateTournament(tournament) !== true) {
            console.error('Dropping invalid tournament:', validateTournament.errors);
            return;
        }

        const tournamentId = tournament.id;

        forEach(tournament.brackets, (bracket) => {
            if (validateBracket(bracket) !== true) {
                console.error('Dropping invalid bracket:', validateBracket.errors);
                return;
            }

            forEach(bracket.matches, (match) => {
                if (validateMatch(match) !== true) {
                    console.error('Dropping invalid match:', validateMatch.errors);
                    return;
                }

                const matchId = match.id;

                matches.push({
                    tournamentId,
                    matchId
                });

                forEach(match.games, (game, key) => {
                    if (validateGame(game) !== true) {
                        console.error('Dropping invalid game:', validateGame.errors);
                        return;
                    }

                    games.set(key, {
                        gameId: game.gameId,
                        gameRealm: game.gameRealm
                    });
                });
            });
        });
    });

    return league;
}

const validateMatchDetails = validator({
    type: 'object',
    required: ['gameIdMappings', 'teams', 'videos'],
    additionalProperties: true,
    properties: {
        gameIdMappings: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: {
                type: 'object',
                required: ['id', 'gameHash'],
                additionalProperties: false,
                properties: {
                    id: {
                        type: 'string',
                        pattern: uuid_pattern
                    },
                    gameHash: {
                        // TODO: pattern
                        type: 'string'
                    }
                }
            }
        },
        teams: {
            type: 'array',
            minItems: 2,
            uniqueItems: true,
            items: {
                type: 'object',
                required: ['acronym', 'name', 'logoUrl'],
                additionalProperties: true,
                properties: {
                    acronym: { type: 'string' },
                    name: { type: 'string' },
                    logoUrl: {
                        type: 'string',
                        format: 'uri'
                    }
                }
            }
        },
        videos: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: {
                type: 'object',
                required: ['game', 'locale', 'source'],
                additionalProperties: true,
                properties: {
                    game: {
                        type: 'string',
                        pattern: uuid_pattern
                    },
                    locale: { type: 'string' },
                    source: {
                        type: 'string',
                        format: 'uri'
                    }
                }
            }
        }
    }
});

function parseMatchDetails(matchDetails: any): Map<string, GameInfo> | void {
    if (validateMatchDetails(matchDetails) !== true) {
        console.error('Dropping invalid match:', validateMatchDetails.errors);
        return null;
    }

    const games = new Map<string, GameInfo>();

    // Extract team info, which will be the same for each game.
    const teams = new Array<TeamInfo>();
    forEach(matchDetails.teams, (team) => {
        teams.push({
            acronym: team.acronym,
            name: team.name,
            logoUrl: team.logoUrl
        });
    });

    // Extract gameHash.
    forEach(matchDetails.gameIdMappings, (game) => {
        games.set(game.id, {
            gameHash: game.gameHash,
            // Videos map locale to video URL.
            videos: new Map<string, string>(),
            teams
        });
    });

    // Extract video URLs.
    forEach(matchDetails.videos, (video) => {
        const game = games.get(video.game);

        if (game) {
            game.videos.set(video.locale, video.source);
        } else {
            console.error('Found video for non-existent game:', video);
        }
    });

    return games;
}

const validateMatchHistory = validator({
    type: 'object',
    required: ['participants', 'gameDuration', 'gameCreation'],
    additionalProperties: true,
    properties: {
        gameDuration: { type: 'number' },
        gameCreation: { type: 'number' },
        participants: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: {
                type: 'object',
                required: ['stats'],
                additionalProperties: true,
                properties: {
                    stats: {
                        type: 'object',
                        required: ['kills', 'deaths', 'assists', 'goldEarned'],
                        additionalProperties: true,
                        properties: {
                            kills: { type: 'number' },
                            deaths: { type: 'number' },
                            assists: { type: 'number' },
                            goldEarned: { type: 'number' }
                        }
                    }
                }
            }
        }
    }
});

function parseMatchHistory(matchHistory: any): GameInfo | void {
    if (validateMatchHistory(matchHistory) !== true) {
        console.error('Dropping invalid match history:', validateMatchHistory.errors);
        return null;
    }

    const teams = new Map<number, TeamInfo>();

    forEach(matchHistory.participants, (participant) => {
        const teamId = participant.teamId;

        if (!teams.has(teamId)) {
            teams.set(teamId, {
                kills: 0,
                deaths: 0,
                assists: 0,
                gold: 0
            });
        }

        const team = teams.get(teamId);
        team.kills += participant.stats.kills;
        team.deaths += participant.stats.deaths;
        team.assists += participant.stats.assists;
        team.gold += participant.stats.goldEarned;
    });

    const teamList = new Array<TeamInfo>();
    teams.forEach((team) => teamList.push(team));

    return {
        durationSeconds: matchHistory.gameDuration,
        startTime: new Date(matchHistory.gameCreation),
        teams: teamList
    };
}

const leagueInfo = JSON.parse(fs.readFileSync('./na-lcs.json', { encoding: 'utf-8' }));
console.log(parseLeagueInfo(leagueInfo));
console.log('-----------------------------------------------------------');
const matchDetails = JSON.parse(fs.readFileSync('./match-details.json', { encoding: 'utf-8' }));
console.log(parseMatchDetails(matchDetails));
console.log('-----------------------------------------------------------');
const matchHistory = JSON.parse(fs.readFileSync('./match-history.json', { encoding: 'utf-8' }));
console.log(parseMatchHistory(matchHistory));
