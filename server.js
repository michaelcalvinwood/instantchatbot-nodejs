require('dotenv').config();
const httpsPort = 5100;
const httpPort = 5101;

const privateKeyPath = '/home/sslkeys/instantchatbot.net.key';
const fullchainPath = '/home/sslkeys/instantchatbot.net.pem';

const express = require('express');
const https = require('https');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const qdrant = require('./qdrant');

const mysql = require('./mysql');

const {OPENAI_API_KEY, JWT_SECRET} = process.env;

const getConnectionInfo = async (botId) => await mysql.query(`SELECT chunk, vector, app FROM connection_info WHERE bot_id = '${botId}'`);

const createDirIfNotExists = dir => {
    if(!fs.existsSync(dir)) fs.mkdirSync(dir);
}

function decodeToken(info) {
    // if invalid return false
    if (!jwt.verify(info, JWT_SECRET)) return false;

    const token = jwt.decode(info);
    const curTime = new Date();

    // if expired return false
    if (token.exp < curTime.getTime()/1000) return false;

    return token;
}

const createChatbotToken = async (botId, openAIKey, domains) => {
    const connectionInfo = await getConnectionInfo(botId);

    if (!connectionInfo[0]) {
        console.error(`ERROR: Could not get connection info for bot ${botId}`);
        return false;
    }

    const { chunk, vector, app} = connectionInfo[0];

    const appObj = JSON.parse(app);
    //console.log('app', app)

    const token = jwt.sign({botId, openAIKey, domains, chunk, vector, app}, JWT_SECRET);
    
    const css = fs.readFileSync('./instantchatbot.css', 'utf-8');

    const js = `const instantChatbotToken='${token}';\nconst instantChatbotHost='https://${appObj.host}:${appObj.port}';\n\n` + fs.readFileSync('./instantchatbot.js', 'utf-8');

    createDirIfNotExists(`/var/www/instantchatbot.net/${botId}`);
    
    //console.log(`/var/www/instantchatbot.net/${botId}/instantchatbot.js`);
    
    //console.log(css);

    fs.writeFileSync(`/var/www/instantchatbot.net/${botId}/instantchatbot.js`, js);

    fs.writeFileSync(`/var/www/instantchatbot.net/${botId}/instantchatbot.css`, css);   
}

createChatbotToken('test', OPENAI_API_KEY, ['gamma.pymnts.com', 'pymnts.com', 'www.pymnts.com']);

const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

/*
 * Functions
 */

const postHandler = (req, res) => {
    console.log('posthandler');
    return new Promise(async (resolve, reject) => {
        const { prompt, token } = req.body;

        console.log('prompt', prompt);

        if (!prompt || !token) {
            res.status(400).json({error: 'invalid'});
            return resolve('error: 400');
        }
    
        const decodedToken = decodeToken(token);
    
        if (decodedToken === false) {
            res.status(401).json({error: 'invalid'});
            return resolve('error: invalid');
        }


        const { botId, openAIKey, domains } = decodedToken;        
        const vector = decodedToken.vector ? JSON.parse(decodedToken.vector) : null;

        if (!botId || !openAIKey || !domains || !vector) {
            res.status(401).json({error: 'invalid 3'});
            return resolve('error: invalid 3');
        }
    
        const origin = req.headers.origin;
    
        const url = new URL(origin);
    
        const test = decodedToken.domains ? decodedToken.domains.find(domain => domain === url.host) : null;
    
        if (!test) {
            res.status(401).json({error: 'invalid request'});
            return resolve('error: invalid request');
        }
    
        console.log(decodedToken);
        
        const contexts = await qdrant.getContexts(botId, openAIKey, prompt, 3);

        console.log(contexts);

        // convert query into embedding

        
        
        res.status(200).json({bot: 'I am here to help you always.'});

        return resolve('ok');
    })
}



/*
 * Routes
 */

app.get('/', (req, res) => {
    console.log('here');
    res.send('Hello, World!');
});

app.post('/', (req, res) => { postHandler(req, res)});

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);
  

  httpsServer.listen(httpsPort, () => {
    console.log(`HTTPS Server running on port ${httpsPort}`);
});

//http.createServer(app).listen(httpPort, '0.0.0.0');
