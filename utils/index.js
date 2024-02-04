import { ethers } from "ethers"
import { 
    getUser, 
    getUsers, 
    resetUserDailyLimit, 
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
    console.log(price0, price1, diff, Xs)

    return Xs
}

export const runBuys = async (token, pairAddress) => {
    const users = await getUsers()
    const _users = users.filter(user => user.buying == "Enabled")
    console.log(_users)

    _users.forEach(async user => {
        if(true) {
            const _token = new ethers.Contract(
                token,
                PAIR_ERC20_ABI.abi,
                getProvider()
            )
            console.log("b")

            const timestamp = await getTimestamp()
            const tokenId = await getID(pairAddress)
            console.log(timestamp, tokenId)

            const tokenExist = user.tokens.filter(_token => _token.address == token)
            console.log(tokenExist)

            const balance = await getProvider().getBalance(user.wallet_pk)
            console.log(ethers.formatEther(balance))

            if(Number(ethers.formatEther(balance)) >= user.buy_amount && tokenExist.length <= 0 && user.daily_limit > 0) {
                try {
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

                            await updateUserTokens(
                                user.userId, 
                                tokenId, 
                                token, 
                                amount, 
                                entry, 
                                "Bought", 
                                timestamp
                            )

                            await updateUserDailyLimit(user.userId)
                        }
                    })
                } catch (err) {
                    console.log(err)

                    await updateUserTokens(
                        user.userId,
                        tokenId,
                        token,
                        0,
                        0,
                        "Failed to Buy",
                        timestamp
                    )
                }
            }
        }
    })
}

export const runSells = async () => {
    const users = await getUsers()
    const _users = users.filter(user => user.buying == "Enabled")
    console.log(_users)

    _users.forEach(async user => {
        const tokens = user.tokens.filter(token => token.flag == "Bought")
        console.log(tokens)

        tokens.forEach(async token => {
            if(true) {
                const _token = new ethers.Contract(
                    token.address,
                    PAIR_ERC20_ABI.abi,
                    getProvider()
                )

                const timestamp = await getTimestamp()
                const time_diff = (timestamp - token.timestamp) / 60
                console.log(timestamp, token.timestamp, time_diff)

                const [amount0In, amount1Out] = await getAmountsOut(token.amount, token.address)
                const exit = Number(amount0In) / Number(amount1Out)
                const Xs = calculateXs(token.entry, exit)
                console.log(time_diff >= user.stop_loss, Xs >= user.take_profit)

                if(time_diff >= user.stop_loss || Xs >= user.take_profit) {
                    try {
                        await sellToken(
                            user.wallet_sk,
                            token.address,
                            token.amount,
                            user.wallet_pk
                        )

                        _token.on("Transfer", async (from, to, value, e) => {
                            if(from == user.wallet_pk) {
                                console.log("Sold", from, to, value)
                                if(exit > token.entry) {
                                    const profit = Number(ethers.formatEther(amount1Out)) - user.buy_amount
                                    console.log("profit", profit)
                
                                    await updateUserTokenProfit(
                                        user.userId,
                                        token.address,
                                        token.tokenId,
                                        profit
                                    )
                
                                    await updateUserTokenTP(
                                        user.userId,
                                        token.address,
                                        token.tokenId,
                                        exit
                                    )
                
                                    await updateUserTokenXs(
                                        user.userId,
                                        token.address,
                                        token.tokenId,
                                        Xs
                                    )
                                } else if(exit < token.entry) {
                                    const loss = user.buy_amount - Number(ethers.formatEther(amount1Out))
                                    console.log("loss", loss)
                
                                    await updateUserTokenLoss(
                                        user.userId,
                                        token.address,
                                        token.tokenId,
                                        loss
                                    )
                
                                    await updateUserTokenSL(
                                        user.userId,
                                        token.address,
                                        token.tokenId,
                                        exit
                                    )
                
                                    await updateUserTokenXs(
                                        user.userId,
                                        token.address,
                                        token.tokenId,
                                        Xs
                                    )
                                }
                
                                await updateUserTokenFlag(
                                    user.userId,
                                    token.address,
                                    token.tokenId,
                                    "Sold"
                                )
                            }
                        })
                    } catch (err) {
                        console.log("Selling Failed", err)

                        await updateUserTokenFlag(
                            user.userId,
                            token.address,
                            token.tokenId,
                            "Failed to Sell"
                        )
                    }
                }
            }
        })
    })
}

export const get24HReport = async userId => {
    const user = await getUser(userId)
    console.log(user)

    let no_of_buys = 0
    let no_of_sells = 0
    let no_of_failed_buys = 0
    let no_of_failed_sells = 0
    let tokens = []

    const timestamp = await getTimestamp()

    user.tokens.forEach(token => {
        console.log(token.tokenId)
        const time_diff = (timestamp - token.timestamp) / (60*60*24)
        console.log(timestamp, time_diff)

        if(time_diff <= 1) {
            if(token.flag == "Bought") {
                no_of_buys++
            } else if(token.flag == "Sold") {
                no_of_buys++
                no_of_sells++
            } else if(token.flag == "Failed to Buy") {
                no_of_failed_buys++
            } else if(token.flag == "Failed to Sell") {
                no_of_buys++
                no_of_failed_sells++
            }

            tokens.push(token)
        }
    })

    return { no_of_buys, no_of_sells, no_of_failed_buys, no_of_failed_sells, tokens }
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

        await runBuys(token, pairAddress)
    })
}