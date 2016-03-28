import * as React from 'react';
import { AppProps, AppState, OptionsProps, GameListProps } from './interfaces';


export class AppView extends React.Component<AppProps,AppState> {
    state = {options: {}};

    render() {
        return <div className="container">
            <Options onChange={(newOptions) => this.setState({options: newOptions})} />

            <GameList games={this.props.games} options={this.state.options} />
        </div>;
    }
}

class Options extends React.Component<OptionsProps, void> {
    render() {
        return <h1>Options</h1>;
    }
}

class GameList extends React.Component<GameListProps, void> {
    render() {
        return <h1>Game List</h1>;
    }
}
