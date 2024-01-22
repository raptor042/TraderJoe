import { connect } from "mongoose"
import { BuyQueueModel, SellQueueModel, UserModel } from "./models/index.js"
import { config } from "dotenv"

config()

const URI = process.env.MONGO_URI

export const connectDB = async () => {
    try {
        await connect(`${URI}`)
        console.log("Connection to the Database was successful.")
    } catch(err) {
        console.log(err)
    }
}

export const getUser = async userId => {
    try {
        const user = await UserModel.findOne({ userId })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const getUsers = async () => {
    try {
        const user = await UserModel.find()
        return user
    } catch (err) {
        console.log(err)
    }
}

export const addUser = async (userId, username, pk, sk) => {
    try {
        const user = new UserModel({
            userId,
            username,
            wallet_pk : pk,
            wallet_sk : sk,
            tokens : []
        })

        const data = await user.save()

        return data
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokens = async (userId, tokenId, address, amount, entry, flag, timestamp) => {
    try {
        const token = {
            address,
            tokenId,
            amount,
            entry,
            flag,
            timestamp
        }
        const group = await UserModel.findOneAndUpdate(
            { userId },
            { $push : { tokens : [token] } }
        )

        return group
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenAmount = async (userId, address, tokenId, amount) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.amount" : amount } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenEntry = async (userId, address, tokenId, entry) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.entry" : entry } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenTP = async (userId, address, tokenId, tp) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.tp" : tp } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenSL = async (userId, address, tokenId, sl) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.sl" : sl } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenProfit = async (userId, address, tokenId, profit) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.profit" : profit } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenLoss = async (userId, address, tokenId, loss) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.loss" : loss } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenXs = async (userId, address, tokenId, Xs) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.Xs" : Xs } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenFlag = async (userId, address, tokenId, flag) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $set : { "tokens.$.flag" : flag } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenBuyRetries = async (userId, address, tokenId) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $inc : { "tokens.$.buy_retries" : 1 } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTokenSellRetries = async (userId, address, tokenId) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, tokens : { $elemMatch : { address, tokenId } } },
            { $inc : { "tokens.$.sell_retries" : 1 } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserBuyLimit = async (userId, amount) => {
    try {
        const user = await UserModel.findOneAndUpdate({ userId }, {  $set : { buy_limit : amount } })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserBuyAmount = async (userId, amount) => {
    try {
        const user = await UserModel.findOneAndUpdate({ userId }, {  $set : { buy_amount : amount } })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserBuying = async (userId, value) => {
    try {
        const user = await UserModel.findOneAndUpdate({ userId }, {  $set : { buying : value } })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const resetUserDailyLimit = async (userId, amount) => {
    try {
        const user = await UserModel.findOneAndUpdate({ userId }, {  $set : { daily_limit : amount } })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserDailyLimit = async (userId, amount) => {
    try {
        const user = await UserModel.findOneAndUpdate({ userId }, {  $inc : { daily_limit : -amount } })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTP = async (userId, tp) => {
    try {
        const user = await UserModel.findOneAndUpdate({ userId }, {  $set : { take_profit : tp } })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserSL = async (userId, sl) => {
    try {
        const user = await UserModel.findOneAndUpdate({ userId }, {  $set : { stop_loss : sl } })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const deleteUser = async (userId) => {
    try {
        const user = await UserModel.deleteOne({ userId })

        return user
    } catch (err) {
        console.log(err)
    }
}