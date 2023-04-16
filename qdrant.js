require ('dotenv').config();
const axios = require('axios');
const { Configuration, OpenAIApi } = require("openai");
const { v4: uuidv4 } = require('uuid');
const ingest = require('./ingest');

/*
 * collections
 */

exports.getDavinciResponse = async (prompt, openAIKey) => {
    const request = {
        url: 'https://api.openai.com/v1/completions',
        method: 'post',
        headers: {
            'Authorization': `Bearer ${openAIKey}`,
            'OpenAI-Organization': 'org-au8QBof6DlN4hzFuXrH1WBGE'            
        },
        data: {
            model: "text-davinci-003",
            prompt,
            max_tokens: 1000,
            temperature: 0.25,
        }

    }



    let response;

    try {
        response = await axios(request);
        console.log(response.data);
    } catch (e) {
        console.error(e);
        console.error(e.response.data);
        return 'AI Error: Please try again.';
    }

    let answer = JSON.parse(response.data.choices[0].text.replaceAll("\n", ""));

    return answer.answer;
}

const promisfiedAxios = request => {
    return new Promise (async(resolve, reject) => {
        let response;
    
        try {
            response = await axios(request);
            return resolve({isSuccess: true, msg: response.data});
        } catch (err) {
            return resolve ({isSuccess: false, msg: err.response && err.response.data ? err.response.data : err})
        }
    });
}

exports.createCollection = async (host, port, collectionName, size, onDiskPayload = true, distance = 'Cosine') => {
    const request = {
        url: `http://${host}:${port}/collections/${collectionName}`,
        method: 'put',
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            "Access-Control-Allow-Origin": "*",
        },
        data: {
            vectors: {
                size,
                distance
            }
        }
    }
        
    return promisfiedAxios(request);   
}

exports.collectionInfo = async (host, port, collectionName) => {
    const request = {
        url: `${host}:${port}/collections/${collectionName}`,
        method: 'get'
    }

    return promisfiedAxios(request);
}

exports.deleteCollection = async (host, port, collectionName) => {
    const request = {
        url: `${host}:${port}/collections/${collectionName}`,
        method: 'DELETE'
    }

    return promisfiedAxios(request);
}

exports.addPoint = async (host, port, collectionName, point) => {
    const { id, vector, payload } = point;
    
    const request = {
        url: `http://${host}:${port}/collections/${collectionName}/points`,
        method: 'put',
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            "Access-Control-Allow-Origin": "*",
        },
        data: {
            points: [
                {
                    id, vector, payload

                }
            ]
        }
    }

    return promisfiedAxios(request);
}

exports.createContextBasedPrompt = (query, contexts) => {
    let prompt = `"""Answer the question as truthfully as possible using the provided contexts, and if the answer cannot be found by combining the contexts below, say "I don't know". Provide as much detail as you can in your response. Also state all the context numbers that helped to provide you with the answer. The return format must be stringified JSON in the following format: {
        "answer": answer goes here
        "provider": array of the context numbers that provided you the answer here
    }
`;
    for (let i = 0; i < contexts.length; ++i) {
        prompt += `Context ${i + 1}:\n${contexts[i]}\n\n`
    }

    prompt += `Question: ${query}\n
    """\n`

    return prompt;
}

exports.getContexts = async (botId, openAIKey, query, limit = 3) => {

    const connectionInfo = await ingest.getConnectionInfo(botId);

    const connection = JSON.parse(connectionInfo[0].vector);

    const vector = await getEmbedding(openAIKey, query);
 
    const request = {
        url: `http://${connection.host}:${connection.port}/collections/${botId}/points/search`,
        method: 'post',
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            "Access-Control-Allow-Origin": "*",
        },
        data: {
            vector: vector.msg,
            limit,
            "with_payload": true
        }
    }

    let response;

    try {
        response = await axios(request);
        const results = response.data.result;
        const contexts = [];
        for (let i = 0; i < results.length; ++i) {
            contexts.push(results[i].payload.txt);
        }
        return contexts;
    } catch (err) {
        console.error(err);
        return [];
    }
}

/*
 * openAI interface
 */

const getEmbedding = async (openAiKey, input) => {
    const configuration = new Configuration({
        apiKey: openAiKey,
      });
      const openai = new OpenAIApi(configuration);
      let embeddingResponse;
      try {
        embeddingResponse = await openai.createEmbedding({
            model: 'text-embedding-ada-002',
            input,
          })    
      } catch (err) {
        console.error('Axios err', err.response.data);
        return {isSuccess: false, msg: err.response && err.response.data ? err.response.data : err};
      }
      
      const [{ embedding }] = embeddingResponse.data.data
      return {isSuccess: true, msg: embedding};
}

exports.createOpenAICollection = async (botId) => {
    const info = await ingest.getConnectionInfo(botId);

    const vector  = JSON.parse(info[0].vector);
   

    return this.createCollection(vector.host, vector.port, botId, 1536);
}

exports.addOpenAIPoint = async (host, port, openAiKey, collectionName, pointId, input) => {
    let result = await getEmbedding(openAiKey, input);

    if (!result.isSuccess) return result;

    const vector = result.msg;

    return await this.addPoint(host, port, collectionName, 
        {
            id: pointId, 
            vector, 
            payload: {txt: input}
        }
    );
}