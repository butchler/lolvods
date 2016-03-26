import * as fs from 'fs';
import * as util from './util';
import { parseMatchesFromLeague, parseGamesFromMatchDetails, parseGameStats } from './parsers';
import { GameInfo, MatchInfo, Dict } from './interfaces';

/*const matchHistory = JSON.parse(fs.readFileSync('./match-history.json', { encoding: 'utf-8' }));
console.log(parseGameStats(matchHistory));*/

async function fetchGameInfo(matches: Dict<MatchInfo>) {
    const promises = new Array<Promise<void>>();

    for (const id in matches) {
        const match = matches[id];
        const matchDetailsUrl = `http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${match.tournamentId}&matchId=${match.id}`;
        const matchDetailsJson = await util.fetchUrl(matchDetailsUrl);

        // Defer the updating of the match info so that we can start fetching
        // the next match details while we are updating the current one.
        promises.push(util.defer(() => updateGameInfo(match, matchDetailsJson)));
    }

    await Promise.all(promises);
}

function updateGameInfo(match: MatchInfo, matchDetailsJson: string): void {
    const games = parseGamesFromMatchDetails(JSON.parse(matchDetailsJson));

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

const cachedMatches = JSON.parse(fs.readFileSync(CACHED_MATCHES_FILE, 'utf8')) as Dict<MatchInfo>;
const leagueInfo = JSON.parse(fs.readFileSync('./na-lcs.json', { encoding: 'utf-8' }));
const matches = parseMatchesFromLeague(leagueInfo);

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
process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled rejection from promise.');
    throw error;
});
