import { forEach } from './util';
import { validateLeague, validateTournament, validateBracket, validateMatch,
    validateGame, validateMatchDetails, validateGameStats } from './validators';
import { MatchInfo, GameInfo, TeamInfo, GameStats, TeamStats, Dict } from './interfaces';

// Takes the JSON map for a
//
// http://api.lolesports.com/api/v1/leagues?slug=${leagueSlug}
//
// API request, and returns a map of the match UUIDs to MatchInfo for each
// match so far in the league.
export function parseMatchesFromLeague(leagueInfo: any): Dict<MatchInfo> {
    const matches = {} as Dict<MatchInfo>;

    if (validateLeague(leagueInfo) !== true) {
        console.error('Dropping invalid league:', validateLeague.errors);
        return matches;
    }

    forEach(leagueInfo.highlanderTournaments, (tournament) => {
        if (validateTournament(tournament) !== true) {
            console.error('Dropping invalid tournament:', validateTournament.errors);
            return;
        }

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

                if (match.state !== 'resolved') {
                    // TODO: Don't wait until the match is finished before
                    // getting information about its games, because it could be
                    // a best of 5, etc., so it would be better to not have to
                    // wait until all 5 matches are done.
                    console.log('Dropping unfinished match:', match);
                    return;
                }

                const games = {} as Dict<GameInfo>;

                forEach(match.games, (game) => {
                    if (validateGame(game) !== true) {
                        console.error('Dropping invalid game:', validateGame.errors);
                        return;
                    }

                    games[game.id] = {
                        id: game.id,
                        gameId: game.gameId,
                        gameRealm: game.gameRealm
                    };
                });

                matches[match.id] = {
                    id: match.id,
                    tournamentId: tournament.id,
                    timestamp: match.standings.timestamp,
                    games
                };
            });
        });
    });

    return matches;
}

// Takes the JSON map for a
//
// http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${tournamentId}&matchId=${matchId}
//
// API request and returns a map of game UUIDs to GameInfos for each game in
// the match.
export function parseGamesFromMatchDetails(matchDetails: any): Dict<GameInfo> {
    const games = {} as Dict<GameInfo>;

    if (validateMatchDetails(matchDetails) !== true) {
        console.error('Dropping invalid match:', validateMatchDetails.errors);
        return games;
    }

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
        games[game.id] = {
            gameHash: game.gameHash,
            // Videos map locale to video URL.
            videos: {} as Dict<string>,
            teams
        };
    });

    // Extract video URLs.
    forEach(matchDetails.videos, (video) => {
        const game = games[video.game];

        if (game) {
            game.videos[video.locale] = video.source;
        } else {
            console.error('Found video for non-existent game:', video);
        }
    });

    return games;
}

// Takes the JSON map for a
//
// https://acs.leagueoflegends.com/v1/stats/game/${gameRealm}/${gameId}?gameHash=${gameHash}
//
// and returns the stats such as duration, kills, and gold for that game.
export function parseGameStats(gameStats: any): GameStats | void {
    const teams = new Map<number, TeamStats>();

    if (validateGameStats(gameStats) !== true) {
        console.error('Dropping invalid game stats:', validateGameStats.errors);
        return null;
    }

    forEach(gameStats.participants, (participant: any) => {
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

    const teamList = new Array<TeamStats>();
    teams.forEach((team) => teamList.push(team));

    return {
        durationSeconds: gameStats.gameDuration,
        startTime: new Date(gameStats.gameCreation),
        teamStats: teamList
    };
}
