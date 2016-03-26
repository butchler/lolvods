"use strict";
const lodash_1 = require('lodash');
const validators_1 = require('./validators');
// Takes the JSON map for a
//
// http://api.lolesports.com/api/v1/leagues?slug=${leagueSlug}
//
// API request, and returns a map of the match UUIDs to MatchInfo for each
// match so far in the league.
function parseMatchesFromLeague(leagueInfo) {
    const matches = {};
    if (validators_1.validateLeague(leagueInfo) !== true) {
        console.error('Dropping invalid league:', validators_1.validateLeague.errors);
        return matches;
    }
    lodash_1.forEach(leagueInfo.highlanderTournaments, (tournament) => {
        if (validators_1.validateTournament(tournament) !== true) {
            console.error('Dropping invalid tournament:', validators_1.validateTournament.errors);
            return;
        }
        lodash_1.forEach(tournament.brackets, (bracket) => {
            if (validators_1.validateBracket(bracket) !== true) {
                console.error('Dropping invalid bracket:', validators_1.validateBracket.errors);
                return;
            }
            lodash_1.forEach(bracket.matches, (match) => {
                if (validators_1.validateMatch(match) !== true) {
                    console.error('Dropping invalid match:', validators_1.validateMatch.errors);
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
                const games = {};
                lodash_1.forEach(match.games, (game) => {
                    if (validators_1.validateGame(game) !== true) {
                        console.error('Dropping invalid game:', validators_1.validateGame.errors);
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
                    games: games
                };
            });
        });
    });
    return matches;
}
exports.parseMatchesFromLeague = parseMatchesFromLeague;
// Takes the JSON map for a
//
// http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${tournamentId}&matchId=${matchId}
//
// API request and returns a map of game UUIDs to GameInfos for each game in
// the match.
function parseGamesFromMatchDetails(matchDetails) {
    const games = {};
    if (validators_1.validateMatchDetails(matchDetails) !== true) {
        console.error('Dropping invalid match:', validators_1.validateMatchDetails.errors);
        return games;
    }
    // Extract team info, which will be the same for each game.
    const teams = new Array();
    lodash_1.forEach(matchDetails.teams, (team) => {
        teams.push({
            acronym: team.acronym,
            name: team.name,
            logoUrl: team.logoUrl
        });
    });
    // Extract gameHash.
    lodash_1.forEach(matchDetails.gameIdMappings, (game) => {
        games[game.id] = {
            gameHash: game.gameHash,
            // Videos map locale to video URL.
            videos: {},
            teams: teams
        };
    });
    // Extract video URLs.
    lodash_1.forEach(matchDetails.videos, (video) => {
        const game = games[video.game];
        if (game) {
            game.videos[video.locale] = video.source;
        }
        else {
            console.error('Found video for non-existent game:', video);
        }
    });
    return games;
}
exports.parseGamesFromMatchDetails = parseGamesFromMatchDetails;
// Takes the JSON map for a
//
// https://acs.leagueoflegends.com/v1/stats/game/${gameRealm}/${gameId}?gameHash=${gameHash}
//
// and returns the stats such as duration, kills, and gold for that game.
function parseGameStats(gameStats) {
    const teams = new Map();
    if (validators_1.validateGameStats(gameStats) !== true) {
        console.error('Dropping invalid game stats:', validators_1.validateGameStats.errors);
        return null;
    }
    lodash_1.forEach(gameStats.participants, (participant) => {
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
    const teamList = new Array();
    teams.forEach((team) => teamList.push(team));
    return {
        durationSeconds: gameStats.gameDuration,
        startTime: new Date(gameStats.gameCreation),
        teamStats: teamList
    };
}
exports.parseGameStats = parseGameStats;
