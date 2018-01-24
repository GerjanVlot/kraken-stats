const KrakenApi = require('kraken-exchange');
const helpers = require('./helpers');

Array.prototype.groupBy = function (keyFunction) {
    var groups = {};
    this.forEach(function (el) {
        var key = keyFunction(el);
        if (key in groups == false) {
            groups[key] = [];
        }
        groups[key].push(el);
    });
    return Object.keys(groups).map(function (key) {
        return {
            key: key,
            values: groups[key]
        };
    });
};
Array.prototype.orderBy = function (keyFunction) {
    return this.sort((a, b) => keyFunction(a) - keyFunction(b));
}

module.exports = class Kraken {

    constructor(clientId, clientSecret) {
        this.api = new KrakenApi(clientId, clientSecret);
    }
    async getPagedResult(pageSize, countSelector, collectionSelector, performRequest) {
        const pagedRequest = async(offset, collection) => {
            const result = await performRequest(offset, pageSize);
            const resultCollection = collectionSelector(result);
            const count = countSelector(result);

            collection = collection.concat(resultCollection);

            if (offset + pageSize < count) {
                return await pagedRequest(offset + pageSize, collection);
            } else {
                return collection;
            }
        }
        return await pagedRequest(0, []);
    }
    async getTradeHistory() {
        return await this.getPagedResult(50,
            (result) => result.count,
            (result) => Object.keys(result.trades).map(o => result.trades[o]),
            async(offset, pageSize) => {
                return await this.api.tradesHistory("all", "false", undefined, undefined, offset);
            });
    }
    _organizeTrades(tradeHistory) {
        const sortedTradeHistory = tradeHistory.map(o => {
            o.time = new Date(o.time * 1000)
            return o;
        }).orderBy(o => o.time);
        const groupPairs = sortedTradeHistory.groupBy(o => o.pair);
        let tradeHistories = [];
        groupPairs.forEach(o => {
            const trades = [];
            let current = null;
            o.values.sort((a, b) => a.time - b.time).forEach(trade => {
                if (trade.type == 'buy') {
                    if (current != null && current.sell.length == 0) {
                        current.buy.push(trade);
                    } else {
                        if (current != null) {
                            trades.push(current);
                        }
                        current = {
                            buy: [trade],
                            sell: []
                        };
                    }
                } else {
                    if (current == null) {
                        trades.push({
                            buy: [],
                            sell: [trade]
                        });
                    } else {
                        current.sell.push(trade);
                    }
                }
            });
            trades.push(current);
            tradeHistories = tradeHistories.concat(trades);
        });
        return tradeHistories;
    }
    _mapTrade(t) {
        return {
            pair: t.pair,
            type: t.type,
            time: t.time,
            price: parseFloat(t.price),
            cost: parseFloat(t.cost),
            fee: parseFloat(t.fee),
            vol: parseFloat(t.vol),
        }
    }
    _averageTrade(t) {
        const add = (a, b) => a + b;
        return {
            pair: t[0].pair,
            type: t[0].type,
            time: new Date(t.map(o => new Date(o.time).valueOf()).reduce(add) / t.length),
            price: t.map(o => parseFloat(o.price)).reduce(add) / t.length,
            cost: t.map(o => parseFloat(o.cost)).reduce(add),
            fee: t.map(o => parseFloat(o.fee)).reduce(add),
            vol: t.map(o => parseFloat(o.vol)).reduce(add),
        }
    }
    async getTradeHistoryPairs() {
        const tradeHistory = await this.getTradeHistory();
        const sumerizedTradePairs = [];
        this._organizeTrades(tradeHistory)
            .filter(o => o != null)
            .forEach(trade => {
                const current = {
                    buy: null,
                    sell: null
                };
                if (trade.buy.length > 0) {
                    if (trade.buy.length > 1) {
                        current.buy = this._averageTrade(trade.buy);
                    } else {
                        current.buy = this._mapTrade(trade.buy[0]);
                    }
                }
                if (trade.sell.length > 0) {
                    if (trade.sell.length > 1) {
                        current.sell = this._averageTrade(trade.sell);
                    } else {
                        current.sell = this._mapTrade(trade.sell[0]);
                    }
                }
                sumerizedTradePairs.push(current);
            });
        return sumerizedTradePairs;
    }
    async getOpenTrades() {
        const tradePairs = await this.getTradeHistoryPairs();
        const openTrades = tradePairs.filter(o => o.sell == null).map(o => o.buy);
        const pairs = openTrades.map(o => o.pair);
        const tickerInfo = await this.api.ticker(pairs);
        const trades = [];
        openTrades.forEach(trade => {
            const tickerForTrade = tickerInfo[trade.pair];
            const currentPrice = parseFloat(tickerForTrade.c[0]);
            trades.push({
                pair: trade.pair,
                currentPercentage: helpers.round2Dec(helpers.calcPercentage(trade.price, currentPrice))
            });
        });
        return trades;

    }

}