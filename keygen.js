const crypto = require("crypto");
const fs = require("fs");
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});
fs.writeFileSync(__dirname + "/publicKey.key", publicKey);
fs.writeFileSync(__dirname + "/privateKey.key", privateKey);
