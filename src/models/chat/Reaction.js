const mongoose = require('mongoose');
const { Schema } = mongoose;

const reactionSchema = new Schema({
	objectId: {
		type: Schema.Types.ObjectId,
		refPath: 'objectOnModel',
		required: true
	},
	objectOnModel: {
		type: String,
		required: true,
		enum: ['messages']
	},
	user: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	emoji: {
		type: String,
		required: true,
		description: 'Emoji used for the reaction'
	}
}, { timestamps: true });

reactionSchema.index({ message: 1, user: 1 });

const Reaction = mongoose.model('reactions', reactionSchema);

module.exports = Reaction;
