// Must use the require() syntax for modules that export non-module entities.
// See https://github.com/Microsoft/TypeScript/issues/2242#issuecomment-83694181)
import validator = require('is-my-json-valid');

// UUIDs are a string of hexidecimal digits separated with hyphens in a
// 8-4-4-4-12 format (.e.g e4e64922-2172-4099-b5b7-80dca6b47159).
const uuid_pattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

export const game = validator({
    type: 'object',
    required: ['gameId', 'gameRealm'],
    additionalProperties: true,
    properties: {
        id: {
            type: 'string',
            pattern: uuid_pattern
        },
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
export const match = validator({
    type: 'object',
    required: ['id', 'games', 'standings', 'state'],
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
        },
        standings: {
            type: 'object',
            required: ['timestamp'],
            additionalProperties: true,
            properties: {
                timestamp: { type: 'number' }
            }
        },
        state: {
            type: 'string'
        }
    }
});
export const bracket = validator({
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
export const tournament = validator({
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
export const league = validator({
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

export const matchDetails = validator({
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
            maxItems: 2,
            uniqueItems: true,
            items: {
                type: 'object',
                required: ['id', 'acronym', 'name', 'logoUrl'],
                additionalProperties: true,
                properties: {
                    id: { type: 'number' },
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

export const gameStats = validator({
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
