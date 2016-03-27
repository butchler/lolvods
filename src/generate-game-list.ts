import * as fs from 'fs';
import * as util from './util';
import { parseMatchesFromLeague, parseGamesFromMatchDetails, parseGameStats } from './parsers';
import { GameInfo, GameStats, MatchInfo, Dict } from './interfaces';

const CACHED_MATCHES_FILE = './cached-matches.json',
    GAME_LIST_FILE = './games.json',
    // Get all of the games in the last NUM_DAYS days.
    NUM_DAYS = 7,
    // Only collect games for the given leagues.
    LEAGUES = ['na-lcs', 'eu-lcs'];

main();

async function main() {
    // Handle any uncaught Promise rejections (in case we forget to add a
    // .catch(...) callback).
    process.on('unhandledRejection', (error: any) => {
        console.error('Unhandled rejection from promise.');
        throw error;
    });

    const matches = await fetchMatchesForLeagues(LEAGUES);

    // Get list of all games from the updated list of matches.
    const matchList = [...util.values(matches)];
    const allGames = Object.assign({}, ...matchList.map((match) => match.games));
    const gameList: Array<GameInfo> = [...util.values(allGames)];

    // Sort the games by most recent start time first.
    gameList.sort((game1, game2) => game2.stats.startTime.valueOf() - game1.stats.startTime.valueOf());

    // Write the list of games to a file.
    try {
        fs.writeFileSync(GAME_LIST_FILE, JSON.stringify(gameList));
    } catch (error) {
        console.error('Error writing game list file:', error);
    }
}

async function fetchMatchesForLeagues(leagueSlugs: Array<string>): Promise<Dict<MatchInfo>> {
    // Load cached match information.
    let cachedMatches: Dict<MatchInfo> = {};
    try {
        cachedMatches = JSON.parse(fs.readFileSync(CACHED_MATCHES_FILE, 'utf8')) as Dict<MatchInfo>;
    } catch (error) {
        console.error('Error reading cached matches file:', error);
    }

    // Fetch matche info for all leagues.
    const allMatches: Dict<MatchInfo> = {};
    for (let leagueSlug of leagueSlugs) {
        const leagueInfoUrl = `http://api.lolesports.com/api/v1/leagues?slug=${leagueSlug}`;
        const leagueInfoJson = await util.fetchUrl(leagueInfoUrl);

        const matches = parseMatchesFromLeague(leagueInfoJson);

        Object.assign(allMatches, matches);
    }

    // Filter to most recent matches.
    const startTimestamp = Date.now() - 1000 * 60 * 60 * 24 * NUM_DAYS;
    const recentMatches = util.filterObject(allMatches, (match) => match.timestamp > startTimestamp);
    const recentCachedMatches = util.filterObject(cachedMatches, (match) => match.timestamp > startTimestamp);

    // Find all of the matches in the league that are not in the cache.
    const uncachedMatches = util.filterObject(recentMatches, (_, matchId) => !recentCachedMatches.hasOwnProperty(matchId));

    // Get all of the game information and stats for each of the uncached matches.
    await fetchAndUpdateGameInfo(uncachedMatches);
    const updatedMatches = Object.assign({}, recentCachedMatches, uncachedMatches);

    // Write the updated matche info to the cache.
    try {
        fs.writeFileSync(CACHED_MATCHES_FILE, JSON.stringify(updatedMatches));
    } catch (error) {
        console.error('Error writing cached matches file:', error);
    }

    return updatedMatches;
}

async function fetchAndUpdateGameInfo(matches: Dict<MatchInfo>) {
    for (let match of util.values(matches)) {
        const matchDetailsUrl = `http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${match.tournamentId}&matchId=${match.id}`;
        const matchDetailsJson = await util.fetchUrl(matchDetailsUrl);

        updateWithMatchDetails(match, matchDetailsJson);

        // Fetch game stats for each game in the match.
        for (let game of util.values(match.games)) {
            // The game stats URL only works with HTTPS.
            const gameStatsUrl = `https://acs.leagueoflegends.com/v1/stats/game/${game.gameRealm}/${game.gameId}?gameHash=${game.gameHash}`;
            const gameStatsJson = await util.fetchUrl(gameStatsUrl);

            updateWithGameStats(match, game, gameStatsJson);
        }
    }
}

function updateWithMatchDetails(match: MatchInfo, matchDetailsJson: string): void {
    const games = parseGamesFromMatchDetails(matchDetailsJson);

    for (let game of util.values(match.games)) {
        if (games[game.id] === undefined) {
            console.error('Dropping game missing from match details:', game);
            delete match.games[game.id];
            continue;
        }

        const extraGameInfo = games[game.id];
        game.gameHash = extraGameInfo.gameHash;
        game.teams = extraGameInfo.teams;
        game.videos = extraGameInfo.videos;
    }
}

function updateWithGameStats(match: MatchInfo, game: GameInfo, gameStatsJson: string): void {
    const gameStats = parseGameStats(gameStatsJson);

    if (!gameStats) {
        // Remove the game if we can't get its stats.
        delete match.games[game.id];
    } else {
        game.stats = gameStats as GameStats;
    }

    // Randomly swap the order of the teams, so that you can't tell
    // which team is associated with which stats.
    if (Math.random() < 0.5) {
        let team1 = game.stats.teamStats[0], team2 = game.stats.teamStats[1];
        game.stats.teamStats = [team2, team1];
    }
}
