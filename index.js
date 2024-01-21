import { Telegraf, Markup } from "telegraf"
import { config } from "dotenv"
import { get24HReport, resetBuyLimit, runBuyQueue, runSellQueue, userExists, watchPairCreation } from "./utils/index.js"
import { addUser, connectDB, getUser, updateUserBuyAmount, updateUserBuyLimit, updateUserBuying, updateUserSL, updateUserTP } from "./__db__/index.js"
import { createWallet } from "./__web3__/index.js"
import { getProvider } from "./__web3__/init.js"

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

bot.command("buy_amount", async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const args = ctx.args

                if(args.length == 1) {
                    const user = await updateUserBuyAmount(ctx.message.from.id, Number(args[0]))
                    console.log(user, args)

                    await ctx.replyWithHTML(`<b>🏪 You have successfully set your Buy Amount to ${args[0]} BNB for every trade</b>`)
                } else {
                    await ctx.replyWithHTML("<b>🚨 Use the command appropriately.</b>\n\n<i>Example:\n/buy_amount 'Amount'</i>")
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

bot.command("enable_buys",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const user = await updateUserBuying(ctx.message.from.id, "Enabled")
                console.log(user)

                await ctx.replyWithHTML(`<b>💰 You have enabled all buys on your wallet.</b>`)
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

bot.command("disable_buys",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const user = await updateUserBuying(ctx.message.from.id, "Disabled")
                console.log(user)

                await ctx.replyWithHTML(`<b>💰 You have disabled all buys on your wallet.</b>`)
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

bot.command("balance",  async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const user_exists = await userExists(ctx.message.from.id)

            if(user_exists) {
                const user = await getUser(ctx.message.from.id)
                const balance = await getProvider().getBalance(user.wallet_pk)
                console.log(user, ethers.formatEther(balance))

                await ctx.replyWithHTML(`<b>🪙 Your balance is ${ethers.formatEther(balance)} BNB.</b>`)
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

                    await ctx.replyWithHTML(`<b>💰 You have successfully set your Stop Loss for each trade to ${args[0]} minutes</b>`)
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
    runSellQueue()

    setTimeout(() => {
        runBuyQueue()
    }, 1000*60*1)
}, 1000*60*2);

setInterval(() => {
    resetBuyLimit()
}, 1000*60*60*24);

setTimeout(() => {
    watchPairCreation()
}, 1000*60)

bot.launch()

process.once("SIGINT", () => bot.stop("SIGINT"))

process.once("SIGTERM", () => bot.stop("SIGTERM"))