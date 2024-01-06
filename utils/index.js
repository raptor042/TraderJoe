import { 
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
import { buyToken, getAmountsOut, getTimestamp, sellToken, symbol } from "../__web3__/index.js"

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

            const pairAddr = await getPair(element.token, true)
            const pair = new ethers.Contract(
                pairAddr,
                PAIR_ABI.abi,
                getProvider()
            )

            await buyToken(
                user.wallet_sk,
                element.token,
                element.amount,
                user.wallet_pk
            )

            pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, e) => {
                if(to == user.wallet_pk) {
                    console.log(sender, Number(amount0In), Number(amount1In), Number(amount0Out), Number(amount1Out), to)
                    const entry = Number(amount0Out) / Number(amount1In)
                    const timestamp = await getTimestamp()
                    const amount = await decimalFormatting(args[0], amount0Out)
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

                    await updateUserDailyLimit(element.userId, user.buy_amount)

                    await addToSellQueue(element.userId, args[0], ID, amount, entry, 0, timestamp)
                }
            })
        } catch (err) {
            console.log(err)
            await updateBuyEntries(element.userId)
        }
    })
}

export const runSellQueue = async () => {
    const queue = await getSellQueue()
    console.log(queue)

    queue.forEach(async element => {
        const timestamp = await getTimestamp()
        const time_diff = (timestamp - element.timestamp) / (1000*60*60)
        console.log(timestamp, element.timestamp, time_diff)

        const [amount0In, amount1Out] = await getAmountsOut(element.amount, element.token)
        const exit = Number(amount0In) / Number(amount1Out)
        const Xs = calculateXs(element.entry, exit)

        if(time_diff >= 5 || Xs >= 5) {
            try {
                const user = await getUser(element.userId)
                console.log(user)
    
                const pairAddr = await getPair(element.token, true)
                const pair = new ethers.Contract(
                    pairAddr,
                    PAIR_ABI.abi,
                    getProvider()
                )
    
                await sellToken(
                    user.wallet_sk,
                    element.token,
                    element.amount,
                    user.wallet_pk
                )
    
                pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, e) => {
                    if(to == user.wallet_pk) {
                        console.log(sender, Number(amount0In), Number(amount1In), Number(amount0Out), Number(amount1Out), to)
                        const exit = Number(amount0In) / Number(amount1Out)
                        const timestamp = await getTimestamp()
                        const amount = await decimalFormatting(args[0], amount0Out)
                        console.log(exit, amount, timestamp)
    
                        if(user.buy_amount > amount1Out) {
                            const profit = amount1Out - user.buy_amount
                            const Xs = calculateXs(element.entry, exit)
    
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
                        } else if(user.buy_amount < amount1Out) {
                            const loss = user.buy_amount - amount1Out
                            const Xs = calculateXs(element.entry, exit)
    
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
                    }
                })
            } catch (err) {
                console.log(err)
                await updateSellEntries(element.userId)
            }
        }
    })
}