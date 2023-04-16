require('dotenv').config();
const mysql = require('./mysql');
const { v4: uuidv4 } = require('uuid');
const fs = require("fs");
const pdf = require("pdf-extraction");
const qdrant = require('./qdrant');

const splitWords = (string, chunk = 400, overlap = 125) => { 
    const words = string.split(' ');

    const len = words.length;

    // remove any possible long character strings that may not be actual words
    for (let i = len - 1; i >= 0; --i) {
        if (words[i].length > 50) words.splice(i, 1);
    }

    let index = 0;
    const chunks = [];    
    while (index < words.length) {
        let curChunk = [];
        for (let i = index; i < index + chunk; ++i) curChunk.push(words[i]);
        chunks.push(curChunk.join(' '));
        index += chunk - overlap;
    }

    for (let i = chunks.length - 1; i >= 0; --i) {
        let firstPeriod = chunks[i].indexOf('.');
        let lastPeriod = chunks[i].lastIndexOf('.');
        if (firstPeriod === -1 || lastPeriod === -1 || firstPeriod === lastPeriod) {
            chunks.splice(i, 1);
        } else {
            chunks[i] = chunks[i].substring(firstPeriod + 1, lastPeriod+1);
        }
    }

    return chunks;

 }; 

const getPdfInfo = (fileName) => {
    console.log('fileName', fileName)
    return new Promise ((resolve, reject) => {
        pdfUtil.info(fileName, function(err, info) {
            if (err) reject(err);
            else resolve(info);
            return;
        });
    })
}

const extractFullPdfText = fileName => {
    return new Promise((resolve, reject) => {
        pdfUtil.pdfToText(fileName, function(err, data) {
            if (err) reject(err);
            else resolve(data); 
            return;    
          });
    })
}

/*
 * Ingests various data types to chunks table
 */

const addDataSource = async (id, type, info) => await mysql.query(`INSERT INTO data_source (id, type, info) VALUES ('${id}','${type}', ${mysql.escape(JSON.stringify(info))})`);

exports.getConnectionInfo = async (botId) => await mysql.query(`SELECT chunk, vector FROM connection_info WHERE bot_id = '${botId}'`);

exports.pdf = async (botId, fileName, openAIKey) => {
    // get pdf info

    let dataBuffer = fs.readFileSync(fileName);
 
    let data = await pdf(dataBuffer);
    let text = data.text.replaceAll("-\n", "").replaceAll("\n", "");

    /*
     * TODO: Check file size and add to quota or abort if it will go over quota
     */

    const dataSourceId = uuidv4();

    //result = await addDataSource(dataSourceId, 'pdf', fileName);

    const connectionInfo = await this.getConnectionInfo(botId);
    const chunkConnection = JSON.parse(connectionInfo[0].chunk);
    const vectorConnection = JSON.parse(connectionInfo[0].vector);

    console.log('chunk', chunkConnection);
    console.log('vector', vectorConnection);

    const chunks = splitWords(text);

    let { host, user, database, password } = chunkConnection;
    
    for (let i = 0; i < chunks.length; ++i) {
        let chunkId = uuidv4();
    
        result = await qdrant.addOpenAIPoint(vectorConnection.host, vectorConnection.port, openAIKey, botId, chunkId, chunks[i]);

        console.log('result', result);
    }
}

