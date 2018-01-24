const Kraken = require("./kraken");
const asyncHandler = require('express-async-handler')
var express = require('express'); // call express
var app = express(); // define our app using express
var bodyParser = require('body-parser');
var stats = require("./stats");
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json').toString());

const urlToken = config.urlToken;
const clientId = config.clientId;
const clientSecret = config.clientSecret;
const kraken = new Kraken(clientId, clientSecret);

stats(kraken);

app.use(bodyParser.json());
var router = express.Router(); 

// http://yourip:3003/api/trades/{urlToken}
router.get('/trades/:token', asyncHandler(async function (req, res) {
    if (req.params.token == urlToken) {
      try {
        const trades = await kraken.getOpenTrades();
        res.json(trades);
      }catch(ex){
        res.json(ex);
      }
    } else {
        res.json([]);
    }
}));

app.use('/api', router);
app.listen(3003);
