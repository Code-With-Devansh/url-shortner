import mongoose from "mongoose";
import crypto from "crypto";
const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        select:false
    },
    avatar:{
        type: String,
        // add gravatar as default
        default: function(){
            return getGravitarUrl(this.email);
        }
    }
});
function getGravitarUrl(email){
    email = (email || "").trim().toLowerCase();
    const hash = crypto.createHash('md5').update(email).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}
function hashPassword(password){
    return crypto.createHash('sha256').update(password).digest('hex');
}

userSchema.methods.toJSON = function(){
    const user = this.toObject();
    delete user.password;
    delete user.__v; 
    return user;
}

userSchema.pre("save", function(){
    if (this.isModified("password") && this.password) {
        this.password = hashPassword(this.password);
    }
});

userSchema.methods.comparePassword = function(password){
    return this.password === hashPassword(password);
}

export const User = mongoose.model("User", userSchema);