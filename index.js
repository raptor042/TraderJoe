import { Telegraf, Markup } from "telegraf"
import { config } from "dotenv"
import { getID, resetBuyLimit, runBuyQueue, runSellQueue, userExists } from "./utils/index.js"
import { addToBuyQueue, addToSellQueue, addUser, connectDB, getUser, updateUserBuyAmount, updateUserBuyLimit, updateUserDailyLimit, updateUserSL, updateUserTP, updateUserTokens } from "./__db__/index.js"
import { buyToken, createWallet, decimalFormatting, getPair, name } from "./__web3__/index.js"
import { ethers } from "ethers"
import { getProvider } from "./__web3__/init.js"
import { PAIR_ABI } from "./__web3__/config.js"

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

bot.command("buy",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args
                const user = await getUser(ctx.message.from.id)
                console.log(user)

                if(args.length == 1) {
                    const provider = getProvider()
                    const _balance = await provider.getBalance(user.wallet_pk)
                    const balance = ethers.formatEther(_balance)
                    console.log(balance, provider)

                    if(Number(balance) >= user.buy_amount) {
                        const _name = await name(args[0])
                        const ID = await getID(args[0])

                        try {
                            await buyToken(
                                user.wallet_sk,
                                args[0],
                                user.buy_amount,
                                user.wallet_pk
                            )

                            const pairAddr = await getPair(args[0], true)
                            const pair = new ethers.Contract(
                                pairAddr,
                                PAIR_ABI.abi,
                                getProvider()
                            )

                            pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, e) => {
                                if(to == user.wallet_pk) {
                                    console.log(sender, Number(amount0In), Number(amount1In), Number(amount0Out), Number(amount1Out), to)
                                    const entry = Number(amount0Out) / Number(amount1In)
                                    const timestamp = await getTimestamp()
                                    const amount = await decimalFormatting(args[0], amount0Out)
                                    console.log(entry, amount)

                                    await updateUserTokens(ctx.message.from.id, ID, amount, args[0], entry, "Bought")

                                    await updateUserDailyLimit(ctx.message.from.id, user.buy_amount)

                                    await addToSellQueue(ctx.message.from.id, args[0], ID, amount, entry, 0, timestamp)

                                    await ctx.replyWithHTML(`<i>Congratulations ${ctx.message.from.username} 🎉, You have successfully bought <b>'${amount.toFixed(4)} ${_name}'</b> 🚀. The tokens will be sold after doing ${user.take_profit} Xs or after ${user.stop_loss} hours</i>`)
                                }
                            })
                        } catch (err) {
                            console.log(err)
                            const _user = await updateUserTokens(ctx.message.from.id, ID, 0, args[0], "Pending Buy")
                            console.log(_user)

                            await addToBuyQueue(ctx.message.from.id, args[0], ID, user.buy_amount, 1)

                            await ctx.replyWithHTML(`<b>🚨 An error occured while trying to buy <i>'${_name}'</i>. It has been added to the Buy Queue.</b>`)
                        }
                    } else {
                        await ctx.replyWithHTML(`<b>🚨 Insufficent balance for this trade.</b>\n\n<i>Your trading wallet balance is <b>'${Number(balance)} BNB'.</b></i>\n\n<b>🚫 Make sure you fund your trading wallet to continue trading.</b>`)
                    }
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/buy 'Contract Address'</i>\n\n<b>🚫 Make sure you enter a correct BSC address.</b>")
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

bot.command("daily_limit",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args

                if(args.length == 1) {
                    const user = await updateUserBuyLimit(ctx.message.from.id, Number(args[0]))
                    console.log(user, args)

                    await ctx.replyWithHTML(`<b>🏪 You have successfully set your Buy Limit to ${args[0]} BNB every 24H</b>`)
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/limit 'Amount'</i>")
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

bot.command("buy_amount",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args

                if(args.length == 1) {
                    const user = await updateUserBuyAmount(ctx.message.from.id, Number(args[0]))
                    console.log(user, args)

                    await ctx.replyWithHTML(`<b>💰 You have successfully set your Buy Amount for each trade to ${args[0]} BNB</b>`)
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/amount 'Amount'</i>")
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
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/tp 'Number Of Xs'</i>")
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

bot.command("stop_loss",  async ctx => {
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
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/sl 'Duration'</i>")
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

connectDB()

setTimeout(() => {
    runBuyQueue()

    runSellQueue()
}, 1000*60);

setTimeout(() => {
    resetBuyLimit()
}, 1000*60*60*24);

bot.launch()

process.once("SIGINT", () => bot.stop("SIGINT"))

process.once("SIGTERM", () => bot.stop("SIGTERM"))