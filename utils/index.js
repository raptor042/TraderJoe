import { ethers } from "ethers"
import { 
    addToBuyQueue,
    addToSellQueue,
    deleteBuyQueue,
    deleteSellQueue,
    getBuyQueue, 
    getSellQueue, 
    getUser, 
    getUsers, 
    resetUserDailyLimit, 
    updateBuyEntries, 
    updateSellEntries, 
    updateUserDailyLimit, 
    updateUserTokenAmount, 
    updateUserTokenEntry, 
    updateUserTokenFlag, 
    updateUserTokenLoss, 
    updateUserTokenProfit, 
    updateUserTokenSL, 
    updateUserTokenTP, 
    updateUserTokenXs, 
    updateUserTokens
} from "../__db__/index.js"
import { WETH, approveSwap, buyToken, decimalFormatting, getAmountsOut, getPair, getTimestamp, sellToken, symbol } from "../__web3__/index.js"
import { getProvider } from "../__web3__/init.js"
import { FACTORY_ABI, PAIR_ABI, PAIR_ERC20_ABI, PANCAKESWAP_FACTORY_MAINNET, PANCAKESWAP_FACTORY_TESTNET, PANCAKESWAP_ROUTER02_MAINNET, PANCAKESWAP_ROUTER02_TESTNET } from "../__web3__/config.js"

export const getID = async (address) => {
    const pair = new ethers.Contract(
        address,
        PAIR_ABI.abi,
        getProvider()
    )
    const token0 = await pair.token0()
    const token1 = await pair.token1()
    const _symbol = await symbol(token0)
    const symbol_ = await symbol(token1)
    const randInt = Math.floor(Math.random() * 10**8)
    console.log(_symbol, symbol_, randInt)

    return `${_symbol}-${symbol_}-${randInt}`
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

            const [amount0In, amount1Out] = await getAmountsOut(1, token)
            console.log(amount0In, amount1Out)

            if(amount1Out <= 0 || amount1Out >= Number.MAX_SAFE_INTEGER) {
                const tokenExist = user.tokens.filter(_token => _token.address == token)
                console.log(tokenExist)

                const balance = await getProvider().getBalance(user.wallet_pk)
                console.log(ethers.formatEther(balance))

                if(Number(ethers.formatEther(balance)) >= user.buy_amount && tokenExist.length <= 0 && user.daily_limit > 0) {
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

                            await addToSellQueue(element.userId, element.token, element.tokenId, element.buy_amount, amount, entry, 0, timestamp)

                            await deleteBuyQueue(element.userId)
                        }
                    })
                }
            }
        } catch (err) {
            console.log(err)
            if(element.retries <= 5) {
                await updateBuyEntries(element.userId)

                await updateUserTokenFlag(
                    element.userId,
                    element.token,
                    element.tokenId,
                    "Pending Buy"
                )
            } else {
                await deleteBuyQueue(element.userId)
            }
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
        const time_diff = (timestamp - element.timestamp) / 60
        console.log(timestamp, element.timestamp, time_diff)

        const [amount0In, amount1Out] = await getAmountsOut(element.amount, element.token)
        const exit = Number(amount0In) / Number(amount1Out)
        const Xs = calculateXs(element.entry, exit)
        console.log(time_diff >= user.stop_loss, Xs >= user.take_profit)

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
                    element.amount,
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
                if(element.retries <= 5) {
                    await updateSellEntries(element.userId)
                
                    await updateUserTokenFlag(
                        element.userId,
                        element.token,
                        element.tokenId,
                        "Pending Sell"
                    )
                } else {
                    await deleteSellQueue(element.userId)
                }
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
        const time_diff = (timestamp - token.timestamp) / (60*60*24)
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

export const watchPairCreation = async () => {
    const factory = new ethers.Contract(
        PANCAKESWAP_FACTORY_MAINNET,
        FACTORY_ABI.abi,
        getProvider()
    )

    factory.on("PairCreated", async (token0, token1, pair, uint) => {
        console.log(token0, token1, pair, uint)

        await watchPairAddLiquidity(pair, token0, token1)
    })
}

export const watchPairAddLiquidity = async (pairAddress, token0, token1) => {
    const pair = new ethers.Contract(
        pairAddress,
        PAIR_ABI.abi,
        getProvider()
    )
    const weth = await WETH()
    const token = token0 == weth ? token1 : token0
    console.log(token0, token1, weth, token)

    pair.on("Mint", async (sender, amount0, amount1, e) => {
        console.log(sender, amount0, amount1)
        const users = await getUsers()
        const _users = users.filter(user => user.buying == "Enabled")
        console.log(_users)
        
        const [amount0In, amount1Out] = await getAmountsOut(1, token)
        console.log(amount0In, amount1Out)

        if(amount1Out <= 0 || amount1Out >= Number.MAX_SAFE_INTEGER) {
            const _token = new ethers.Contract(
                token,
                PAIR_ERC20_ABI.abi,
                getProvider()
            )

            const timestamp = await getTimestamp()
            const tokenId = await getID(pairAddress)

            _users.forEach(async user => {
                try {
                    const tokenExist = user.tokens.filter(_token => _token.address == token)
                    console.log(tokenExist)

                    const balance = await getProvider().getBalance(user.wallet_pk)
                    console.log(ethers.formatEther(balance))

                    if(Number(ethers.formatEther(balance)) >= user.buy_amount && tokenExist.length <= 0 && user.daily_limit > 0) {
                        await buyToken(
                            user.wallet_sk,
                            token,
                            user.buy_amount,
                            user.wallet_pk
                        )

                        _token.on("Transfer", async (from, to, value, e) => {
                            if(to == user.wallet_pk) {
                                console.log(from, to, value)
                                const amount = await decimalFormatting(token, value)
                                const entry = amount / user.buy_amount
                                console.log(entry, amount, timestamp)

                                await approveSwap(
                                    token,
                                    user.wallet_sk,
                                    PANCAKESWAP_ROUTER02_MAINNET,
                                    amount
                                )

                                await updateUserTokens(user.userId, tokenId, token, user.buy_amount, amount, entry, "Bought", timestamp)

                                await updateUserDailyLimit(user.userId, user.buy_amount)

                                await addToSellQueue(user.userId, token, tokenId, user.buy_amount, amount, entry, 0, timestamp)
                            }
                        })
                    }
                } catch (err) {
                    console.log(err)

                    await updateUserTokens(
                        user.userId,
                        tokenId,
                        token,
                        user.buy_amount,
                        0,
                        0,
                        "Pending Buy",
                        timestamp
                    )

                    await addToBuyQueue(
                        user.userId,
                        token,
                        tokenId,
                        user.buy_amount,
                        0
                    )
                } 
            })
        }
    })
}