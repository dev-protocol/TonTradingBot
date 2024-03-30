import dotenv from 'dotenv';
dotenv.config();

import { bot } from './bot';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { tradingMenuClick } from './trading-menus';
import {
    handleConnectCommand,
    handleDisconnectCommand,
    handleSendTXCommand,
    handleShowMyWalletCommand,
    handleStartCommand,
    handleTradeCommnad
} from './commands-handlers';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import TonWeb from 'tonweb';
import { User, getUserByTelegramID, createUser, connect, updateUserState } from './ton-connect/mongo';

declare global {
    interface Global {
        userMessage: string;
    }
}

const nacl = TonWeb.utils.nacl;
let tonWeb = new TonWeb();

async function main(): Promise<void> {
    await initRedisClient();
    await connect();
    const callbacks = {
        ...walletMenuCallbacks,
        ...tradingMenuClick,
    };

    bot.on('callback_query', query => {
        if (!query.data) {
            return;
        }
        switch (query.data) {
            case 'walletConnect':
                handleConnectCommand(query.message!);
                return;
            case 'myWallet':
                handleShowMyWalletCommand(query.message!);
                return;
            case 'disConnect':
                handleDisconnectCommand(query.message!);
                return;
            default:
                break;
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
    
    bot.on('message', async msg => {
        const userId = msg.from?.id ?? 0;
        const userState: User | null = await getUserByTelegramID(userId);
        if (userState?.state == 'waitForTraingToken') {
            //updateUserstate
            (global as { userMessage?: string }).userMessage = msg.text;
        }
    });


    bot.onText(/\/connect/, handleConnectCommand);

    bot.onText(/\/deposit/, handleSendTXCommand);

    bot.onText(/\/disconnect/, handleDisconnectCommand);

    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

    bot.onText(/\/start/, handleStartCommand);
}
const app = express();
app.use(express.json());
app.listen(10000, () => {
    console.log(`Express server is listening on 10000`);
});
main(); 
