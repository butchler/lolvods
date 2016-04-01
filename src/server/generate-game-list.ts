import * as fs from 'fs';
import * as uuid from 'node-uuid';
import * as util from './util';
import * as parse from './parsers';
import { GameInfo, GameStats, MatchInfo, TeamInfo, ThumbnailInfo, Dict } from '../shared/interfaces';
import * as constants from '../shared/constants';
import sharp = require('sharp');

// TODO: Make it do at least some calculations asynchronously instead of everything being synchronous.

export default async function generateGameList(): Promise<Array<GameInfo>> {
    const allMatches = await fetchMatchesForLeagues(constants.LEAGUES);

    // Get list of all games from the updated list of matches.
    const matchList = [...util.values(allMatches)];
    const allGames = Object.assign({}, ...matchList.map((match) => match.games));
    const gameList: Array<GameInfo> = [...util.values(allGames)];

    util.log(`Collected ${gameList.length} games from ${matchList.length} matches.`);

    // Sort the games by most recent start time first.
    gameList.sort((game1, game2) => game2.stats.startTime - game1.stats.startTime);

    return gameList;
}

async function fetchMatchesForLeagues(leagueSlugs: Array<string>): Promise<Dict<MatchInfo>> {
    // Load cached match information.
    // TODO: Validate JSON for cached matches file.
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
        const leagueInfoJson = await util.fetchUrlAsString(leagueInfoUrl);

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

    // Write the updated match info to the cache.
    fs.writeFileSync(constants.CACHED_MATCHES_FILE, JSON.stringify(updatedMatches));

    util.log('Updating logo thumbnails.');

    await updateLogoThumbnails(updatedMatches);

    return updatedMatches;
}

async function updateLogoThumbnails(matches: Dict<MatchInfo>): Promise<void> {
    // Load thumbnail info file.
    // TODO: Validate JSON for thumbnail info file.
    let existingThumbnails = {} as Dict<ThumbnailInfo>;
    try {
        existingThumbnails = JSON.parse(fs.readFileSync(constants.THUMBNAIL_INFO_FILE, 'utf8'));
    } catch (error) {
        util.error(`Error reading thumbnail info file: ${error.message}`);
    }

    // For each team in the list of matches:
    for (let match of util.values(matches)) {
        for (let game of util.values(match.games)) {
            for (let team of util.values(game.teams)) {
                // Make the thumbnails be indexed by all of the properties of the
                // team, so that if any of them change a new thumbnail image will
                // be generated (just in case the logo image has changed as well).
                const thumbnailKey = `${team.id}-${team.name}-${team.acronym}-${team.logoUrl}`;

                if (!existingThumbnails.hasOwnProperty(thumbnailKey)) {
                    // If we don't have a thumbnail for this team's logo already, generate one.
                    existingThumbnails[thumbnailKey] = await generateTeamLogoThumbnail(team);
                }

                // TODO: Maybe use an HTTP HEAD request to check if the logo
                // file has changed since we last generated the thumbnail for
                // it and regenerate it if so.

                team.thumbnail = existingThumbnails[thumbnailKey];
            }
        }
    }

    // Save the updated thumbnail info.
    fs.writeFileSync(constants.THUMBNAIL_INFO_FILE, JSON.stringify(existingThumbnails));

    // TODO: Delete old, unused thumbnails.
}

async function generateTeamLogoThumbnail(team: TeamInfo): Promise<ThumbnailInfo> {
    // If we don't already have a thumbnail image for the given team logo,
    // download it, scale it down, and save it.

    // Generate a random filename to save the thumbnail to.
    // We could just use the team ID or name, but it's possible that the IDs
    // overlap between different regions, and the name could contain invalid
    // characters for a filename, such as '/'.
    const filename = uuid.v4() + '.png';

    // Download the image.
    const logoImage = await util.fetchUrl(team.logoUrl);

    const thumbnailInfo = await sharp(logoImage)
                              .resize(constants.THUMBNAIL_MAX_WIDTH, constants.THUMBNAIL_MAX_HEIGHT)
                              .max()
                              .toFormat('png')
                              .toFile(`${constants.THUMBNAIL_FOLDER_PATH}/${filename}`);

    return { url: `${constants.THUMBNAILS_URL}/${filename}`, width: thumbnailInfo.width, height: thumbnailInfo.height };
}

async function fetchAndUpdateGameInfo(matches: Dict<MatchInfo>) {
    for (let match of util.values(matches)) {
        const matchDetailsUrl = `http://api.lolesports.com/api/v2/highlanderMatchDetails?tournamentId=${match.tournamentId}&matchId=${match.id}`;
        const matchDetailsJson = await util.fetchUrlAsString(matchDetailsUrl);

        updateWithMatchDetails(match, matchDetailsJson);

        // Fetch game stats for each game in the match.
        for (let game of util.values(match.games)) {
            // The game stats URL only works with HTTPS.
            const gameStatsUrl = `https://acs.leagueoflegends.com/v1/stats/game/${game.gameRealm}/${game.gameId}?gameHash=${game.gameHash}`;
            const gameStatsJson = await util.fetchUrlAsString(gameStatsUrl);

            updateWithGameStats(match, game, gameStatsJson);
        }
    }
}

function updateWithMatchDetails(match: MatchInfo, matchDetailsJson: string): void {
    const extraGameInfo = parse.gamesFromMatchDetails(matchDetailsJson);

    for (let game of util.values(match.games)) {
        if (extraGameInfo[game.id] === undefined) {
            util.error(`Dropping game missing from match details: ${JSON.stringify(game)}`);
            delete match.games[game.id];
            continue;
        }

        Object.assign(game, extraGameInfo[game.id]);
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
