import { Telegraf, Markup } from "telegraf"
import { config } from "dotenv"
import { get24HReport, getID, resetBuyLimit, runBuyQueue, runSellQueue, userExists } from "./utils/index.js"
import { addToBuyQueue, addToSellQueue, addUser, connectDB, getUser, updateUserBuyLimit, updateUserDailyLimit, updateUserSL, updateUserTP, updateUserTokens } from "./__db__/index.js"
import { approveSwap, buyToken, createWallet, decimalFormatting, getPair, getTimestamp, name } from "./__web3__/index.js"
import { ethers } from "ethers"
import { getProvider } from "./__web3__/init.js"
import { PAIR_ABI, PAIR_ERC20_ABI, PANCAKESWAP_ROUTER02_MAINNET, PANCAKESWAP_ROUTER02_TESTNET } from "./__web3__/config.js"

config()

const URL = process.env.TG_BOT_TOKEN

const bot = new Telegraf(URL)

bot.use(Telegraf.log())

bot.command("start",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                await ctx.replyWithHTML(`<b>Hello ${ctx.message.from.id} 👋, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet is already configured. You can fund the wallet and TraderJoe can begin making effective and efficient trades for you 🚀.</i>`)
            } else {
                const [pk, sk] = createWallet()
                const user = await addUser(
                    ctx.message.from.id,
                    ctx.message.from.username,
                    pk,
                    sk
                )
                console.log(user)

                await ctx.replyWithHTML(`<b>Congratulations ${ctx.message.from.username} 🎉, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet has been created</i>\n\n<b>🔓 Public Address : </b><i>${pk}</i>\n\n<b>🔐 Mnemonic Phrase : </b><i>${sk}</i>\n\n<i>🚨 Make sure you keep a copy of the mnemonic phrase and do not share your mnemonic phrase with anybody</i>`)
            }
        } else {
            await ctx.replyWithHTML(`<b>🚨 This bot is only used in private chats.</b>`)
        }
    } catch (err) {
        await ctx.replyWithHTML("<b>🚨 An error occured while using the bot.</b>")
        console.log(err)
    }
})

bot.command("wallet",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const user = await getUser(ctx.message.from.id)
                console.log(user)

                await ctx.replyWithHTML(`<b>💼 Here are your trading wallet info:</b>\n\n<b>🔓 Public Address : </b><i>${user.wallet_pk}</i>\n\n<b>🔐 Mnemonic Phrase : </b><i>${user.wallet_sk}</i>`)
            } else {
                await ctx.replyWithHTML(`<b>Hello ${ctx.message.from.username} 👋, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet is not yet configured</i>`)
            }
        } else {
            await ctx.replyWithHTML(`<b>🚨 This bot is only used in private chats.</b>`)
        }
    } catch (err) {
        await ctx.replyWithHTML("<b>🚨 An error occured while using the bot.</b>")
        console.log(err)
    }
})

bot.command("buy", async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args
                const user = await getUser(ctx.message.from.id)
                console.log(user)

                if(args.length == 2) {
                    const provider = getProvider()
                    const _balance = await provider.getBalance(user.wallet_pk)
                    const balance = ethers.formatEther(_balance)
                    console.log(balance, provider)

                    const timestamp = await getTimestamp()

                    if(Number(balance) >= args[1] && user.daily_limit > 0) {
                        const _name = await name(args[0])
                        const ID = await getID(args[0])

                        try {
                            await buyToken(
                                user.wallet_sk,
                                args[0],
                                args[1],
                                user.wallet_pk
                            )

                            const token = new ethers.Contract(
                                args[0],
                                PAIR_ERC20_ABI.abi,
                                getProvider()
                            )

                            token.on("Transfer", async (from, to, value, e) => {
                                if(to == user.wallet_pk) {
                                    console.log(from, to, value)
                                    const amount = await decimalFormatting(args[0], value)
                                    const entry = amount / args[1]
                                    console.log(entry, amount)

                                    await approveSwap(
                                        args[0],
                                        user.wallet_sk,
                                        PANCAKESWAP_ROUTER02_TESTNET,
                                        amount
                                    )

                                    await updateUserTokens(ctx.message.from.id, ID, args[0], args[1], amount, entry, "Bought", timestamp)

                                    await updateUserDailyLimit(ctx.message.from.id, args[1])

                                    await addToSellQueue(ctx.message.from.id, args[0], ID, args[1], amount, entry, 0, timestamp)

                                    await ctx.replyWithHTML(`<i>Congratulations ${ctx.message.from.username} 🎉, You have successfully bought <b>'${amount.toFixed(4)} ${_name}'</b> 🚀. The tokens will be sold after doing ${user.take_profit} Xs or after ${user.stop_loss} hours</i>`)
                                }
                            })
                        } catch (err) {
                            console.log(err)
                            const _user = await updateUserTokens(ctx.message.from.id, ID, args[0], args[1], 0, 0, "Pending Buy", timestamp)
                            console.log(_user)

                            await addToBuyQueue(ctx.message.from.id, args[0], ID, args[1], 1)

                            await ctx.replyWithHTML(`<b>🚨 An error occured while trying to buy <i>'${_name}'</i>. It has been added to the Buy Queue.</b>`)
                        }
                    } else {
                        await ctx.replyWithHTML(`<b>🚨 Insufficent balance for this trade OR your daily limit has been reached.</b>\n\n<i>Your trading wallet balance is <b>'${Number(balance)} BNB'.</b></i>\n\n<b>🚫 Make sure you fund your trading wallet to continue trading.</b>`)
                    }
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/buy 'Contract Address' 'Buy Amount'</i>\n\n<b>🚫 Make sure you enter a correct BSC address.</b>")
                }
            } else {
                await ctx.replyWithHTML(`<b>Hello ${ctx.message.from.username} 👋, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet is not yet configured</i>`)
            }
        } else {
            await ctx.replyWithHTML(`<b>🚨 This bot is only used in private chats.</b>`)
        }
    } catch (err) {
        await ctx.replyWithHTML("<b>🚨 An error occured while using the bot.</b>")
        console.log(err)
    }
})

