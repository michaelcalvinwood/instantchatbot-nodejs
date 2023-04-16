const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise');

const pool = mysql.createPool({
    connectionLimit : 5, //important
    host     : process.env.MYSQL_HOST,
    user     : process.env.MYSQL_USER,
    password : process.env.MYSQL_PASSWORD,
    database : process.env.MYSQL_DATABASE,
    debug    :  false
});

let databaseReady = false;

pool.query("SHOW DATABASES",(err, data) => {
    if(err) {
        console.error(err);
        return;
    }
    // rows fetch
    console.log('MYSQL ready');
    databaseReady = true;
});

exports.query = query => {
  return new Promise ((resolve, reject) => {
    pool.query(query,(err, data) => {
      if(err) {
          console.error(err);
          return reject(err);
      }
      // rows fetch
      //console.log(data);
      return resolve(data);
  });
  })
}

exports.singleQuery = (host, user, password, database, query) => {
    return new Promise(async (resolve, reject) => {
        const connection = await mysqlPromise.createConnection({
            host,
            user,
            database,
            password
          });

        const [rows, fields] = await connection.execute(query)

          
          return resolve(rows);
    })
}

exports.escape = string => mysql.escape(string);