import * as fs from 'fs';
import * as util from './util';
import * as parse from './parsers';
import { GameInfo, GameStats, MatchInfo, Dict } from '../shared/interfaces';
import * as constants from '../shared/constants';

export default async function generateGameList(): Promise<Array<GameInfo>> {
    const allMatches = await fetchMatchesForLeagues(constants.LEAGUES);

    // Get list of all games from the updated list of matches.
    const matchList = [...util.values(allMatches)];
    const allGames = Object.assign({}, ...matchList.map((match) => match.games));
    const gameList: Array<GameInfo> = [...util.values(allGames)];

    util.log(`Collected ${gameList.length} games from ${matchList.length} matches.`);

    // Sort the games by most recent start time first.
    gameList.sort((game1, game2) => game2.stats.startTime.valueOf() - game1.stats.startTime.valueOf());

    return gameList;
}

async function fetchMatchesForLeagues(leagueSlugs: Array<string>): Promise<Dict<MatchInfo>> {
    // Load cached match information.
    let cachedMatches: Dict<MatchInfo> = {};
    try {
        util.log('Reading match cache.');
        cachedMatches = JSON.parse(fs.readFileSync(constants.CACHED_MATCHES_FILE, 'utf8')) as Dict<MatchInfo>;
    } catch (error) {
        util.error(`Error reading cached matches file: ${error.message}`);
    }

    util.log(`Fetching matches for leagues ${JSON.stringify(leagueSlugs)}.`);

    // Fetch match info for all leagues.
    const allMatches: Dict<MatchInfo> = {};
    for (let leagueSlug of leagueSlugs) {
        const leagueInfoUrl = `http://api.lolesports.com/api/v1/leagues?slug=${leagueSlug}`;
        const leagueInfoJson = await util.fetchUrl(leagueInfoUrl);

        const matches = parse.matchesFromLeague(leagueInfoJson);

        Object.assign(allMatches, matches);
    }

    util.log(`Filtering ${Object.keys(allMatches).length} matches by timestamp.`);

    // Filter to most recent matches.
    const startTimestamp = Date.now() - 1000 * 60 * 60 * 24 * constants.NUM_DAYS;
    const recentMatches = util.filterObject(allMatches, (match) => match.timestamp > startTimestamp);
    const recentCachedMatches = util.filterObject(cachedMatches, (match) => match.timestamp > startTimestamp);

    // Find all of the matches in the league that are not in the cache.
    const uncachedMatches = util.filterObject(recentMatches, (_, matchId) => !recentCachedMatches.hasOwnProperty(matchId));

    util.log(`Getting info for ${Object.keys(uncachedMatches).length} uncached matches.`);

    // Get all of the game information and stats for each of the uncached matches.
    await fetchAndUpdateGameInfo(uncachedMatches);
    const updatedMatches = Object.assign({}, recentCachedMatches, uncachedMatches);

    util.log('Writing match cache.');

    // Write the updated matche info to the cache.
    fs.writeFileSync(constants.CACHED_MATCHES_FILE, JSON.stringify(updatedMatches));

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
    const games = parse.gamesFromMatchDetails(matchDetailsJson);

    for (let game of util.values(match.games)) {
        if (games[game.id] === undefined) {
            util.error(`Dropping game missing from match details: ${JSON.stringify(game)}`);
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
    const gameStats = parse.gameStats(gameStatsJson);

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
