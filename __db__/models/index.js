import { Schema, model } from "mongoose"

const UserSchema = new Schema({
    userId : { type : Number, required : true },
    username : String,
    wallet_pk : String,
    wallet_sk : String,
    tokens : [
        {
            address : String,
            tokenId : String,
            buy_amount : Number,
            amount : Number,
            entry : { type : Number, default : 0 },
            tp : { type : Number, default : 0 },
            sl : { type : Number, default : 0 },
            profit : { type : Number, default : 0 },
            loss : { type : Number, default : 0 },
            Xs : { type : Number, default : 0 },
            flag : { type : String, enum : ["Bought", "Sold", "Pending Buy", "Pending Sell"] },
            timestamp : Number
        }
    ],
    buy_limit : Number,
    daily_limit : Number,
    take_profit : Number,
    stop_loss : Number
})

const BuyQueueSchema = new Schema({
    userId : { type : Number, required : true },
    token : { type : String, required : true },
    tokenId : { type : String, required : true },
    buy_amount : { type : Number, required : true },
    retries : { type : Number, required : true }
})

const SellQueueSchema = new Schema({
    userId : { type : Number, required : true },
    token : { type : String, required : true },
    tokenId : { type : String, required : true },
    buy_amount : { type : Number, required : true },
    amount : { type : Number, required : true },
    entry : { type : Number, required : true },
    retries : { type : Number, required : true },
    timestamp : { type : Number, required : true }
})

export const UserModel = model("User", UserSchema)

export const BuyQueueModel = model("BuyQueue", BuyQueueSchema)

export const SellQueueModel = model("SellQueue", SellQueueSchema)