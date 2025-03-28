const ccxt = require('ccxt');
const fs = require('fs');

// Initialize the exchange
const exchange = new ccxt.bybit();
const symbol = "BTC/USDT";

// File to store balance
const BALANCE_FILE = 'balance.json';

// Trading variables
let inPosition = false;
let buyPrice = 0;
let sellPrice = 0;
let userCapital = 1000;
let totalBalance;
const feeRate = 0.0005;

// Load saved balance from file or use default
function loadBalance() {
    try {
        if (fs.existsSync(BALANCE_FILE)) {
            const data = fs.readFileSync(BALANCE_FILE, 'utf8');
            const savedData = JSON.parse(data);
            return savedData.balance;
        }
    } catch (err) {
        console.log('No previous balance found, starting with default');
    }
    return 1000; // Default starting balance
}

// Save current balance to file
function saveBalance(balance) {
    const data = {
        balance: balance,
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(BALANCE_FILE, JSON.stringify(data, null, 2));
}

// Initialize total balance from saved data
totalBalance = loadBalance();

// Helper function to format date
function getTimeString() {
    return new Date().toLocaleTimeString();
}

// Logger function
function logToConsole(msg) {
    console.log(`[${getTimeString()}] ${msg}`);
}

// Function to log trade details
function logTrade(buy, sell, buyStatus, sellStatus, profit) {
    console.log('\n=== Trade Log ===');
    console.log(`Time: ${getTimeString()}`);
    console.log(`Buy Price: ${buy.toFixed(2)}`);
    console.log(`Sell Price: ${sell.toFixed(2)}`);
    console.log(`Buy Status: ${buyStatus}`);
    console.log(`Sell Status: ${sellStatus}`);
    console.log(`Profit: ${profit.toFixed(2)}`);
    console.log(`Total Balance: ${totalBalance.toFixed(2)} USDT`);
    console.log('===============\n');
}

let lastTrade = {
    buyPrice: 0,
    sellPrice: 0,
    buyStatus: "Pending",
    sellStatus: "Pending",
    profit: 0
};

async function placeOrders() {
    try {
        const ticker = await exchange.fetchTicker(symbol);
        const midPrice = (ticker.bid + ticker.ask) / 2;

        console.log(`\nCurrent Price: ${midPrice.toFixed(2)} USDT`);

        if (!inPosition && buyPrice === 0 && sellPrice === 0) {
            const spread = ticker.ask - ticker.bid;
            buyPrice = midPrice - spread * 2;
            sellPrice = buyPrice + 30; // Fixed profit target $30
            lastTrade = {
                buyPrice,
                sellPrice,
                buyStatus: "Pending",
                sellStatus: "Pending",
                profit: 0
            };
            logToConsole(`Waiting to Buy at ${buyPrice.toFixed(2)}`);
        }

        if (!inPosition && midPrice <= buyPrice) {
            const tradeSize = totalBalance > 0 ? totalBalance * 0.2 : 10; // Using totalBalance instead of userCapital
            const buyFee = tradeSize * feeRate;
            inPosition = true;
            lastTrade.buyStatus = "Executed";
            logToConsole(`Bought at ${buyPrice.toFixed(2)}, Waiting to Sell at ${sellPrice.toFixed(2)}`);
        }

        if (inPosition && midPrice >= sellPrice) {
            const tradeSize = totalBalance * 0.2; // Using totalBalance instead of userCapital
            const sellReturn = tradeSize + 30;
            const sellFee = sellReturn * feeRate;
            const finalReturn = sellReturn - sellFee;
            const buyCost = tradeSize + (tradeSize * feeRate);
            const profit = finalReturn - buyCost;

            totalBalance += profit;
            // Save the updated balance after each profitable trade
            saveBalance(totalBalance);

            lastTrade.sellStatus = "Executed";
            lastTrade.profit = profit;

            logTrade(
                lastTrade.buyPrice,
                lastTrade.sellPrice,
                lastTrade.buyStatus,
                lastTrade.sellStatus,
                lastTrade.profit
            );

            logToConsole(`Sold at ${sellPrice.toFixed(2)} | Profit: ${profit.toFixed(2)} USDT`);
            logToConsole(`Updated Total Balance: ${totalBalance.toFixed(2)} USDT`);

            inPosition = false;
            buyPrice = 0;
            sellPrice = 0;
        }
    } catch (err) {
        logToConsole(`Error: ${err.message}`);
    }
}

// Run the trading bot
console.log('Trading bot started...');
console.log(`Starting balance: ${totalBalance} USDT\n`);

// Run every 3 seconds
setInterval(placeOrders, 3000);
