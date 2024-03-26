import dotenv from 'dotenv';
dotenv.config();

import { bot } from './bot';
import { walletMenuCallbacks } from './connect-wallet-menu';
import {
    handleConnectCommand,
    handleDisconnectCommand,
    handleSendTXCommand,
    handleShowMyWalletCommand
} from './commands-handlers';
import { initRedisClient } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import mongo from './ton-connect/mongo';
import TonWeb from 'tonweb';
import { mongo } from 'mongoose';

const nacl = TonWeb.utils.nacl;
let tonWeb = new TonWeb();

async function main(): Promise<void> {
    await initRedisClient();
    await mongo.connect();
    const callbacks = {
        ...walletMenuCallbacks
    };

    bot.on('callback_query', query => {
        if (!query.data) {
            return;
        }

        let request: { method: string; data: string };

        try {
            request = JSON.parse(query.data);
        } catch {
            return;
        }

        if (!callbacks[request.method as keyof typeof callbacks]) {
            return;
        }

        callbacks[request.method as keyof typeof callbacks](query, request.data);
    });

    bot.onText(/\/connect/, handleConnectCommand);

    bot.onText(/\/deposit/, handleSendTXCommand);

    bot.onText(/\/disconnect/, handleDisconnectCommand);

    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

    bot.onText(/\/start/, async (msg: TelegramBot.Message) => {

        let prevUser = await mongo.getUserByTelegramID(msg.from.id.toString());
        let telegramWalletAddress ;
        let message;
        if (prevUser) message = 'Welcome Back! ' + msg.from?.first_name;
        else {
            //create a new wallet
            const keyPair = nacl.sign.keyPair();
            let wallet = tonWeb.wallet.create({publicKey: keyPair.publicKey, wc: 0});
            const address = await wallet.getAddress();
            const seqno = await wallet.methods.seqno().call();
            const deploy = wallet.deploy(keyPair.secretKey);
            const deployFee = await deploy.estimateFee();
            const deploySended = await deploy.send();
            const deployQuery = await deploy.getQuery();
            //save in db
            let newUser: mongo.User;
            newUser.telegramID = msg.from?.id;
            newUser.walletAddress = address.toString(true,true,false);
            newUser.secretKey = keyPair.secretKey.toString();
            await mongo.createUser(newUser);
            //save in variable to show
            telegramWalletAddress = address.toString(true,true,false);

        }
        bot.sendMessage(
            msg.chat.id,
            `
Your telegram Wallet Address : ${telegramWalletAddress}
Commands list: 
/connect - Connect your wallet
/my_wallet - Show connected wallet
/deposit - Deposit jettons to telegram wallet 
/withdraw - Withdraw jettons from telegram wallet
/disconnect - Disconnect from the wallet
`
        );
    });
}
const app = express();
app.use(express.json());
app.listen(10000, () => {
    console.log(`Express server is listening on 10000`);
});
main();


