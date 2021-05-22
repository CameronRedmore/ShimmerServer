const fs = require('fs-extra');

const path = require('path');

const sanitise = require('sanitize-filename');

const installDirectory = process.env.PLAYNITE_INSTALL;
const dataDirectory = process.env.PLAYNITE_LIBRARY;

const execFile = require('child_process').execFile;

const name = "Playnite";

const cachedSources = {};

const getAllGames = async () => {
  let gameFiles = await fs.readdir(path.join(dataDirectory, "games"));

  console.log("Found " + gameFiles.length + " games.");

  const games = [];

  for(const gameFile of gameFiles)
  {
    const file = path.join(dataDirectory, "games", gameFile);
    let game = await fs.readJSON(file);

    let source = cachedSources[game.SourceId];

    if(!game.SourceId)
    {
      source = await fs.readJSON(path.join(dataDirectory, "platforms", game.PlatformId + ".json"));
      // source = {Name: "Unknown"}
    }
    else if(!cachedSources[game.SourceId])
    {
      source = await fs.readJSON(path.join(dataDirectory, "sources", game.SourceId + ".json"));
    }

    game = {
      ...game,
      provider: source.Name,
      poster: game.CoverImage ? ("${backend}/getPlayniteImage/" + game.Id + "/" + game.CoverImage.replace(game.Id, "").replace("\\", "")) : "${backend}/noImage",
    };

    games.push(game);
  }


  return games;
};

const getInstalledGames = async () => {
  let games = await getAllGames();

  return games.filter((game) => game.IsInstalled);
}

const runGame = async (id) => {
  console.log("Run game called.");
  const exe = path.join(installDirectory, "Playnite.FullscreenApp.exe");
  const proc = await execFile(exe, ['--start', id]);
};


module.exports = function(app) {
  app.get('/getPlayniteImage/:gameId/:coverId', async (req, res, next) => {
    const escaped = path.join(dataDirectory, "files", sanitise(req.params.gameId), sanitise(req.params.coverId));
    try {
      let access = await fs.access(escaped);
      res.sendFile(escaped);
    }
    catch(ex)
    {
      const image = Buffer.from("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': image.length,
      });
      res.end(image);
    }
  });

  app.get('/noImage', async (req, res, next) => {
    res.sendFile(path.join(__dirname, "noImage.png"));
  });

  app.post('/launchPlaynite/:method', async (req, res, next) => {
    let suffix = '.DesktopApp.exe';
    if(req.params.method == 'fullscreen')
    {
      suffix = '.FullScreenApp.exe';
    }
    const exe = path.join(installDirectory, "Playnite" + suffix);
    const proc = await execFile(exe);

    res.status(200).send();
  });

  return {
    name,
    runGame,
    getAllGames,
    getInstalledGames,
  };
}