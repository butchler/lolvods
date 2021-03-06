export const
    // The global variable that will be inserted into the HTML so that the
    // client-side code can access to mount the React components with the same
    // initial state as the server-rendered HTML.
    APP_STATE_VARIABLE = 'APP_STATE',
    // Where to store the cached matches.
    CACHED_MATCHES_FILE = __dirname + '/../../public/cached-matches.json',
    // Location of the CSS to be inlined into the HTML.
    CSS_FILE = __dirname + '/../../public/style.css',
    // Location of the SVG icon data to be inlined into the HTML.
    SVG_ICON_FILE = __dirname + '/../../public/icons.svg',
    // A JSON file that contains the filename, width, and height of each thumbnail.
    THUMBNAIL_INFO_FILE = __dirname + '/../../public/thumbnail-info.json',
    // The team logos will be resized and saved in this folder.
    THUMBNAIL_FOLDER_PATH = __dirname + '/../../public/thumbnails',
    // The URL that the thumbnails can be accessed from, relative to index.html.
    THUMBNAILS_URL = 'thumbnails',
    // Thumbnails will be resized to maintain aspect ratio but stay within these bounds.
    THUMBNAIL_MAX_WIDTH = 75, THUMBNAIL_MAX_HEIGHT = 75,
    // The file that the rendered HTML will be saved to.
    OUTPUT_FILE = __dirname + '/../../public/index.html',
    // Get all of the games in the last NUM_DAYS days.
    NUM_DAYS = 14,
    // Only collect games for the given leagues.
    LEAGUES = ['na-lcs', 'eu-lcs'];
