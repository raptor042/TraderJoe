import { ethers } from "ethers"
import { 
    deleteBuyQueue,
    deleteSellQueue,
    getBuyQueue, 
    getSellQueue, 
    getUser, 
    getUsers, 
    resetUserDailyLimit, 
    updateBuyEntries, 
    updateSellEntries, 
    updateUserTokenAmount, 
    updateUserTokenEntry, 
    updateUserTokenFlag, 
    updateUserTokenLoss, 
    updateUserTokenProfit, 
    updateUserTokenSL, 
    updateUserTokenTP, 
    updateUserTokenXs 
} from "../__db__/index.js"
import { WETH, buyToken, decimalFormatting, getAmountsOut, getPair, getTimestamp, sellToken, symbol } from "../__web3__/index.js"
import { getProvider } from "../__web3__/init.js"
import { PAIR_ABI, PAIR_ERC20_ABI, PANCAKESWAP_ROUTER02_MAINNET, PANCAKESWAP_ROUTER02_TESTNET } from "../__web3__/config.js"

export const getID = async (address) => {
    const _symbol = await symbol(address)
    const randInt = Math.floor(Math.random() * 10**8)
    console.log(_symbol, randInt)

    return `${_symbol}-${randInt}`
}

export const userExists = async userId => {
    const user = await getUser(userId)
    console.log(user)

    return user ? true : false
}

export const resetBuyLimit = async () => {
    const users = await getUsers()

    users.forEach(async user => {
        const _user = await resetUserDailyLimit(user.userId, user.buy_limit)
        console.log(_user)
    })
}

const calculateXs = (price0, price1) => {
    const diff = price1 - price0
    const Xs = diff / price0
    console.log(diff, Xs)

    return Xs
}

export const runBuyQueue = async () => {
    const queue = await getBuyQueue()
    console.log(queue)

    queue.forEach(async element => {
        try {
            const user = await getUser(element.userId)
            console.log(user)

            const token = new ethers.Contract(
                element.token,
                PAIR_ERC20_ABI.abi,
                getProvider()
            )

            await buyToken(
                user.wallet_sk,
                element.token,
                element.buy_amount,
                user.wallet_pk
            )

            token.on("Transfer", async (from, to, value, e) => {
                if(to == user.wallet_pk) {
                    console.log(from, to, value)
                    const timestamp = await getTimestamp()
                    const amount = await decimalFormatting(element.token, value)
                    const entry = amount / element.buy_amount
                    console.log(entry, amount, timestamp)

                    await updateUserTokenAmount(
                        element.userId,
                        element.token,
                        element.tokenId,
                        amount
                    )

                    await updateUserTokenEntry(
                        element.userId,
                        element.token,
                        element.tokenId,
                        entry
                    )

                    await updateUserTokenFlag(
                        element.userId,
                        element.token,
                        element.tokenId,
                        "Bought"
                    )

                    await updateUserDailyLimit(element.userId, element.buy_amount)

                    await addToSellQueue(element.userId, args[0], ID, element.buy_amount, amount, entry, 0, timestamp)

                    await deleteBuyQueue(element.userId)
                }
            })
        } catch (err) {
            console.log(err)
            await updateBuyEntries(element.userId)

            await updateUserTokenFlag(
                element.userId,
                element.token,
                element.tokenId,
                "Pending Buy"
            )
        }
    })
}

export const runSellQueue = async () => {
    const queue = await getSellQueue()
    console.log(queue)

    queue.forEach(async element => {
        const user = await getUser(element.userId)
        console.log(user)

        const timestamp = await getTimestamp()
        const time_diff = (timestamp - element.timestamp) / (1000*60*60)
        console.log(timestamp, element.timestamp, time_diff)

        const [amount0In, amount1Out] = await getAmountsOut(element.amount, element.token)
        const exit = Number(amount0In) / Number(amount1Out)
        const Xs = calculateXs(element.entry, exit)
        
        if(time_diff >= user.stop_loss || Xs >= user.take_profit) {
            try {
                const token = new ethers.Contract(
                    element.token,
                    PAIR_ERC20_ABI.abi,
                    getProvider()
                )

                await sellToken(
                    user.wallet_sk,
                    element.token,
                    element.amount*0.9999,
                    user.wallet_pk
                )

                token.on("Transfer", async (from, to, value, e) => {
                    if(from == user.wallet_pk) {
                        console.log(from, to, value)
                        if(exit > element.entry) {
                            const profit = Number(ethers.formatEther(amount1Out)) - element.buy_amount
    
                            await updateUserTokenProfit(
                                element.userId,
                                element.token,
                                element.tokenId,
                                profit
                            )
    
                            await updateUserTokenTP(
                                element.userId,
                                element.token,
                                element.tokenId,
                                exit
                            )
    
                            await updateUserTokenXs(
                                element.userId,
                                element.token,
                                element.tokenId,
                                Xs
                            )
                        } else if(exit < element.entry) {
                            const loss = element.buy_amount - Number(ethers.formatEther(amount1Out))
    
                            await updateUserTokenLoss(
                                element.userId,
                                element.token,
                                element.tokenId,
                                loss
                            )
    
                            await updateUserTokenSL(
                                element.userId,
                                element.token,
                                element.tokenId,
                                exit
                            )
    
                            await updateUserTokenXs(
                                element.userId,
                                element.token,
                                element.tokenId,
                                Xs
                            )
                        }
    
                        await updateUserTokenFlag(
                            element.userId,
                            element.token,
                            element.tokenId,
                            "Sold"
                        )
    
                        await deleteSellQueue(element.userId)
                    }
                })
            } catch (err) {
                console.log(err)
                await updateSellEntries(element.userId)
                await updateUserTokenFlag(
                    element.userId,
                    element.token,
                    element.tokenId,
                    "Pending Sell"
                )
            }
        }
    })
}

export const get24HReport = async userId => {
    const user = await getUser(userId)
    console.log(user)

    let no_of_buys = 0
    let no_of_sells = 0
    let tokens = []

    const timestamp = await getTimestamp()

    user.tokens.forEach(token => {
        console.log(token.tokenId)
        const time_diff = (timestamp - token.timestamp) / (1000*60*60*24)
        console.log(timestamp, time_diff)

        if(time_diff <= 1) {
            if(token.flag == "Bought") {
                no_of_buys++
                tokens.push(token)
            } else if(token.flag == "Sold") {
                no_of_buys++
                no_of_sells++
                tokens.push(token)
            }
        }
    })

    return { no_of_buys, no_of_sells, tokens }
}