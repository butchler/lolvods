export const
    // The global variable that will be inserted into the HTML so that the
    // client-side code can access to mount the React components with the same
    // initial state as the server-rendered HTML.
    APP_STATE_VARIABLE = 'APP_STATE',
    // Where to store the cached matches.
    CACHED_MATCHES_FILE = __dirname + '/../../public/cached-matches.json',
    // Location of the CSS to be inlined into the HTML.
    CSS_FILE = __dirname + '/../../public/style.css',
    // The file that the rendered HTML will be saved to.
    OUTPUT_FILE = __dirname + '/../../public/index.html',
    // Get all of the games in the last NUM_DAYS days.
    NUM_DAYS = 14,
    // Only collect games for the given leagues.
    LEAGUES = ['na-lcs', 'eu-lcs'];
