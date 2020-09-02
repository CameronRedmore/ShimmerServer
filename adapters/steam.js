const fs = require("fs");
const path = require("path");
const config = require("../config");
const os = require("os");

const VDF = require("@node-steam/vdf");

const axios = require("axios");
const { promises } = require("dns");
const exec = require('child_process').exec;

const name = "Steam";

let queue = [];
let callbacks = {};

let cache;
try
{
    let cacheFile = fs.readFileSync(path.join(path.dirname(os.tmpdir()), config.SteamCacheFile));
    console.log(path.join(path.dirname(os.tmpdir()), config.SteamCacheFile));
    cache = JSON.parse(cacheFile.toString("UTF8"));
}
catch(ex)
{
    cache = {};
}

let installedGames = [];

const getAllGames = async () => {
    installedGames = await getInstalledGames();
    // let userDataFolder = path.join(config.SteamDirectory, "/userdata");
    // if(!config.SteamUser)
    // {
    //     await new Promise((resolve, reject) => {
    //         fs.readdir(userDataFolder, (err, files) => {
    //             if(files.filter((name) => (name != "0")).length == 1)
    //             {
    //                 files.forEach((file) => {
    //                     if(file != "0")
    //                     {
    //                         console.log("Steam UserID " + file);
    //                         config.SteamUser = file;
    //                         resolve();
    //                     }
    //                 })
    //             }
    //             else
    //             {
    //                 reject("Multiple userdata directories! Unable to choose one to use!");
    //             }
    //         });
    //     });
    // }
    // let profileDirectory = path.join(userDataFolder, config.SteamUser);

    // let libraryCache = path.join(profileDirectory, "/config/libraryCache");

    // let games = [];

    // await new Promise((resolve, reject) => {
    //     fs.readdir(libraryCache, async (err, files) => {
    //         if(err)
    //         {
    //             reject(err);
    //         }
    //         else
    //         {
    //             await Promise.all(files.map(async (file, i) => {
    //                 let id = file.replace('.json', '');
    //                 let game = await getAppDetails(id, i, files.length);
    //                 if(!game.status || game.status != 2)
    //                 games.push(game);
    //             }));
    //             resolve();
    //         }
    //     });
    // });
    
    let assets = path.join(config.SteamDirectory, "/appcache/librarycache/assets.vdf");
    let assetsBuffer = await new Promise((resolve, reject) => {
        fs.readFile(assets, (err, data) => {
            if(err)
            {
                reject(err);
            }
            else
            {
                resolve(data);
            }
        });
    });

    let vdf = assetsBuffer.toString('utf8');

    vdf = vdf.replace("\"\"", "0");

    let json = VDF.parse(vdf);

    let ids = Object.keys(json[0][0]);

    //Filter out none games
    ids = ids.filter((item) => {
        return json[0][0][item]['0'] && json[0][0][item]['icon'];
    });

    console.log(ids.length);

    let games = [];

    await Promise.all(ids.map(async (id,i) => {
        let game = await getAppDetails(id, i,ids.length);
        if(!game.status || game.status != 2)
        {
            games.push(game);
        }
    }));

    return games;
}

const getInstalledGames = async () => {

    let steamAppsFolder = path.join(config.SteamDirectory, "/steamapps");
    let folders = [steamAppsFolder];

    let library = path.join(steamAppsFolder, "/libraryfolders.vdf");

    let libraryBuffer = await new Promise((resolve, reject) => {
        fs.readFile(library, (err, data) => {
            if(err)
            {
                reject(err);
            }
            else
            {
                resolve(data);
            }
        });
    });

    let vdf = libraryBuffer.toString('utf8');

    let libraries = VDF.parse(vdf).LibraryFolders;

    delete libraries.TimeNextStatsReport;
    delete libraries.ContentStatsID;

    Object.keys(libraries).forEach((key) => {
        let folder = libraries[key];

        folders.push(path.join(folder, "/steamapps"));
    });

    let gamesArrays = await Promise.all(folders.map(async (folder) => {
        return await new Promise((resolve, reject) =>
        {
            let games = [];
            fs.readdir(folder, (err, files) => {
                if(err || !files)
                {
                    resolve([]);
                }
                let regex = /appmanifest_(\d+)\.acf/;
                files.forEach((file) => {
                    let matches = regex.exec(file);
                    if(matches)
                    {
                        games.push(matches[1]);
                    }
                });
                resolve(games);
            });
        });
    }));

    let games = [];
    gamesArrays.forEach((array) => {
        array.forEach((game) => {
            games.push(game);
        })
    });

    console.log(games, games.length);

    return games;
};

const getAppDetails = async (id, index, total) =>
{
    if(cache[id])
    {
        console.log("Returning App ID " + id + " from cache.")
        return cache[id];
    }
    return new Promise((resolve, reject) => {
        queue.push(id);
        callbacks[id] = resolve;
    });
}

const runGame = (appId) =>
{
    exec(`explorer.exe steam://rungameid/${appId}`);
}

const addToCache = async (id, game) => {
    return new Promise((resolve, reject) => {
        cache[id] = game;
    
        fs.writeFile(path.join(path.dirname(os.tmpdir()), config.SteamCacheFile), JSON.stringify(cache), resolve);
        console.log(path.join(path.dirname(os.tmpdir()), config.SteamCacheFile));
    });
}

setInterval(async () => {
    if(queue.length)
    {
        let id = queue.shift();
        
        let response = await axios.get(`https://store.steampowered.com/api/libraryappdetails/?appid=${id}`);
        let json = await response.data;
        console.log(json)
        if(json.name)
        {
            let game = {
                id,
                name: json.name,
                poster: `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg?t=${Date.now()}`,
                installed: installedGames.includes(id),
                provider: name,
            };
            addToCache(id, game);
            callbacks[id](game);
            delete callbacks[id];
        }
        else
        {
            addToCache(id, {id, status: 2});
            callbacks[id]({id, status: 2});
            delete callbacks[id];
        }

        console.log(queue.length + " item" + (queue.length == 1 ? '' : 's') + " remain" + (queue.length == 1 ? 's' : '') + " in the queue.");
    }
}, config.QueueInterval);

module.exports = {
    name,
    runGame,
    getAllGames,
    getInstalledGames,
}