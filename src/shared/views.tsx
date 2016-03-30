import * as React from 'react';
import { AppProps, AppState, OptionsProps, GameListProps, TeamInfo, GameInfo } from './interfaces';

export class AppView extends React.Component<AppProps,AppState> {
    state = {options: {}};

    render() {
        return <div className="container">
            <h1>Spoiler-free League VODs</h1>

            <Options onChange={(newOptions) => this.setState({options: newOptions})} />

            <GameList games={this.props.games} options={this.state.options} />
        </div>;
    }
}

class Options extends React.Component<OptionsProps, void> {
    render() {
        // TODO: Add filtering and showing/hiding of game info.
        return null;
    }
}

class GameList extends React.Component<GameListProps, void> {
    render() {
        return <div className="game-list">
            <div className="game-list-header">
                <span className="cell">Teams</span>
                <span className="cell">Duration</span>
                <span className="cell">Kills</span>
                <span className="cell">Deaths</span>
                <span className="cell">Assists</span>
                <span className="cell">Gold</span>
            </div>

            {this.props.games.map(renderGameRow)}
        </div>
    }
}

function renderGameRow(game: GameInfo) {
    // TODO: Show date/time for game.
    // TODO: Show link to game stats page.
    const columns = [
        <span className="cell teams-cell">
            {game.teams.map(renderTeam)}
        </span>,

        <span className="cell duration-cell">
            <ClockIcon /><span className="duration">{formatDuration(game.stats.durationSeconds)}</span>
        </span>,

        <span className="cell kills-cell">
            <span className="kills">{game.stats.teamStats[0].kills}</span>
            <SwordIcon />
            <span className="kills">{game.stats.teamStats[1].kills}</span>
        </span>,

        <span className="cell deaths-cell">
            <span className="deaths">{game.stats.teamStats[0].deaths}</span>
            <SwordIcon />
            <span className="deaths">{game.stats.teamStats[1].deaths}</span>
        </span>,

        <span className="cell assists-cell">
            <span className="assists">{game.stats.teamStats[0].assists}</span>
            <SwordIcon />
            <span className="assists">{game.stats.teamStats[1].assists}</span>
        </span>,

        <span className="cell gold-cell">
            <span className="gold">{game.stats.teamStats[0].gold}</span>
            <CoinsIcon />
            <span className="gold">{game.stats.teamStats[1].gold}</span>
        </span>
    ];

    // Wrap the entire row in a link to the VOD.
    // TODO: Convert URL to non-embedded video.
    // TODO: Detect the user's locale instead of just defaulting to English.
    const videoLocales = Object.keys(game.videos);
    if (videoLocales.length > 0) {
        const videoUrl = game.videos['en'] || game.videos[videoLocales[0]];
        return <a className="game" href={videoUrl}>{columns}</a>;
    } else {
        return <div className="game">{columns}</div>;
    }
}

function renderTeam(team: TeamInfo) {
    return <div className="team">
        <img className="team-logo" src={team.logoUrl} />
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
    //return <svg className="icon clock-icon"><use xlinkHref="#clock" /></svg>;
    return <svg className="icon clock-icon">{React.createElement('use', {xlinkHref: '#clock'})}</svg>;
}

function SwordIcon() {
    //return <svg className="icon sword-icon"><use xlinkHref="#sword" /></svg>;
    return <svg className="icon sword-icon">{React.createElement('use', {xlinkHref: '#sword'})}</svg>;
}

function CoinsIcon() {
    //return <svg className="icon coins-icon"><use xlinkHref="#coins" /></svg>;
    return <svg className="icon coins-icon">{React.createElement('use', {xlinkHref: '#coins'})}</svg>;
}
