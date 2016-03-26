import * as fs from 'fs';
import * as util from './util';
import { parseMatchesFromLeague, parseGamesFromMatchDetails, parseGameStats } from './parsers';
import { GameInfo, MatchInfo, Dict } from './interfaces';

function defer(deferredFunction: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            deferredFunction();
            resolve();
        }, 0);
    });
}

async function fetchGameInfo(matches: Dict<MatchInfo>) {
    const promises = new Array<Promise<void>>();

    for (const id in matches) {
        const match = matches[id];
        const matchDetailsUrl = `http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${match.tournamentId}&matchId=${match.id}`;
        const matchDetailsJson = await util.fetchUrl(matchDetailsUrl);

        // Defer the updating of the match info so that we can start fetching
        // the next match details while we are updating the current one.
        promises.push(defer(() => updateGameInfo(match, matchDetailsJson)));

        // TODO: Fetch game stats.
    }

    await Promise.all(promises);
}

// Alternative version that makes up to 2 concurrent HTTP requests at a time.
/*async function fetchGameInfo(matches: Dict<MatchInfo>) {
    const bottleneck = createBottleneck(2);

    for (const id in matches) {
        const match = matches[id];
        const matchDetailsUrl = `http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${match.tournamentId}&matchId=${match.id}`;

        await bottleneck.add(async function () {
            const matchDetailsJson = await util.fetchUrl(matchDetailsUrl);
            updateGameInfo(match, matchDetailsJson);
        });
    }

    await bottleneck.allDone();
}

interface Bottleneck {
    add: (asyncFunction: () => Promise<any>) => Promise<void>;
    allDone: () => Promise<any>;
}
function createBottleneck(maxConcurrent: number, onError?: (error: Error) => void): Bottleneck {
    const promises = new Array<Promise<any>>();

    async function add(asyncFunction: () => Promise<any>): Promise<void> {
        while (promises.length >= maxConcurrent) {
            const promiseIndex = await Promise.race(promises.map((promise, index) => {
                return new Promise<number>((resolve, reject) => {
                    promise.then(() => {
                        resolve(index);
                    }).catch((error) => {
                        if (onError) {
                            onError(error);
                        } else {
                            throw error;
                        }
                    });
                });
            }));

            // Remove the first promise that finishes.
            promises.splice(promiseIndex, 1);
        }

        const promise = asyncFunction();
        promises.push(promise);
    }

    function allDone(): Promise<any> {
        return Promise.all(promises);
    }

    return {
        add,
        allDone
    };
}*/

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

// Load cached match information.
const CACHED_MATCHES_FILE = './cached-matches.json';
let cachedMatches: Dict<MatchInfo> = {};
try {
    cachedMatches = JSON.parse(fs.readFileSync(CACHED_MATCHES_FILE, 'utf8')) as Dict<MatchInfo>;
} catch (error) {
    console.error('Error reading cached matches file:', error);
}

// Get all of the matches for the given league.
const leagueInfo = JSON.parse(fs.readFileSync('./na-lcs.json', { encoding: 'utf-8' }));
const matches = parseMatchesFromLeague(leagueInfo);

// Filter out all but the most recent matches.
//const twoWeeksAgo = Date.now() - 1000 * 60 * 60 * 24 * 7 * 2;
const twoWeeksAgo = Date.now() - 1000 * 60 * 60 * 24 * 7 * 1;
const recentMatches = util.filterObject(matches, (match) => match.timestamp > twoWeeksAgo);

// Find all of the matches in the league that are not in the cache.
let uncachedMatches = util.filterObject(recentMatches, (_, matchId) => !cachedMatches.hasOwnProperty(matchId));

// Get all of the game information and stats for each of the matches.
fetchGameInfo(uncachedMatches).then(() => {
    console.log('uncachedMatches', uncachedMatches);

    // Write all of the recent matches to the cache.
    const allMatches = Object.assign({}, cachedMatches, uncachedMatches);
    const newCachedMatches = util.filterObject(allMatches, (match) => match.timestamp > twoWeeksAgo);

    console.log('newCachedMatches', newCachedMatches);

    try {
        fs.writeFileSync(CACHED_MATCHES_FILE, JSON.stringify(newCachedMatches));
    } catch (error) {
        console.error('Error writing cached matches file:', error);
    }
});

// Handle any uncaught Promise rejections (in case we forget to add a
// .catch(...) callback).
process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled rejection from promise.');
    throw error;
});
