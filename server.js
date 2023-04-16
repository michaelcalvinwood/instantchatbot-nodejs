require('dotenv').config();
const httpsPort = 5100;
const httpPort = 5101;

const privateKeyPath = '/etc/letsencrypt/live/home.instantchatbot.net/privkey.pem';
const fullchainPath = '/etc/letsencrypt/live/home.instantchatbot.net/fullchain.pem';

const express = require('express');
const https = require('https');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const mysql = require('./mysql');

const {OPENAI_API_KEY, JWT_SECRET} = process.env;

const getConnectionInfo = async (botId) => await mysql.query(`SELECT chunk, vector, app FROM connection_info WHERE bot_id = '${botId}'`);

const getChatbotToken = async (botId, openAIKey, domains) => {
    const connectionInfo = await getConnectionInfo(id);

    if (!connectionInfo[0]) {
        console.error(`ERROR: Could not get connection info for bot ${botId}`);
        return false;
    }

    const { chunk, vector, app} = connectionInfo[0];

    const token = {botId, openAIKey, domains, chunk, vector, app}
}

getChatbotToken('test', OPENAI_API_KEY, ['gamma.pymnts.com', 'pymnts.com', 'www.pymnts.com']);

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

/*
 * Functions
 */





/*
 * Routes
 */

app.get('/', (req, res) => {
    console.log('here');
    res.send('Hello, World!');
});

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);
  

  httpsServer.listen(httpsPort, () => {
    console.log(`HTTPS Server running on port ${httpsPort}`);
});

//http.createServer(app).listen(httpPort, '0.0.0.0');
