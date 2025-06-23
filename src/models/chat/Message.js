const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSettingsSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	readAt: { type: Date },
	deliveredAt: { type: Date },
	deletedAt: { type: Date },
	markedAsStar: { type: Boolean, default: false },
});

const messageSchema = new Schema({
	chat: {
		type: Schema.Types.ObjectId,
		ref: 'chats',
		required: true
	},
	sender: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	contentTitle: {
		type: String,
	},
	fileSize: {
		type: String,
	},
	content: {
		type: String,
		required: function() {
			return !this.sharedContact && !this.sharedLocation;
		}
	},
	contentDescription: {
		type: String,
	},
	contentDescriptionType: {
		type: String,
		enum: ['text',  'link', ],
		default: 'text'
	},
	contentType: {
		type: String,
		enum: ['text', 'image', 'video', 'file', 'audio', 'contact', 'link'],
		default: 'text'
	},

	blurredMediaUrl: {
		type: String,
		trim : true
	},
	userSettings: [userSettingsSchema],
	reactionsCount: {
		type: Map,
		of: Number, 
		default: {},
	},
	editedAt: { type: Date },
}, { timestamps: true ,  versionKey: false});

messageSchema.index({ chat: 1, sender: 1, 'userSettings.userId': 1 });

const Message = mongoose.model('messages', messageSchema);

module.exports = Message;
