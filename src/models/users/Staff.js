

const { Schema, model, default: mongoose } = require('mongoose');
const validator = require('validator');

const staffSchema = new Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        validate: [validator.isEmail, 'Please provide a valid email'],
        trim: true
    },
    contact: {
        unique: true,
        type: String,
        trim: true,
       
    },
    countryCode: {
        type: String,
        // required: true,
        trim: true,
        validate: {
            validator(value) {
                return /^\+\d{1,4}$/.test(value);
            },
            message: 'Invalid country code'
        }
    },
    staffRole: {
        type: String,
    },
    profilePicture: {
        type: String,
      
    },
    staffOf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
});




module.exports = model('Staff', staffSchema);