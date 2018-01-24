const helpers = require('./helpers');

function displayHistory(tradePairs) {
    let sum = 0;
    tradePairs
        .filter(o => o.buy != null && o.sell != null)
        .orderBy(o => o.buy.time.valueOf())
        .forEach(o => {
            const percentage = helpers.calcPercentage(o.buy.price, o.sell.price);
            const diff = (o.sell.time.valueOf() - o.buy.time.valueOf());
            const hours = Math.floor(diff / 1000 / 60 / 60);
            const minutes = Math.floor((diff / 1000 / 60) - (hours * 60));

            const line = `${o.buy.pair}, ${helpers.round2Dec(o.buy.cost).toString().padEnd(6, " ")}, ${helpers.round2Dec(o.sell.cost).toString().padEnd(6, " ")}, ${hours.toString().padEnd(4, " ")} ,${minutes.toString().padEnd(4, " ")}, ${helpers.round2Dec(percentage).toString().padEnd(6, " ")+ "%"}`;
            console.log(line);
            sum += percentage;
        });
    console.log("total: " + helpers.round2Dec(sum) + "%");
}

async function start(kraken) {
    const tradePairs = await kraken.getTradeHistoryPairs();

    console.log("###################################################");
    console.log("#                     History                     #");
    console.log("###################################################");
    displayHistory(tradePairs);

}

module.exports = function (kraken) {
    start(kraken);
}