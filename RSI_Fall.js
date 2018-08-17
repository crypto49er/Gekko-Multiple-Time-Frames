// RSI Fall
// 
// This strategy will buy when hourly RSI is oversold
// and 5 minute RSI is overbought, indicating trend
// reversal. It will sell when hourly RSI is overbought
// or if hourly RSI stalls after trend turns bullish.

var log = require('../core/log');
var config = require ('../core/util.js').getConfig();

const CandleBatcher = require('../core/candleBatcher');
var RSI = require('../strategies/indicators/RSI.js');

// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var currentPrice = 0.0;
var rsi5 = new RSI({ interval: 14 });
var rsiHourly = new RSI({ interval: 14 });

var advised = false;
var passedFallPoint = false;
// Prepare everything our method needs
strat.init = function() {
  this.requiredHistory = config.tradingAdvisor.historySize;

  // since we're relying on batching 1 minute candles into 15 and 30 minute candles
  // lets throw if the settings are wrong
  if (config.tradingAdvisor.candleSize !== 1) {
    throw "This strategy must run with candleSize=1";
  }

  // create candle batchers for 5 and 60 minute candles
  this.batcher5 = new CandleBatcher(5);
  this.batcherHourly = new CandleBatcher(60);

  // supply callbacks for 5 and 60 minute candle functions
  this.batcher5.on('candle', this.update5);
  this.batcherHourly.on('candle', this.updateHourly);

  // gekko will be running on 1 minute timeline internally
  // so we create and maintain indicators manually in order to update them at correct time
  // rather than using this.addIndicator
}

// What happens on every new candle?
strat.update = function(candle) {
  currentPrice = candle.close;

  // write 1 minute candle to 5 and 10 minute batchers
  this.batcher5.write([candle]);
  this.batcher5.flush();

  this.batcherHourly.write([candle]);
  this.batcherHourly.flush();

}

strat.update5 = function(candle) {
  rsi5.update(candle);
  log.info('5 Minute RSI = ', rsi5.result);
}

strat.updateHourly = function(candle) {
  rsiHourly.update(candle);
  log.info('Hourly RSI = ', rsiHourly.result);
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function(candle) {
  //log.info('Current price: ', currentPrice);
  
  // Buy when hourly RSI is still oversold but 5 minute RSI is overbought
  if (rsiHourly.result < config.RSI_Fall.oversold && rsi5.result > config.RSI_Fall.overbought && !advised) {
    var message = config.watch.asset + 'current price: ' + currentPrice +
    '\nHourly RSI: ' + rsiHourly.result +
    '\n5 Minute RSI: ' + rsi5.result +
    '\nBuying';
    log.remote(message);
    this.advice('long');
    advised = true;
    passedFallPoint = false;
    buyPrice = currentPrice;
  }

  // Sell when hourly RSI is overbought
  if (advised && rsiHourly.result > config.RSI_Fall.overbought) {
    var message = config.watch.asset + 'current price: ' + currentPrice +
    '\nHourly RSI: ' + rsiHourly.result +
    '\n5 Minute RSI: ' + rsi5.result +
    '\nSelling' +
    '\nBought At ' + buyPrice;
    log.remote(message);
    this.advice('short');
    advised = false;
    buyPrice = 0;
  }

  // Set passFallPoint to true when hourly RSI passes sellWhenRSIFallsTo point
  if (advised && rsiHourly.result > config.RSI_Fall.sellWhenRSIFallsTo) {
    passedFallPoint = true;
  }

  // Sell when hourly RSI stalls and falls below sellWhenRSIFallsTo point after breaking through it
  if (advised && passedFallPoint && rsiHourly.result < config.RSI_Fall.sellWhenRSIFallsTo) {
    var message = config.watch.asset + 'current price: ' + currentPrice +
    '\nHourly RSI: ' + rsiHourly.result +
    '\n5 Minute RSI: ' + rsi5.result +
    '\nSell due to RSI stall' +
    '\nBought At ' + buyPrice;
    log.remote(message);
    this.advice('short');
    advised = false;
    buyPrice = 0;
  }

}


module.exports = strat;
