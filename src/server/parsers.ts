import { values, log, error } from './util';
import { MatchInfo, GameInfo, TeamInfo, GameStats, TeamStats, Dict } from '../shared/interfaces';
import * as validate from './validators';

// TODO: Store the JSON schemas as plain objects and generate the
// validators/filters here instead of in validators.ts.

// Takes the JSON map for a
//
// http://api.lolesports.com/api/v1/leagues?slug=${leagueSlug}
//
// API request, and returns a map of the match UUIDs to MatchInfo for each
// match so far in the league.
export function matchesFromLeague(leagueInfoJson: string): Dict<MatchInfo> {
    const leagueInfo = JSON.parse(leagueInfoJson);

    const matches = {} as Dict<MatchInfo>;

    if (validate.league(leagueInfo) !== true) {
        error(`Dropping invalid league: ${JSON.stringify(validate.league.errors)}`);
        return matches;
    }

    for (let tournament of values(leagueInfo.highlanderTournaments)) {
        if (validate.tournament(tournament) !== true) {
            error(`Dropping invalid tournament: ${JSON.stringify(validate.tournament.errors)}`);
            break;
        }

        for (let bracket of values(tournament.brackets)) {
            if (validate.bracket(bracket) !== true) {
                error(`Dropping invalid bracket: ${JSON.stringify(validate.bracket.errors)}`);
                break;
            }

            for (let match of values(bracket.matches)) {
                if (validate.match(match) !== true) {
                    error(`Dropping invalid match: ${JSON.stringify(validate.match.errors)}`);
                    break;
                }

                if (match.state !== 'resolved') {
                    // TODO: Don't wait until the match is finished before
                    // getting information about its games, because it could be
                    // a best of 5, etc., so it would be better to not have to
                    // wait until all 5 matches are done.
                    log(`Dropping unfinished match: ${JSON.stringify(match)}`);
                    break;
                }

                const games = {} as Dict<GameInfo>;

                for (let game of values(match.games)) {
                    if (validate.game(game) !== true) {
                        error(`Dropping invalid game: ${JSON.stringify(validate.game.errors)}`);
                        break;
                    }

                    games[game.id] = {
                        id: game.id,
                        gameId: game.gameId,
                        gameRealm: game.gameRealm
                    };
                }

                matches[match.id] = {
                    id: match.id,
                    tournamentId: tournament.id,
                    timestamp: match.standings.timestamp,
                    games
                };
            }
        }
    }

    return matches;
}

// Takes the JSON map for a
//
// http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${tournamentId}&matchId=${matchId}
//
// API request and returns a map of game UUIDs to GameInfos for each game in
// the match.
export function gamesFromMatchDetails(matchDetailsJson: string): Dict<GameInfo> {
    const matchDetails = JSON.parse(matchDetailsJson);

    const games = {} as Dict<GameInfo>;

    if (validate.matchDetails(matchDetails) !== true) {
        error(`Dropping invalid match: ${JSON.stringify(validate.matchDetails.errors)}`);
        return games;
    }

    // Extract team info, which will be the same for each game.
    const teams = new Array<TeamInfo>();
    for (let team of values(matchDetails.teams)) {
        teams.push({
            id: team.id,
            acronym: team.acronym,
            name: team.name,
            logoUrl: team.logoUrl
        });
    }

    // Extract gameHash.
    for (let game of values(matchDetails.gameIdMappings)) {
        games[game.id] = {
            gameHash: game.gameHash,
            // Videos map locale to video URL.
            videos: {} as Dict<string>,
            teams
        };
    }

    // Extract video URLs.
    for (let video of values(matchDetails.videos)) {
        const game = games[video.game];

        if (game) {
            game.videos[video.locale] = video.source;
        } else {
            error(`Found video for non-existent game: ${JSON.stringify(video)}`);
        }
    }

    return games;
}

// Takes the JSON map for a
//
// https://acs.leagueoflegends.com/v1/stats/game/${gameRealm}/${gameId}?gameHash=${gameHash}
//
// and returns the stats such as duration, kills, and gold for that game.
export function gameStats(gameStatsJson: string): GameStats | void {
    const gameStats = JSON.parse(gameStatsJson);

    const teams = new Map<number, TeamStats>();

    if (validate.gameStats(gameStats) !== true) {
        error(`Dropping invalid game stats: ${JSON.stringify(validate.gameStats.errors)}`);
        return null;
    }

    for (let participant of values(gameStats.participants)) {
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
    }

    const teamList = new Array<TeamStats>();
    teams.forEach((team) => teamList.push(team));

    return {
        durationSeconds: gameStats.gameDuration,
        startTime: new Date(gameStats.gameCreation),
        teamStats: teamList
    };
}