bot.command("daily_limit", async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args

                if(args.length == 1) {
                    const user = await updateUserBuyLimit(ctx.message.from.id, Number(args[0]))
                    const _user = await resetBuyLimit(ctx.message.from.id, Number(args[0]))
                    console.log(user, args)

                    await ctx.replyWithHTML(`<b>🏪 You have successfully set your Buy Limit to ${args[0]} BNB every 24H</b>`)
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/daily_limit 'Amount'</i>")
                }
            } else {
                await ctx.replyWithHTML(`<b>Hello ${ctx.message.from.username} 👋, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet is not yet configured</i>`)
            }
        } else {
            await ctx.replyWithHTML(`<b>🚨 This bot is only used in private chats.</b>`)
        }
    } catch (err) {
        await ctx.replyWithHTML("<b>🚨 An error occured while using the bot.</b>")
        console.log(err)
    }
})

bot.command("take_profit",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args

                if(args.length == 1) {
                    const user = await updateUserTP(ctx.message.from.id, Number(args[0]))
                    console.log(user, args)

                    await ctx.replyWithHTML(`<b>💰 You have successfully set your Take Profit for each trade to ${args[0]}Xs</b>`)
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/take_profit 'Number Of Xs'</i>")
                }
            } else {
                await ctx.replyWithHTML(`<b>Hello ${ctx.message.from.username} 👋, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet is not yet configured</i>`)
            }
        } else {
            await ctx.replyWithHTML(`<b>🚨 This bot is only used in private chats.</b>`)
        }
    } catch (err) {
        await ctx.replyWithHTML("<b>🚨 An error occured while using the bot.</b>")
        console.log(err)
    }
})

bot.command("stop_loss", async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args

                if(args.length == 1) {
                    const user = await updateUserSL(ctx.message.from.id, Number(args[0]))
                    console.log(user, args)

                    await ctx.replyWithHTML(`<b>💰 You have successfully set your Stop Loss for each trade to ${args[0]} hours</b>`)
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/stop_loss 'Duration'</i>")
                }
            } else {
                await ctx.replyWithHTML(`<b>Hello ${ctx.message.from.username} 👋, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet is not yet configured</i>`)
            }
        } else {
            await ctx.replyWithHTML(`<b>🚨 This bot is only used in private chats.</b>`)
        }
    } catch (err) {
        await ctx.replyWithHTML("<b>🚨 An error occured while using the bot.</b>")
        console.log(err)
    }
})

bot.command("daily_report", async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
               const { no_of_buys, no_of_sells, tokens } = await get24HReport(ctx.message.from.id)
                console.log(no_of_buys, no_of_sells)

                let pnl = 0
                
                let replyMsg = `<b>🗓 Here is your daily report:</b>\n\n<i>📉 No of buys : ${no_of_buys}</i>\n<i>📈 No of sells : ${no_of_sells}</i>\n\n`

                tokens.forEach(token => {
                    if(token.profit != 0) {
                        pnl += token.profit
                    } else if(token.loss != 0) {
                        pnl += token.loss
                    }

                    replyMsg += `<b>📊 ${token.tokenId.split("-")[0]} : </b><i>${token.buy_amount} BNB</i>\n`
                })

                if(pnl > 0) {
                    replyMsg += `\n<b>📉 Profit : </b><i>${pnl}</i>`
                } else if(pnl < 0) {
                    replyMsg += `\n<b>📈 Loss : </b><i>${pnl}</i>`
                }

                await ctx.replyWithHTML(replyMsg)
            } else {
                await ctx.replyWithHTML(`<b>Hello ${ctx.message.from.username} 👋, Welcome to the TraderJoe trading bot 🤖.</b>\n\n<i>Your trading wallet is not yet configured</i>`)
            }
        } else {
            await ctx.replyWithHTML(`<b>🚨 This bot is only used in private chats.</b>`)
        }
    } catch (err) {
        await ctx.replyWithHTML("<b>🚨 An error occured while using the bot.</b>")
        console.log(err)
    }
})

connectDB()

setInterval(() => {
    runBuyQueue()

    setTimeout(runSellQueue, 1000*60*5)
}, 1000*60*10);

setInterval(() => {
    resetBuyLimit()
}, 1000*60*60*24);

bot.launch()

process.once("SIGINT", () => bot.stop("SIGINT"))

process.once("SIGTERM", () => bot.stop("SIGTERM"))