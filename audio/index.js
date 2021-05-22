const dgram = require("dgram");
const Speaker = require("speaker");
const naudiodon = require("naudiodon");
const vban = require("./vban");

const server = dgram.createSocket("udp4");

let currentConfig = {};

let speaker = null;

const natUpnp = require('nat-upnp');

const client = natUpnp.createClient();

const whitelist = [];

client.portMapping({
  public: 6980,
  private: 6980,
  ttl: 1
}, function (error) {
  if (error) {
    console.error("Could not automatically forward port!");
  }

  let cable = naudiodon.getDevices().find((item) => {
    return item.name.includes("CABLE Input") && item.hostAPIName == ("Windows WASAPI");
  });

  console.log(cable);

  if (!cable) {
    console.log("Could not find VB-Cable! Exiting.");
    process.exit(1);
  }

  let device = cable.name.substring(0, 31);

  console.log("Using device:", cable, device);

  server.on("error", (err) => {
    console.log(`Server error:\n${err.stack}`);
    server.close();
    process.exit(1);
  });

  server.on("message", (msg, rinfo) => {
    if (!whitelist.includes(rinfo.address)) {
      return;
    }
    const data = vban.processPacket(msg);
    let configMatch = true;
    Object.keys(currentConfig).forEach((element) => {
      if (element === "frameCounter") return;
      configMatch = configMatch &&
        currentConfig[element] === data.header[element];
    });

    if (!speaker || !configMatch) {
      let config = { ...headerToSpeakerConfig(data.header), device };
      speaker = new Speaker(config);
      currentConfig = data.header;
    }

    // Check for audio frame
    if (data.header.sp == 0) {
      // Output audio
      speaker.write(data.audio);
    }
  });

  server.on("listening", () => {
    const address = server.address();
    console.log(`Server listening ${address.address}:${address.port}`);
  });

  server.bind(6980);

  /**
   * Convert VBAN Header to node-speaker config
   * @param {Object} header
   * @return {Object}
   */
  function headerToSpeakerConfig(header) {
    const opts = {};
    opts.channels = header.nbChannel / 2;
    opts.bitDepth = header.bitDepth;
    opts.sampleRate = header.sr;
    opts.signed = header.signed;
    opts.float = header.float;
    opts.samplesPerFrame = header.nbSample;

    return opts;
  }
});

module.exports = {
  authenticateIp(ip) {
    ip = ip.replace("::ffff:", "");
    console.log("Trying to authenticate IP " + ip);
    if (!whitelist.includes(ip)) {
      whitelist.push(ip);
    }
  }
}