const url = require('url');

const express = require('express');
const app = express();

const config = require('./config');

const steam = require('./adapters/steam');
const adapters = {};
adapters[steam.name] = steam;

let games = [];

var glob = require( 'glob' ), path = require( 'path' );
const { isRegExp } = require('util');

let refreshAdapters = async () => {
    games = [];
    return await Object.keys(adapters).map(async (name) =>
    {
        let adapter = adapters[name];
        let adapterGames = await adapter.getAllGames();
        adapterGames.forEach((game) => {
            games.push(game);
        });
    });
}

// Add in CORS handler.
app.use(function(request, response, next)
{
    //Find the referrer or origin.
    let refer = url.parse(request.header('Referer') || request.header("Origin") || "http://localhost:80");
    //Add headers allowing the referrer.
    response.header("Access-Control-Allow-Origin", refer.protocol + "//" + refer.hostname + (refer.port ? (":" + refer.port) : ""));
    response.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
    response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, PATCH");
    response.header("Access-Control-Allow-Credentials", "true");

    //If an OPTIONS request has been sent, return status 200.
    if (request.method === "OPTIONS")
    {
        response.sendStatus(200);
    }
    //Not an OPTIONS request, pass through the rest of the stack.
    else
    {
        next();
    }
});

app.use(express.json());

app.get('/games', async (req, res, next) => {
    await new Promise((resolve, reject) => {
        let interval = setInterval(() => {
            if(games.length > 0)
            {
                resolve();
                clearInterval(interval);
            }
        }, 500);
    });
    res.status(200).json(games);
});

app.post('/launch', async (req, res, next) => {
    let game = req.body;

    adapters[game.provider].runGame(game.id);

    res.json({
        status: 200,
        message: game.installed ? 'Game Launched!' : 'Game installing. You will be redirected to Moonlight where you will likely need to complete the installation.'
    })
});

app.post('/refresh', async (req, res, next) => {
    await refreshAdapters();
    res.status(200).json(games);
})

app.listen(config.Port, async () => {
    console.log("Refreshing Games Lists");
    await refreshAdapters();
    console.log("Game Server Running!");

    setInterval(refreshAdapters, 1000 * 60 * 15);
});