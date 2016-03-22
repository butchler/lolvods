import * as fs from 'fs';
// Must use the require() syntax for modules that export non-module entities.
// See https://github.com/Microsoft/TypeScript/issues/2242#issuecomment-83694181)
import validator = require('is-my-json-valid');
import { forEach } from 'lodash';

// UUIDs are a string of hexidecimal digits separated with hyphens in a
// 8-4-4-4-12 format (.e.g e4e64922-2172-4099-b5b7-80dca6b47159).
const uuid_pattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

/*const gameSchema = {
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
};
const matchSchema = {
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
                [uuid_pattern]: gameSchema
            }
        }
    }
};
const bracketSchema = {
    type: 'object',
    required: ['matches'],
    additionalProperties: true,
    properties: {
        matches: {
            type: 'object',
            // Each property must be a UUID.
            additionalProperties: false,
            patternProperties: {
                [uuid_pattern]: matchSchema
            }
        }
    }
};
const tournamentSchema = {
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
                [uuid_pattern]: bracketSchema
            }
        }
    }
};
const leagueInfoSchema = {
    type: 'object',
    required: ['highlanderTournaments'],
    additionalProperties: true,
    properties: {
        highlanderTournaments: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: tournamentSchema
        }
    },
};

const validateLeagueInfo = validator(leagueInfoSchema);*/

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

interface MatchInfo {
    // TODO: Enforce UUID pattern.
    tournamentId: string;
    matchId: string;
}

interface GameInfo {
    gameId: string;
    gameRealm: string;
    gameHash?: string;
    videoUrl?: string;
    teams?: TeamInfo[];
}

interface TeamInfo {
    name: string;
    logoUrl: string;
}

interface LeagueInfo {
    matches: MatchInfo[];
    games: Map<string, GameInfo>;
}

function parseLeagueInfo(leagueInfo: any): LeagueInfo {
    const games = new Map<string, GameInfo>();
    const matches = new Array<MatchInfo>();
    const league = {
        matches,
        games
    };

    if (validateLeague(leagueInfo) !== true) {
        console.error('Invalid league info', validateLeague.errors);
        return league;
    }

    forEach(leagueInfo.highlanderTournaments, (tournament) => {
        if (validateTournament(tournament) !== true) {
            console.error('Invalid tournament info', validateTournament.errors);
            return;
        }

        const tournamentId = tournament.id;

        forEach(tournament.brackets, (bracket) => {
            if (validateBracket(bracket) !== true) {
                console.error('Invalid bracket info', validateBracket.errors);
                return;
            }

            forEach(bracket.matches, (match) => {
                if (validateMatch(match) !== true) {
                    console.error('Invalid match info', validateMatch.errors);
                    return;
                }

                const matchId = match.id;

                matches.push({
                    tournamentId,
                    matchId
                });

                forEach(match.games, (game, key) => {
                    if (validateGame(game) !== true) {
                        console.error('Invalid game info', validateGame.errors);
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

const leagueInfo = JSON.parse(fs.readFileSync('./na-lcs.json', { encoding: 'utf-8' }));
console.log(parseLeagueInfo(leagueInfo));
