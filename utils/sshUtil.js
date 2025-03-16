const { spawn } = require("child_process");
const path = require("path");

let sshProcess;

async function createReverseTunnel() {
  return new Promise((resolve, reject) => {
    const keyPath = path.join(__dirname, "..", "id_rsa");
    sshProcess = spawn(
      "ssh",
      ["-i", keyPath, "-o", "StrictHostKeyChecking=no", "-R", "80:localhost:3000", "plan@localhost.run"],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    sshProcess.stdout.on("data", (data) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-z0-9]+\.lhr\.life/);
      if (match) {
        console.log(`Tunnel URL: ${match[0]}`);
        resolve(match[0]);
      }
    });

    sshProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    sshProcess.on("error", (error) => {
      reject(`Error creating reverse tunnel: ${error.message}`);
    });

    sshProcess.on("close", (code) => {
      if (code !== 0) {
        reject(`SSH process exited with code ${code}`);
      }
    });
  });
}

module.exports = { createReverseTunnel };
