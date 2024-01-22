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
            amount : Number,
            entry : { type : Number, default : 0 },
            tp : { type : Number, default : 0 },
            sl : { type : Number, default : 0 },
            profit : { type : Number, default : 0 },
            loss : { type : Number, default : 0 },
            Xs : { type : Number, default : 0 },
            flag : { type : String, enum : ["Bought", "Sold", "Pending Buy"] },
            timestamp : Number,
            buy_retries : { type : Number, default : 0 },
            sell_retries : { type : Number, default : 0 }
        }
    ],
    buy_limit : { type : Number, default : 0 },
    daily_limit : { type : Number, default : 0 },
    buy_amount : { type : Number, default : 0 },
    take_profit : { type : Number, default : 0 },
    stop_loss : { type : Number, default : 0 },
    buying : { type : String, enum : ["Enabled", "Disabled" ], default : "Enabled" }
})

export const UserModel = model("User", UserSchema)