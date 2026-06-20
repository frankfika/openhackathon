const readline = require('readline');
const nodemailer = require('nodemailer');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.once('line', async (line) => {
  try {
    const cfg = JSON.parse(line);
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    await transporter.verify();
    console.log(JSON.stringify({ ok: true }));
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      code: error && error.code,
      responseCode: error && error.responseCode,
      command: error && error.command,
      message: error && error.message,
      response: error && error.response,
    }));
  } finally {
    rl.close();
  }
});
