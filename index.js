const url = require('url');

const audio = require('./audio');

const express = require('express');
const app = express();

require('dotenv').config();

console.log(process.env);

const playnite = require('./adapters/playnite')(app);
const adapters = {};
adapters[playnite.name] = playnite;

let games = [];

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

app.use(async (req, res, next) => {
    console.log(req.headers.authorization, process.env.PASSWORD)
    if(!req.headers.authorization)
    {
        return res.status(401).send();
    }
    if(req.headers.authorization == process.env.PASSWORD)
    {
        next();
    }
    else
    {
        return res.status(401).send();
    }
});

app.use(express.json());

app.get('/authenticate', async (req, res, next) => {
    audio.authenticateIp(req.ip);

    res.status(200).send();
});

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

    adapters['Playnite'].runGame(game.Id);

    res.json({
        status: 200,
        message: game.IsInstalled ? 'Game Launched!' : 'Game installing. You will be redirected to Moonlight where you will likely need to complete the installation.'
    })
});

app.post('/refresh', async (req, res, next) => {
    await refreshAdapters();
    res.status(200).json(games);
})


const natUpnp = require('nat-upnp');

const client = natUpnp.createClient();

client.portMapping({
    public: 2606,
    private: 2606,
    ttl: 1
}, function(error) {
    if(error)
    {
        console.error("Could not automatically forward port!");
    }

    app.listen(2606, async () => {
        console.log("Refreshing Games Lists");
        await refreshAdapters();
        console.log("Game Server Running!");
    
        setInterval(refreshAdapters, 1000 * 60 * 15);
    });
});