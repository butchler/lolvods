import * as React from 'react';
import { TeamInfo, GameInfo, Options } from './interfaces';

export class AppView extends React.Component<{ games: Array<GameInfo> }, { options: Options }> {
    state = { options: {} };

    render() {
        return <div className="container">
            <h1>Spoiler-free League VODs</h1>

            <OptionsForm onChange={(newOptions) => this.setState({options: newOptions})} options={this.state.options} />

            <GameList games={this.props.games} options={this.state.options} />
        </div>;
    }
}

function OptionsForm(props: { options: Options, onChange: ((options: Options) => void) }) {
    const { options, onChange } = props;

    // TODO: Add filtering and showing/hiding of game info.
    return <div className="options">Options go here.</div>;
}

function GameList(props: { games: Array<GameInfo>, options: Options }) {
    const { games } = props;

    return <div className="game-list">
        <div className="game-list-header">
            <span className="cell">Teams</span>
            <span className="cell">Duration</span>
            <span className="cell">Kills</span>
            <span className="cell">Deaths</span>
            <span className="cell">Assists</span>
            <span className="cell">Gold</span>
        </div>

        {games.map((game) => <GameRow key={game.id} game={game} />)}
    </div>;
}

function GameRow(props: { game: GameInfo }) {
    const { game } = props;

    // Wrap the entire row in a link to the VOD.
    // TODO: Maybe convert URL to non-embedded video.
    // TODO: Detect the user's locale instead of just defaulting to English.
    let linkProps: any;
    const videoLocales = Object.keys(game.videos);
    if (videoLocales.length > 0) {
        const videoUrl = game.videos['en'] || game.videos[videoLocales[0]];
        linkProps = { href: videoUrl, target: '_blank' };
    } else {
        // There should always be a video, but just in case there isn't.
        linkProps = { onClick: onVideoNotFound };
    }

    // TODO: Show date/time for game.
    // TODO: Show link to game stats page.
    return <a className="game" {...linkProps}>
        <span className="cell teams-cell">
            {game.teams.map((team) => <Team key={team.id} team={team} />)}
        </span>

        <span className="cell duration-cell">
            <ClockIcon /><span className="duration">{formatDuration(game.stats.durationSeconds)}</span>
        </span>

        <span className="cell kills-cell">
            <span className="kills">{game.stats.teamStats[0].kills}</span>
            <SwordIcon />
            <span className="kills">{game.stats.teamStats[1].kills}</span>
        </span>

        <span className="cell deaths-cell">
            <span className="deaths">{game.stats.teamStats[0].deaths}</span>
            <SwordIcon />
            <span className="deaths">{game.stats.teamStats[1].deaths}</span>
        </span>

        <span className="cell assists-cell">
            <span className="assists">{game.stats.teamStats[0].assists}</span>
            <SwordIcon />
            <span className="assists">{game.stats.teamStats[1].assists}</span>
        </span>

        <span className="cell gold-cell">
            <span className="gold">{game.stats.teamStats[0].gold}</span>
            <CoinsIcon />
            <span className="gold">{game.stats.teamStats[1].gold}</span>
        </span>
    </a>;
}

function onVideoNotFound() {
    alert("Sorry, we couldn't find the video for this game. =(");
}

function Team(props: { team: TeamInfo }) {
    const { team } = props;

    return <div className="team">
        <img className="team-logo" src={team.thumbnail.url} width={team.thumbnail.width} height={team.thumbnail.height} />
        <span className="team-name">{team.name}</span>
    </div>;
}

// Given a number of seconds, returns a string in MM:SS format.
function formatDuration(secondsElapsed: number) {
    const minutes = Math.floor(secondsElapsed / 60);
    const seconds = secondsElapsed % 60;

    return minutes + ':' + (seconds < 10 ? '0' + seconds : seconds);
}

function ClockIcon() {
    // JSX doesn't currently support the SVG use tag, so we have to create the element without using JSX.
    return <svg className="icon clock-icon">{React.createElement('use', {xlinkHref: '#clock'})}</svg>;
}

function SwordIcon() {
    return <svg className="icon sword-icon">{React.createElement('use', {xlinkHref: '#sword'})}</svg>;
}

function CoinsIcon() {
    return <svg className="icon coins-icon">{React.createElement('use', {xlinkHref: '#coins'})}</svg>;
}
