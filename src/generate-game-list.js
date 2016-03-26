"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const fs = require('fs');
const util = require('./util');
const parsers_1 = require('./parsers');
/*const matchHistory = JSON.parse(fs.readFileSync('./match-history.json', { encoding: 'utf-8' }));
console.log(parseGameStats(matchHistory));*/
function fetchGameInfo(matches) {
    return __awaiter(this, void 0, void 0, function* () {
        const promises = new Array();
        for (const id in matches) {
            const match = matches[id];
            const matchDetailsUrl = `http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${match.tournamentId}&matchId=${match.id}`;
            const matchDetailsJson = yield util.fetchUrl(matchDetailsUrl);
            // Defer the updating of the match info so that we can start fetching
            // the next match details while we are updating the current one.
            promises.push(util.defer(() => updateGameInfo(match, matchDetailsJson)));
        }
        yield Promise.all(promises);
    });
}
function updateGameInfo(match, matchDetailsJson) {
    const games = parsers_1.parseGamesFromMatchDetails(JSON.parse(matchDetailsJson));
    for (const id in match.games) {
        const game = match.games[id];
        if (games[id] === undefined) {
            console.error('Dropping game missing from match details:', game);
            delete match.games[id];
            continue;
        }
        const extraGameInfo = games[id];
        game.gameHash = extraGameInfo.gameHash;
        game.teams = extraGameInfo.teams;
        game.videos = extraGameInfo.videos;
    }
}
const CACHED_MATCHES_FILE = './cached-matches.json';
const cachedMatches = JSON.parse(fs.readFileSync(CACHED_MATCHES_FILE, 'utf8'));
const leagueInfo = JSON.parse(fs.readFileSync('./na-lcs.json', { encoding: 'utf-8' }));
const matches = parsers_1.parseMatchesFromLeague(leagueInfo);
const twoWeeksAgo = Date.now() - 1000 * 60 * 60 * 25 * 7 * 2;
const recentMatches = util.filterObject(matches, (match) => match.timestamp > twoWeeksAgo);
const recentCachedMatches = util.filterObject(cachedMatches, (match) => match.timestamp > twoWeeksAgo);
const uncachedMatches = util.filterObject(recentMatches, (_, matchId) => !recentCachedMatches.hasOwnProperty(matchId));
fetchGameInfo(uncachedMatches).then(() => {
    console.log('uncachedMatches', uncachedMatches);
    const newCachedMatches = Object.assign({}, recentCachedMatches, uncachedMatches);
    console.log('newCachedMatches', newCachedMatches);
    fs.writeFileSync(CACHED_MATCHES_FILE, JSON.stringify(newCachedMatches));
});
// Handle any uncaught Promise rejections (in case we forget to add a
// .catch(...) callback).
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection from promise.');
    throw error;
});
