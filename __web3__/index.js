import { PANCAKESWAP_ROUTER02_TESTNET, PAIR_ABI, PANCAKESWAP_ROUTER02_ABI, FACTORY_ABI, PANCAKESWAP_FACTORY_TESTNET, PANCAKESWAP_ROUTER02_MAINNET, PANCAKESWAP_FACTORY_MAINNET } from "./config.js"
import { getProvider, getSigner } from "./init.js"
import { ethers } from "ethers"

export const createWallet = () => {
    const wallet = ethers.Wallet.createRandom()
    console.log(wallet)

    return [wallet.address, wallet.mnemonic.phrase]
}

export const getTimestamp = async () => {
    const block = await getProvider().getBlock("latest")
    console.log(block)

    return block.timestamp
}

export const name = async (address) => {
    const token = new ethers.Contract(
        address,
        PAIR_ABI.abi,
        getProvider()
    )
    console.log(await token.name())

    return await token.name()
}

export const symbol = async (address) => {
    const token = new ethers.Contract(
        address,
        PAIR_ABI.abi,
        getProvider()
    )
    console.log(await token.symbol())

    return await token.symbol()
}

export const WETH = async () => {
    const router = new ethers.Contract(
        PANCAKESWAP_ROUTER02_MAINNET,
        PANCAKESWAP_ROUTER02_ABI,
        getProvider()
    )
    const weth = await router.WETH()

    return weth
}

export const decimalFormatting = async (ca, amount) => {
    const token = new ethers.Contract(
        ca,
        PAIR_ABI.abi,
        getProvider()
    )
    const decimals = Number(await token.decimals())
    const points = decimals == 18 ? 18 : 18 - decimals

    const value = decimals == 18 ? 
        Number(ethers.formatEther(amount)) :
        Number(ethers.formatEther(amount)) * 10**points
    console.log(decimals, points, value)

    return value
}

export const getBalance = async (ca, address) => {
    const token = new ethers.Contract(
        ca,
        PAIR_ABI.abi,
        getProvider()
    )
    const _balance = await token.balanceOf(address)
    const balance = await decimalFormatting(ca, _balance)

    return balance
}

export const approveSwap = async (ca, phrase, spender, amount) => {
    const token = new ethers.Contract(
        ca,
        PAIR_ABI.abi,
        getSigner(phrase)
    )
    console.log(await token.totalSupply(), await token.decimals())

    try {
        const approve = await token.approve(
            spender,
            ethers.parseEther(`${amount}`)
        )
        console.log(approve)

        token.on("Approval", (owner, spender, value, e) => {
            console.log(`An owner - ${owner} has allowed a spender - ${spender} to spend ${Number(ethers.formatEther(value))} of the tokens.`)
        })
    } catch (err) {
        console.log(err)
    }
}

export const getPair = async (token1, flag) => {
    const router = new ethers.Contract(
        PANCAKESWAP_ROUTER02_MAINNET,
        PANCAKESWAP_ROUTER02_ABI,
        getProvider()
    )
    const token0 = await router.WETH()
    console.log(token0)

    const factory = new ethers.Contract(
        PANCAKESWAP_FACTORY_MAINNET,
        FACTORY_ABI.abi,
        getProvider()
    )
    const pair = flag ? await factory.getPair(token0, token1) : await factory.getPair(token1, token0) 
    console.log(pair)

    return pair
}

export const getAmountsOut = async (amount, address) => {
    const router = new ethers.Contract(
        PANCAKESWAP_ROUTER02_MAINNET,
        PANCAKESWAP_ROUTER02_ABI,
        getProvider()
    )

    const amountsOut = await router.getAmountsOut(
        ethers.parseEther(`${amount}`),
        [address, await router.WETH()]
    )
    console.log(amountsOut)

    return amountsOut
}

export const buyToken = async (phrase, address, amount, to) => {
    const router = new ethers.Contract(
        PANCAKESWAP_ROUTER02_MAINNET,
        PANCAKESWAP_ROUTER02_ABI,
        getSigner(phrase)
    )
    const timestamp = await getTimestamp()
    const time = timestamp + 10000
    console.log(await router.WETH(), time, timestamp, amount, address, to)

    const swap = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        ethers.parseEther("0"),
        [await router.WETH(), address],
        to,
        time,
        { 
            value : ethers.parseEther(`${amount}`)
        }
    )
    console.log("buy", swap)
}

export const sellToken = async (phrase, address, amount, to) => {
    const router = new ethers.Contract(
        PANCAKESWAP_ROUTER02_MAINNET,
        PANCAKESWAP_ROUTER02_ABI,
        getSigner(phrase)
    )
    const timestamp = await getTimestamp()
    const time = timestamp + 10000
    console.log(await router.WETH(), time, timestamp, amount, address, to)

    try {
        const swap = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            ethers.parseEther(`${amount}`),
            ethers.parseEther("0"),
            [address, await router.WETH()],
            to,
            time
        )
        console.log("sell", swap)
    } catch (err) {
        console.log(err)
    }
}